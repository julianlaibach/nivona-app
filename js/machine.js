// Web-Bluetooth-Transport + Session-Logik für Nivona-Maschinen.
//
// Ablauf (wie die offizielle App, docs/NIVONA.md "Library Connection Sequencing"):
//   1. GATT verbinden, DIS 180A lesen (optional), Service AD00 binden
//   2. Notifications auf AD02 aktivieren (erzwingt Pairing/Verschlüsselung)
//   3. HU-Handshake verschlüsselt ohne Session -> 2-Byte-Sessionschlüssel
//   4. HV lesen; danach alle Requests verschlüsselt + Sessionschlüssel vorangestellt

import {
  FrameParser, buildPacket, buildHuPayload, parseHuResponse, toHex, u16be, i32be, concat,
  decodeNumeric, decodeProcessStatus, decodeAscii, decodeUtf16le, encodeName,
  buildBrewPayload, buildProcessPayload, buildCommandPayload,
} from './protocol.js';

const uuid = (short) => `0000${short.toLowerCase()}-b35c-11e4-9813-0002a5d5c51b`;
export const SERVICE = uuid('AD00');
export const CHAR = { control: uuid('AD01'), notify: uuid('AD02'), write: uuid('AD03'), ad04: uuid('AD04'), ad05: uuid('AD05'), name: uuid('AD06') };
const DIS = 0x180a;
const DIS_CHARS = { manufacturer: 0x2a29, model: 0x2a24, serial: 0x2a25, hardware: 0x2a27, firmware: 0x2a26, software: 0x2a28 };
const EXTRA_SERVICE = '00001530-b089-11e4-ad45-0002a5d5c51b';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TEXT = new TextDecoder();

export class NivonaMachine extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.chars = {};
    this.session = null;
    this.info = {};
    this.queue = Promise.resolve();
    this.waiter = null;
    this.parser = new FrameParser((f) => this.#onFrame(f));
  }

  get connected() {
    return Boolean(this.device?.gatt?.connected);
  }

  log(dir, text, extra) {
    const quiet = Boolean(this.quiet) && dir !== 'sys';
    this.dispatchEvent(new CustomEvent('log', { detail: { dir, text, extra, quiet, at: new Date() } }));
  }

  // ------------------------------------------------------------ Verbindung

  static isSupported() {
    return typeof navigator !== 'undefined' && Boolean(navigator.bluetooth);
  }

  async requestDevice({ acceptAll = false, namePrefixes = [] } = {}) {
    const optionalServices = [SERVICE, DIS, EXTRA_SERVICE];
    const options = acceptAll
      ? { acceptAllDevices: true, optionalServices }
      : {
          filters: [
            { services: [SERVICE] },
            // Herstellerdaten der Eugster-Plattform: Company-ID 0x0319, Daten FF FF 00 00 00 02
            // (live gesehen an einer NIVO 9103, Name "9103" + "1109" + Seriennummer + "---")
            { manufacturerData: [{ companyIdentifier: 0x0319 }] },
            ...namePrefixes.map((namePrefix) => ({ namePrefix })),
          ],
          optionalServices,
        };
    this.log('sys', 'Geräteauswahl geöffnet' + (acceptAll ? ' (alle Geräte)' : ''));
    this.device = await navigator.bluetooth.requestDevice(options);
    this.device.addEventListener('gattserverdisconnected', () => {
      this.session = null;
      this.parser.reset();
      this.waiter?.reject(new Error('Verbindung getrennt'));
      this.log('sys', 'GATT-Verbindung getrennt');
      this.dispatchEvent(new Event('disconnected'));
    });
    this.log('sys', `Gerät gewählt: ${this.device.name ?? '(ohne Namen)'}`);
    return this.device;
  }

  async connect(onStep = () => {}) {
    if (!this.device) throw new Error('Kein Gerät gewählt');
    onStep('GATT-Verbindung wird aufgebaut …');
    const server = await this.device.gatt.connect();
    this.log('sys', 'GATT verbunden');

    onStep('Geräteinformationen lesen …');
    this.info = { bleName: this.device.name ?? '' };
    try {
      const dis = await server.getPrimaryService(DIS);
      for (const [key, id] of Object.entries(DIS_CHARS)) {
        try {
          const v = await (await dis.getCharacteristic(id)).readValue();
          this.info[key] = TEXT.decode(v).replace(/\0+$/, '');
        } catch { /* nicht jede Maschine hat alle DIS-Felder */ }
      }
    } catch (e) {
      this.log('sys', `DIS 180A nicht lesbar: ${e.message}`);
    }

    onStep('Nivona-Service AD00 binden …');
    const svc = await server.getPrimaryService(SERVICE);
    for (const [key, id] of Object.entries(CHAR)) {
      try {
        this.chars[key] = await svc.getCharacteristic(id);
      } catch {
        if (['control', 'notify', 'write'].includes(key)) throw new Error(`Pflicht-Characteristic ${key} (${id}) fehlt`);
      }
    }
    try {
      if (this.chars.name) this.info.ad06Name = TEXT.decode(await this.chars.name.readValue()).replace(/\0+$/, '');
    } catch { /* optional */ }

    onStep('Notifications aktivieren (ggf. Pairing bestätigen) …');
    this.chars.notify.addEventListener('characteristicvaluechanged', (ev) => {
      const bytes = new Uint8Array(ev.target.value.buffer.slice(0));
      this.log('rx', toHex(bytes));
      this.parser.feed(bytes);
    });
    let lastErr;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await this.chars.notify.startNotifications();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        this.log('sys', `startNotifications Versuch ${attempt}/5: ${e.message}`);
        await sleep(800);
      }
    }
    if (lastErr) throw new Error(`Notifications auf AD02 fehlgeschlagen (${lastErr.message}). Evtl. alte Kopplung im Betriebssystem entfernen.`);

    onStep('Session-Handshake (HU) …');
    await this.handshake();

    onStep('Softwareversion lesen (HV) …');
    try {
      this.info.version = await this.readVersion();
    } catch (e) {
      this.log('sys', `HV fehlgeschlagen: ${e.message}`);
    }
    try {
      this.info.serialHL = await this.readSerial();
    } catch (e) {
      this.log('sys', `HL fehlgeschlagen: ${e.message}`);
    }
    this.dispatchEvent(new Event('ready'));
    return this.info;
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }

  // ------------------------------------------------------------ Transport

  #onFrame(frame) {
    this.log('frame', `${frame.command}${frame.ok ? '' : ' ✗ ' + frame.error}  ${toHex(frame.payload)}`);
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      clearTimeout(w.timer);
      w.resolve(frame);
    } else {
      this.dispatchEvent(new CustomEvent('unsolicited', { detail: frame }));
    }
  }

  /**
   * Frames über 20 Byte (ATT-MTU 23 − 3) in Stücke teilen – wie esp-coffee-bridge
   * (10 ms Pause) und melitta-barista-ha (chunk_for_ble). Betrifft v. a. HE
   * (25 Byte); ein einzelner Long-Write kommt bei der Maschine nicht an.
   */
  async #write(bytes) {
    const ch = this.chars.write;
    const send = (b) => {
      if (ch.properties.write && ch.writeValueWithResponse) return ch.writeValueWithResponse(b);
      if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) return ch.writeValueWithoutResponse(b);
      return ch.writeValue(b);
    };
    const CHUNK = 20;
    if (bytes.length <= CHUNK) return send(bytes);
    for (let i = 0; i < bytes.length; i += CHUNK) {
      if (i) await sleep(10);
      await send(bytes.slice(i, i + CHUNK));
    }
  }

  /**
   * Sendet einen Frame und wartet auf die erste Antwort (wie die App mit
   * ExpectedResponseFrames = null). Alle Requests laufen seriell.
   */
  request(command, payload = new Uint8Array(0), { encrypt = true, withSession = true, timeout = 2500, expectReply = true, quiet = false } = {}) {
    const run = async () => {
      if (!this.connected) throw new Error('Nicht verbunden');
      const sessionKey = withSession ? this.session : null;
      if (withSession && !sessionKey) throw new Error('Keine Session – zuerst HU-Handshake');
      const packet = buildPacket(command, payload, { sessionKey, encrypt });
      this.quiet = quiet;
      this.log('tx', `${command}  ${toHex(packet)}`, { payload: toHex(payload) });
      this.parser.reset();
      const reply = expectReply
        ? new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              this.waiter = null;
              reject(new Error(`Timeout: keine Antwort auf ${command} nach ${timeout} ms`));
            }, timeout);
            this.waiter = { resolve, reject, timer };
          })
        : Promise.resolve(null);
      try {
        await this.#write(packet);
        return await reply;
      } catch (e) {
        if (this.waiter) {
          clearTimeout(this.waiter.timer);
          this.waiter = null;
        }
        throw e;
      } finally {
        this.quiet = false;
      }
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => {});
    return p;
  }

  async #expect(command, frame) {
    if (!frame.ok) throw new Error(`${frame.command}: ${frame.error}`);
    if (frame.command === 'N') throw new Error(`Maschine hat ${command} abgelehnt (N)`);
    return frame;
  }

  async #writeAck(command, payload, opts) {
    const f = await this.request(command, payload, opts);
    if (f.command === 'A') return true;
    if (f.command === 'N') throw new Error(`Maschine hat ${command} abgelehnt (NACK)`);
    throw new Error(`Unerwartete Antwort ${f.command} auf ${command}`);
  }

  // ------------------------------------------------------------ Kommandos

  async handshake() {
    const seed = crypto.getRandomValues(new Uint8Array(4));
    this.session = null;
    const f = await this.request('HU', buildHuPayload(seed), { withSession: false });
    await this.#expect('HU', f);
    if (f.command !== 'HU') throw new Error(`HU erwartet, ${f.command} erhalten`);
    this.session = parseHuResponse(seed, f.payload);
    this.log('sys', `Session aufgebaut, Schlüssel ${toHex(this.session)}`);
    return this.session;
  }

  async ping() {
    const f = await this.request('Hp', Uint8Array.of(0, 0), { encrypt: false, withSession: false });
    return toHex(f.payload);
  }

  async readVersion() {
    const f = await this.#expect('HV', await this.request('HV'));
    return decodeAscii(f.payload);
  }

  async readSerial() {
    const f = await this.#expect('HL', await this.request('HL'));
    return decodeAscii(f.payload);
  }

  async readStatus({ quiet = false } = {}) {
    const f = await this.#expect('HX', await this.request('HX', undefined, { quiet }));
    if (f.command !== 'HX') throw new Error(`HX erwartet, ${f.command} erhalten`);
    return decodeProcessStatus(f.payload);
  }

  async readFeatures() {
    const f = await this.#expect('HI', await this.request('HI', undefined, { timeout: 4000 }));
    return { raw: toHex(f.payload), imageTransfer: Boolean(f.payload[0] & 0x01) };
  }

  async readNumeric(register) {
    const f = await this.#expect('HR', await this.request('HR', u16be(register)));
    if (f.command !== 'HR') throw new Error(`HR erwartet, ${f.command} erhalten`);
    const { register: echoed, value } = decodeNumeric(f.payload);
    if (echoed !== register) throw new Error(`HR: Register ${echoed} statt ${register} erhalten`);
    return value;
  }

  writeNumeric(register, value) {
    return this.#writeAck('HW', concat(u16be(register), i32be(value)));
  }

  async readString(register, encoding = 'legacy') {
    const f = await this.#expect('HA', await this.request('HA', u16be(register)));
    const body = f.payload.slice(2);
    return encoding === 'utf16le' ? decodeUtf16le(body) : decodeAscii(body);
  }

  writeString(register, text, encoding = 'legacy') {
    return this.#writeAck('HB', concat(u16be(register), encodeName(text, encoding)));
  }

  resetToDefault(register) {
    return this.#writeAck('HD', u16be(register));
  }

  cancelProcess() {
    return this.#writeAck('HZ', new Uint8Array(4));
  }

  confirmPrompt() {
    return this.#writeAck('HY', new Uint8Array(4));
  }

  /**
   * Startet ein Getränk. Ein Start ist nicht idempotent, daher kein Retry:
   * Bleibt das ACK aus, gilt der Start nur als erfolgreich, wenn der Status
   * innerhalb weniger Sekunden „Produkt“ meldet (wie melitta-barista-ha).
   */
  async startBrew(selector, mode, useTemp = true, { productProcesses = [] } = {}) {
    try {
      return await this.#writeAck('HE', buildBrewPayload(selector, mode, useTemp), { timeout: 5000 });
    } catch (e) {
      if (!/Timeout/.test(e.message) || !productProcesses.length) throw e;
      this.log('sys', 'Kein ACK auf HE – prüfe, ob die Zubereitung trotzdem läuft …');
      const until = Date.now() + 6000;
      while (Date.now() < until) {
        try {
          const s = await this.readStatus({ quiet: true });
          if (productProcesses.includes(s.process)) {
            this.log('sys', 'Zubereitung läuft – Start bestätigt über Status');
            return true;
          }
        } catch {
          /* weiter versuchen */
        }
        await sleep(500);
      }
      throw e;
    }
  }

  startProcess(processId, type = 0) {
    return this.#writeAck('HE', buildProcessPayload(processId, type), { timeout: 5000 });
  }

  sendGlobalCommand(commandId) {
    return this.#writeAck('HE', buildCommandPayload(commandId), { timeout: 5000 });
  }

  /** Roh-Frame für die Experten-Konsole. */
  async raw(command, payload, opts) {
    const f = await this.request(command, payload, opts);
    return f;
  }
}
