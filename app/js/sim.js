// Virtuelle NIVO 9103 für den Demo-Modus.
// Gleiche Schnittstelle wie NivonaMachine (js/machine.js), arbeitet aber auf
// einem In-Memory-Registerabbild. Brühvorgänge laufen mit echten Phasen
// (Mahlen → Kaffee → Dampf/Wasser) und erhöhen die Zähler.

import * as F9101 from '../../js/family9101.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Standardrezepte je Auswahl (Anzeige-Werte, ml).
const DEFAULT_RECIPES = {
  0: { coffee_amount: 120 }, // Lungo
  1: { coffee_amount: 40 }, // Espresso
  2: { coffee_amount: 40, water_amount: 110, preparation: 2 }, // Americano
  3: { coffee_amount: 50, milk_amount: 150 }, // Caffè Latte
  4: { coffee_amount: 50, milk_foam_amount: 100 }, // Cappuccino
  5: { coffee_amount: 40, milk_foam_amount: 20 }, // Espresso Macchiato
  6: { coffee_amount: 60, milk_amount: 80, milk_foam_amount: 40 }, // Flat White
  7: { coffee_amount: 50, milk_amount: 120, milk_foam_amount: 100 }, // Latte Macchiato
  8: { milk_amount: 150, milk_foam_amount: 50 }, // Milch
  9: { water_amount: 200 }, // Heißwasser
  10: { coffee_amount: 120, profile: 5 },
  11: { coffee_amount: 40, profile: 5 },
  12: { coffee_amount: 40, water_amount: 110, profile: 5 },
};
const BASE = { strength: 2, profile: 1, coffee_temperature: 1, preparation: 0, milk_type: 0, froth_type: 0, milk_temp_control: 1, milk_temperature: 2, two_cups: 0 };

export class SimulatedMachine extends EventTarget {
  constructor() {
    super();
    this.device = { name: '91031109000000000---' };
    this.session = null;
    this.info = {};
    this.regs = new Map();
    this.status = { process: 3, subProcess: 0, message: 0, progress: 0 };
    this.beanGrams = 210;
    this.#seed();
  }

  static isSupported() {
    return true;
  }

  get connected() {
    return Boolean(this.session);
  }

  log(dir, text) {
    this.dispatchEvent(new CustomEvent('log', { detail: { dir, text, at: new Date() } }));
  }

  #seed() {
    for (const [sel, base] of Object.entries(F9101.STANDARD_BASES)) {
      const r = { ...BASE, ...DEFAULT_RECIPES[sel] };
      for (const f of F9101.FIELDS) if (F9101.STANDARD_OFFSETS[sel].includes(f.std)) this.regs.set(base + f.std, r[f.key] ?? 0);
    }
    const counts = [412, 1386, 233, 158, 604, 41, 97, 312, 64, 120, 8, 5, 3];
    counts.forEach((n, i) => this.regs.set(200 + i, n));
    this.regs.set(213, counts.reduce((a, b) => a + b, 0));
    this.regs.set(238, 27); // Starts per App
    [[600, 62], [610, 35], [620, 81], [640, 47], [650, 12]].forEach(([r, v]) => this.regs.set(r, v));
    // Einstellungen
    [[100, 2], [101, 10], [102, 60], [119, 2], [120, 0], [121, 1], [122, 1], [124, 0], [125, 2], [126, 16], [127, 2], [128, 1], [129, 0]].forEach(([r, v]) => this.regs.set(r, v));
    this.names = new Map([[20002, 'Morgenkaffee'], [20102, 'Julians Flat White'], [20202, 'Doppio']]);
    [[20000, 1, 0], [20100, 1, 6], [20200, 1, 1]].forEach(([b, en, type]) => {
      this.regs.set(b, en);
      this.regs.set(b + 3, type);
    });
  }

  // ------------------------------------------------------------ Verbindung

  async requestDevice() {
    await sleep(400);
    return this.device;
  }

  async connect(onStep = () => {}) {
    const steps = [
      ['gatt', 'Verbindung wird aufgebaut …', 700],
      ['pair', 'Kopplung wird bestätigt …', 900],
      ['session', 'Sichere Sitzung wird eingerichtet …', 700],
      ['info', 'Maschinendaten werden gelesen …', 600],
    ];
    for (const [id, text, ms] of steps) {
      onStep(text, id);
      await sleep(ms);
    }
    this.session = Uint8Array.of(0x5e, 0x11);
    this.info = { bleName: this.device.name, manufacturer: 'EF', model: 'EF-BTLE', version: '11090022A22', serialHL: '9103110900000000----', simulated: true };
    this.#startTicker();
    this.dispatchEvent(new Event('ready'));
    return this.info;
  }

  disconnect() {
    this.session = null;
    clearInterval(this.ticker);
    this.dispatchEvent(new Event('disconnected'));
  }

  // ------------------------------------------------------------ Kommandos

  async #roundtrip(cmd) {
    if (!this.session) throw new Error('Nicht verbunden');
    await sleep(25 + Math.random() * 40);
    this.log('frame', `${cmd} (Simulation)`);
  }

  async handshake() {
    await this.#roundtrip('HU');
    return this.session;
  }

  async readStatus() {
    await this.#roundtrip('HX');
    return { ...this.status };
  }

  async readNumeric(reg) {
    await this.#roundtrip('HR');
    if (!this.regs.has(reg)) throw new Error(`Register ${reg} nicht vorhanden`);
    return this.regs.get(reg);
  }

  async writeNumeric(reg, value) {
    await this.#roundtrip('HW');
    this.regs.set(reg, value);
    return true;
  }

  async readString(reg) {
    await this.#roundtrip('HA');
    return this.names.get(reg) ?? '';
  }

  async writeString(reg, text) {
    await this.#roundtrip('HB');
    this.names.set(reg, text);
    return true;
  }

  async startProcess(id) {
    await this.#roundtrip('HE');
    if (id !== F9101.WRITE_PRECONDITION) throw new Error('Maschine hat HE abgelehnt (NACK)');
    if (!this.#ready()) throw new Error('Maschine hat HE abgelehnt (NACK)');
    return true;
  }

  async startBrew(selector, mode, useTemp) {
    await this.#roundtrip('HE');
    if (!this.#ready()) throw new Error('Maschine hat HE abgelehnt (NACK)');
    let sel = selector;
    let recipe;
    if (useTemp) {
      sel = this.regs.get(F9101.TEMP_TYPE_REGISTER) ?? 0;
      recipe = Object.fromEntries(F9101.FIELDS.map((f) => [f.key, this.regs.get(F9101.TEMP_TYPE_REGISTER + f.remote) ?? 0]));
    } else if (selector >= F9101.FIRST_MYCOFFEE_SELECTOR) {
      const slot = selector - F9101.FIRST_MYCOFFEE_SELECTOR;
      sel = this.regs.get(20000 + slot * 100 + 3) ?? 1;
      recipe = { ...BASE, ...DEFAULT_RECIPES[sel] };
    } else {
      recipe = { ...BASE, ...DEFAULT_RECIPES[sel] };
    }
    this.#runBrew(sel, recipe);
    return true;
  }

  async cancelProcess() {
    await this.#roundtrip('HZ');
    this.cancelled = true;
    return true;
  }

  async confirmPrompt() {
    await this.#roundtrip('HY');
    return true;
  }

  // ------------------------------------------------------------ Simulation

  #ready() {
    return this.status.process === 3 && this.status.message === 0;
  }

  /** Für die Demo-Steuerung: Störmeldung setzen (0 = keine). */
  setMessage(code) {
    this.status = { ...this.status, message: code };
  }

  async #runBrew(sel, r) {
    this.cancelled = false;
    const cups = r.two_cups ? 2 : 1;
    const phases = [];
    if (r.coffee_amount) phases.push([2, 2200], [5, 1500 + r.coffee_amount * 30 * cups]);
    if (r.water_amount) phases.push([9, 1000 + r.water_amount * 12]);
    if (r.milk_amount || r.milk_foam_amount) phases.push([7, 1500 + ((r.milk_amount ?? 0) + (r.milk_foam_amount ?? 0)) * 14]);
    const total = phases.reduce((a, [, ms]) => a + ms, 0);
    let done = 0;
    for (const [sub, ms] of phases) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (this.cancelled) {
          this.status = { process: 3, subProcess: 0, message: 254, progress: 0 };
          setTimeout(() => this.setMessage(0), 2500);
          return;
        }
        const p = Math.min(100, Math.round(((done + (Date.now() - t0)) / total) * 100));
        this.status = { process: 4, subProcess: sub, message: 0, progress: p };
        await sleep(120);
      }
      done += ms;
    }
    // Zähler fortschreiben
    const inc = (reg, n = 1) => this.regs.set(reg, (this.regs.get(reg) ?? 0) + n);
    inc(200 + sel, cups);
    inc(213, cups);
    inc(238);
    if (r.coffee_amount) this.beanGrams -= 9 * cups * (1 + (r.strength ?? 2) * 0.1);
    [600, 610, 620].forEach((reg) => this.regs.set(reg, Math.min(100, (this.regs.get(reg) ?? 0) + 1)));
    this.status = { process: 3, subProcess: 0, message: this.beanGrams < 15 ? 6 : 0, progress: 100 };
  }

  #startTicker() {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      if (this.status.process === 3 && this.status.progress) this.status = { ...this.status, progress: 0 };
    }, 3000);
  }

  /** Demo: Bohnen nachgefüllt. */
  refillBeans() {
    this.beanGrams = 250;
    if (this.status.message === 6) this.setMessage(0);
  }
}
