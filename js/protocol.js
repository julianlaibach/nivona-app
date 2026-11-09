// Nivona / Eugster BLE application protocol (frame layer).
//
// Quelle: mpapierski/esp-coffee-bridge, docs/NIVONA.md (aus den offiziellen
// Android-Apps rekonstruiert und live validiert). Dieses Modul ist DOM-frei und
// läuft sowohl im Browser als auch unter Node (siehe tests/protocol.test.mjs).

export const START_BYTE = 0x53; // 'S'
export const END_BYTE = 0x45; // 'E'

/** RC4-Arbeitsschlüssel der App (ASCII). */
export const RC4_KEY = asciiBytes('NIV_060616_V10_1*9#3!4$6+4res-?3');

/** Substitutionstabelle für den HU-Session-Verifier. */
// prettier-ignore
export const HU_TABLE = Uint8Array.from([
  0x62,0x06,0x55,0x96,0x24,0x17,0x70,0xA4,0x87,0xCF,0xA9,0x05,0x1A,0x40,0xA5,0xDB,
  0x3D,0x14,0x44,0x59,0x82,0x3F,0x34,0x66,0x18,0xE5,0x84,0xF5,0x50,0xD8,0xC3,0x73,
  0x5A,0xA8,0x9C,0xCB,0xB1,0x78,0x02,0xBE,0xBC,0x07,0x64,0xB9,0xAE,0xF3,0xA2,0x0A,
  0xED,0x12,0xFD,0xE1,0x08,0xD0,0xAC,0xF4,0xFF,0x7E,0x65,0x4F,0x91,0xEB,0xE4,0x79,
  0x7B,0xFB,0x43,0xFA,0xA1,0x00,0x6B,0x61,0xF1,0x6F,0xB5,0x52,0xF9,0x21,0x45,0x37,
  0x3B,0x99,0x1D,0x09,0xD5,0xA7,0x54,0x5D,0x1E,0x2E,0x5E,0x4B,0x97,0x72,0x49,0xDE,
  0xC5,0x60,0xD2,0x2D,0x10,0xE3,0xF8,0xCA,0x33,0x98,0xFC,0x7D,0x51,0xCE,0xD7,0xBA,
  0x27,0x9E,0xB2,0xBB,0x83,0x88,0x01,0x31,0x32,0x11,0x8D,0x5B,0x2F,0x81,0x3C,0x63,
  0x9A,0x23,0x56,0xAB,0x69,0x22,0x26,0xC8,0x93,0x3A,0x4D,0x76,0xAD,0xF6,0x4C,0xFE,
  0x85,0xE8,0xC4,0x90,0xC6,0x7C,0x35,0x04,0x6C,0x4A,0xDF,0xEA,0x86,0xE6,0x9D,0x8B,
  0xBD,0xCD,0xC7,0x80,0xB0,0x13,0xD3,0xEC,0x7F,0xC0,0xE7,0x46,0xE9,0x58,0x92,0x2C,
  0xB7,0xC9,0x16,0x53,0x0D,0xD6,0x74,0x6D,0x9F,0x20,0x5F,0xE2,0x8C,0xDC,0x39,0x0C,
  0xDD,0x1F,0xD1,0xB6,0x8F,0x5C,0x95,0xB8,0x94,0x3E,0x71,0x41,0x25,0x1B,0x6A,0xA6,
  0x03,0x0E,0xCC,0x48,0x15,0x29,0x38,0x42,0x1C,0xC1,0x28,0xD9,0x19,0x36,0xB3,0x75,
  0xEE,0x57,0xF0,0x9B,0xB4,0xAA,0xF2,0xD4,0xBF,0xA3,0x4E,0xDA,0x89,0xC2,0xAF,0x6E,
  0x2B,0x77,0xE0,0x47,0x7A,0x8E,0x2A,0xA0,0x68,0x30,0xF7,0x67,0x0F,0x0B,0x8A,0xEF,
]);

/**
 * Antwort-Payloadlängen (ohne Start, Kommando, Checksumme, Ende), wie sie der
 * App-Parser registriert. `encrypted` = Antwortkörper ist RC4-verschlüsselt.
 */
export const RESPONSE_DEFS = {
  HU: { len: 8, encrypted: true },
  HV: { len: 11, encrypted: true },
  Hp: { len: 24, encrypted: false },
  HS: { len: 10, encrypted: true },
  HR: { len: 6, encrypted: true },
  HA: { len: 66, encrypted: true },
  HX: { len: 8, encrypted: true },
  HL: { len: 20, encrypted: true },
  HI: { len: 10, encrypted: true },
  HF: { len: 17, encrypted: true },
  HQ: { len: 16, encrypted: true },
};

// ---------------------------------------------------------------- Helpers

export function asciiBytes(str) {
  return Uint8Array.from(str, (c) => c.charCodeAt(0) & 0xff);
}

export function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function toHex(bytes, sep = ' ') {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(sep);
}

export function fromHex(str) {
  const clean = str.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2) throw new Error('Hex-String muss eine gerade Anzahl Ziffern haben');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function u16be(v) {
  return Uint8Array.of((v >> 8) & 0xff, v & 0xff);
}

export function i32be(v) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setInt32(0, v | 0, false);
  return b;
}

// ---------------------------------------------------------------- Crypto

/** Standard-RC4; jedes Paket startet mit frischem Keystream. */
export function rc4(data, key = RC4_KEY) {
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = new Uint8Array(data.length);
  for (let n = 0, i = 0, j = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    out[n] = data[n] ^ s[(s[i] + s[j]) & 0xff];
  }
  return out;
}

/** Einerkomplement-Checksumme über Kommando-ASCII + Body. */
export function checksum(command, body) {
  let sum = 0;
  for (const b of asciiBytes(command)) sum += b;
  for (const b of body) sum += b;
  return ~sum & 0xff;
}

export function huVerifier(buf, start = 0, count = buf.length) {
  let s = HU_TABLE[buf[start]];
  for (let i = start + 1; i < start + count; i++) s = HU_TABLE[s ^ buf[i]];
  const out0 = (s + 0x5d) & 0xff;
  s = HU_TABLE[(buf[start] + 1) & 0xff];
  for (let i = start + 1; i < start + count; i++) s = HU_TABLE[s ^ buf[i]];
  const out1 = (s + 0xa7) & 0xff;
  return Uint8Array.of(out0, out1);
}

// ---------------------------------------------------------------- Requests

/**
 * Serialisiert einen Request:
 *   0x53 || cmd || body || crc || 0x45                  (plain)
 *   0x53 || cmd || RC4(body || crc) || 0x45             (verschlüsselt)
 * mit body = sessionKey || payload, falls sessionKey gesetzt ist.
 */
export function buildPacket(command, payload = new Uint8Array(0), { sessionKey = null, encrypt = true } = {}) {
  if (command.length !== 2) throw new Error(`Kommando muss 2 Zeichen haben: ${command}`);
  const body = sessionKey ? concat(sessionKey, payload) : payload;
  const crc = checksum(command, body);
  const tail = concat(body, Uint8Array.of(crc));
  return concat(Uint8Array.of(START_BYTE), asciiBytes(command), encrypt ? rc4(tail) : tail, Uint8Array.of(END_BYTE));
}

export function buildHuPayload(seed4) {
  return concat(seed4, huVerifier(seed4, 0, 4));
}

/** Prüft die 8-Byte-HU-Antwort und liefert den 2-Byte-Sessionschlüssel. */
export function parseHuResponse(seed4, payload) {
  if (payload.length !== 8) throw new Error(`HU-Antwort hat ${payload.length} statt 8 Bytes`);
  for (let i = 0; i < 4; i++) if (payload[i] !== seed4[i]) throw new Error('HU: Random key mismatch');
  const v = huVerifier(payload, 0, 6);
  if (payload[6] !== v[0] || payload[7] !== v[1]) throw new Error('HU: Session key verification failed');
  return payload.slice(4, 6);
}

// ---------------------------------------------------------------- Response parser

/**
 * Streaming-Parser für AD02-Notifications. Frames können über mehrere
 * Notifications verteilt sein, und 0x45 kann im Chiffrat vorkommen – deshalb
 * werden H*-Frames über ihre bekannte Länge abgegrenzt.
 *
 * Emittiert Objekte { command, payload, raw, ok, error }.
 */
export class FrameParser {
  constructor(onFrame) {
    this.onFrame = onFrame;
    this.buf = [];
    this.lastByteAt = 0;
  }

  reset() {
    this.buf = [];
  }

  feed(bytes, now = Date.now()) {
    if (this.buf.length && now - this.lastByteAt > 1000) this.buf = []; // Inter-Byte-Timeout wie in der App
    this.lastByteAt = now;
    for (const b of bytes) this.buf.push(b);
    this.#drain();
  }

  #drain() {
    for (;;) {
      const start = this.buf.indexOf(START_BYTE);
      if (start < 0) {
        this.buf = [];
        return;
      }
      if (start > 0) this.buf.splice(0, start);
      if (this.buf.length < 2) return;

      const c1 = String.fromCharCode(this.buf[1]);
      // Einzeichen-Antworten A (ACK) / N (NACK): 53 41|4E crc 45
      if (c1 === 'A' || c1 === 'N') {
        const end = this.buf.indexOf(END_BYTE, 2);
        if (end < 0) {
          if (this.buf.length > 6) this.buf.splice(0, 1);
          return;
        }
        const raw = Uint8Array.from(this.buf.splice(0, end + 1));
        this.onFrame({ command: c1, payload: new Uint8Array(0), raw, ok: true });
        continue;
      }
      if (this.buf.length < 3) return;
      const command = c1 + String.fromCharCode(this.buf[2]);
      const def = RESPONSE_DEFS[command];
      if (!def) {
        // Unbekanntes Kommando: bis zum nächsten Endbyte lesen (best effort).
        const end = this.buf.indexOf(END_BYTE, 3);
        if (end < 0) {
          if (this.buf.length > 128) this.buf.splice(0, 1);
          return;
        }
        const raw = Uint8Array.from(this.buf.splice(0, end + 1));
        this.onFrame({ command, payload: raw.slice(3, -1), raw, ok: false, error: 'unbekanntes Antwort-Kommando' });
        continue;
      }
      const total = 1 + 2 + def.len + 1 + 1;
      if (this.buf.length < total) return;
      if (this.buf[total - 1] !== END_BYTE) {
        // Kein gültiger Frame an dieser Stelle -> resynchronisieren.
        this.buf.splice(0, 1);
        continue;
      }
      const raw = Uint8Array.from(this.buf.splice(0, total));
      this.onFrame(decodeFrame(command, raw, def.encrypted));
    }
  }
}

export function decodeFrame(command, raw, encrypted) {
  const inner = raw.slice(3, -1);
  const plain = encrypted ? rc4(inner) : inner;
  const body = plain.slice(0, -1);
  const crc = plain[plain.length - 1];
  const ok = crc === checksum(command, body);
  return { command, payload: body, raw, ok, error: ok ? undefined : 'Checksumme ungültig' };
}

// ---------------------------------------------------------------- Payload decoders

export function decodeNumeric(payload) {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return { register: dv.getUint16(0, false), value: dv.getInt32(2, false) };
}

export function decodeProcessStatus(payload) {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    process: dv.getInt16(0, false),
    subProcess: dv.getInt16(2, false),
    message: dv.getInt16(4, false),
    progress: dv.getInt16(6, false),
  };
}

export function decodeAscii(bytes) {
  let s = '';
  for (const b of bytes) {
    if (b === 0) break;
    s += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
  }
  return s.trim();
}

export function decodeUtf16le(bytes) {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  return s;
}

export function encodeName(name, encoding) {
  const out = new Uint8Array(64);
  if (encoding === 'utf16le') {
    for (let i = 0, o = 0; i < name.length && o + 1 < 64; i++) {
      const c = name.charCodeAt(i);
      out[o++] = c & 0xff;
      out[o++] = (c >> 8) & 0xff;
    }
  } else {
    // Legacy: nur Buchstaben/Ziffern, ein Byte pro Zeichen (wie die App).
    const filtered = [...name].filter((ch) => /[\p{L}\p{N}]/u.test(ch));
    filtered.slice(0, 64).forEach((ch, i) => {
      const c = ch.charCodeAt(0);
      out[i] = c <= 0xff ? c : 0x3f;
    });
  }
  return out;
}

// ---------------------------------------------------------------- HE payloads

/**
 * Getränkestart: [00, mode, 00, selector, 00, useTemp, 00 x12].
 * Byte 5 = 1: Parameter aus dem temporären Rezept, 0: gespeichertes Rezept.
 */
export function buildBrewPayload(selector, mode = 0x0b, useTemp = true) {
  const p = new Uint8Array(18);
  p[1] = mode & 0xff;
  p[3] = selector & 0xff;
  p[5] = useTemp ? 0x01 : 0x00;
  return p;
}

/** Direkter Prozess-Start: [00, process, 00, type, 00 x14]. */
export function buildProcessPayload(processId, type = 0) {
  const p = new Uint8Array(18);
  p[1] = processId & 0xff;
  p[3] = type & 0xff;
  return p;
}

/** Globale Kommandos wie Werksreset: [cmd_hi, cmd_lo, 00 x16]. */
export function buildCommandPayload(commandId) {
  const p = new Uint8Array(18);
  p[0] = (commandId >> 8) & 0xff;
  p[1] = commandId & 0xff;
  return p;
}

export const HE_FACTORY_RESET_SETTINGS = 0x0032;
export const HE_FACTORY_RESET_RECIPES = 0x0033;

// ---------------------------------------------------------------- Self-test

/** Testvektoren aus docs/NIVONA.md. Liefert [{name, ok, expected, actual}]. */
export function selfTest() {
  const session = Uint8Array.of(0x12, 0x34);
  const checks = [
    ['RC4 00 00 47', toHex(rc4(fromHex('000047'))), '1F C8 46'],
    ['RC4 HU-Body', toHex(rc4(fromHex('FA48D17B7E6EE8'))), 'E5 80 D0 36 79 81 BC'],
    ['HU-Verifier', toHex(huVerifier(fromHex('FA48D17B'))), '7E 6E'],
    ['Hp plain', toHex(buildPacket('Hp', fromHex('0000'), { encrypt: false })), '53 48 70 00 00 47 45'],
    ['HU verschlüsselt', toHex(buildPacket('HU', buildHuPayload(fromHex('FA48D17B')))), '53 48 55 E5 80 D0 36 79 81 BC 45'],
    ['HV mit Session', toHex(buildPacket('HV', new Uint8Array(0), { sessionKey: session })), '53 48 56 0D FC 1A 45'],
    ['HR mit Session', toHex(buildPacket('HR', fromHex('00D5000004D2'), { sessionKey: session })), '53 48 52 0D FC 01 98 07 EF 50 90 BE 45'],
  ];
  const results = checks.map(([name, actual, expected]) => ({ name, ok: actual === expected, actual, expected }));

  // HU-Antwortprüfung (live-Vektor 756)
  try {
    const key = parseHuResponse(fromHex('12314BF7'), fromHex('12314BF73E15CC5F'));
    results.push({ name: 'HU-Antwort live', ok: toHex(key) === '3E 15', actual: toHex(key), expected: '3E 15' });
  } catch (e) {
    results.push({ name: 'HU-Antwort live', ok: false, actual: e.message, expected: '3E 15' });
  }

  // Parser: live HR-104-Antwort, zerstückelt eingespeist
  const frames = [];
  const parser = new FrameParser((f) => frames.push(f));
  const resp = fromHex('5348521FA0014D07EBAD45');
  parser.feed(resp.slice(0, 4));
  parser.feed(resp.slice(4));
  const f = frames[0];
  const actual = f ? `${f.command} ok=${f.ok} ${toHex(f.payload)}` : 'kein Frame';
  results.push({ name: 'Parser HR 104 live', ok: actual === 'HR ok=true 00 68 00 00 00 04', actual, expected: 'HR ok=true 00 68 00 00 00 04' });

  return results;
}
