// Verbindet Maschine (Web Bluetooth oder Simulator) mit der Oberfläche.
// Events: 'connection' · 'status' · 'brew' (detail: {phase, ...}) · 'stats' · 'error'

import { NivonaMachine } from '../../js/machine.js';
import { NAME_PREFIXES, detectModel, familyInfo, summarizeStatus, statusProfile } from '../../js/models.js';
import { brewDrink, brewMyCoffee, readRecipeValues, readMyCoffee, recipeFieldsFor } from '../../js/brewing.js';
import { SimulatedMachine } from './sim.js';
import { store } from './store.js';

const PHASE = { 2: 'Bohnen werden gemahlen', 5: 'Kaffee wird gebrüht', 7: 'Milch wird aufgeschäumt', 8: 'Milch wird aufgeschäumt', 9: 'Wasser läuft' };

class Controller extends EventTarget {
  constructor() {
    super();
    this.machine = null;
    this.model = null;
    this.status = null;
    this.stats = {};
    this.brewing = null; // { recipe, startedAt, sawProduct }
    this.timer = null;
    this.busy = false;
  }

  get connected() {
    return Boolean(this.machine?.connected && this.machine.session);
  }

  get simulated() {
    return this.machine instanceof SimulatedMachine;
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  static bleSupported() {
    return NivonaMachine.isSupported();
  }

  // ---------------------------------------------------------- Verbindung

  async connect(mode, onStep) {
    this.machine = mode === 'demo' ? new SimulatedMachine() : new NivonaMachine();
    this.machine.addEventListener('disconnected', () => {
      this.#stopPolling();
      this.emit('connection', { connected: false });
    });
    if (mode === 'demo') await this.machine.requestDevice();
    else await this.machine.requestDevice({ namePrefixes: NAME_PREFIXES });
    await this.machine.connect((text, id) => onStep?.(text, id));
    const info = this.machine.info;
    this.model = detectModel(info.ad06Name || info.bleName || info.serialHL) ?? familyInfo('EF1109', {});
    store.set({ mode });
    this.emit('connection', { connected: true });
    await this.refreshStats().catch(() => {});
    this.#startPolling();
    return info;
  }

  disconnect() {
    this.#stopPolling();
    this.machine?.disconnect();
  }

  get machineName() {
    const t = this.model?.prefix ?? '';
    return t.length === 4 ? `NIVO ${t[0]}'${t.slice(1)}` : t ? `NICR ${t}` : 'NIVONA';
  }

  // ---------------------------------------------------------- Status

  #startPolling() {
    this.#stopPolling();
    const tick = async () => {
      if (!this.connected) return;
      if (!this.busy) await this.poll();
      this.timer = setTimeout(tick, this.brewing ? 700 : 2000);
    };
    tick();
  }

  #stopPolling() {
    clearTimeout(this.timer);
    this.timer = null;
  }

  async poll() {
    try {
      const s = await this.machine.readStatus({ quiet: true });
      const prev = this.status;
      this.status = s;
      this.#trackBrew(prev, s);
      this.emit('status', this.view());
    } catch (e) {
      this.emit('error', e);
    }
  }

  /** Aufbereiteter Status für die Oberfläche. */
  view() {
    const s = this.status;
    const p = statusProfile(this.model);
    const sum = summarizeStatus(s, this.model);
    return {
      raw: s,
      tone: sum.tone,
      text: sum.text,
      ready: sum.tone === 'ok',
      producing: s ? p.product.includes(s.process) : false,
      phase: s ? PHASE[s.subProcess] ?? p.subProcesses?.[s.subProcess] ?? null : null,
      progress: s?.progress ?? 0,
    };
  }

  #trackBrew(prev, s) {
    if (!this.brewing) return;
    const p = statusProfile(this.model);
    if (p.product.includes(s.process)) {
      this.brewing.sawProduct = true;
      this.emit('brew', { phase: 'running', ...this.brewing, view: this.view() });
      return;
    }
    const age = Date.now() - this.brewing.startedAt;
    if (this.brewing.sawProduct || age > 20000) {
      const ok = this.brewing.sawProduct && s.message === 0;
      const done = this.brewing;
      this.brewing = null;
      this.emit('brew', { phase: ok ? 'done' : 'failed', ...done, view: this.view() });
      this.refreshStats().catch(() => {});
    }
  }

  // ---------------------------------------------------------- Getränke

  recipes() {
    return (this.model ?? familyInfo('EF1109', {}))?.recipes ?? [];
  }

  async recipe(selector) {
    return this.#exclusive(() => readRecipeValues(this.machine, this.model, selector));
  }

  fields(selector) {
    return recipeFieldsFor(this.model, selector) ?? [];
  }

  /** values = null → gespeichertes Rezept. */
  async brew(recipe, values) {
    await this.#exclusive(() => brewDrink(this.machine, this.model, recipe, values));
    this.brewing = { recipe, startedAt: Date.now(), sawProduct: false };
    this.emit('brew', { phase: 'started', ...this.brewing, view: this.view() });
    this.#startPolling();
  }

  async brewSlot(slot, name) {
    await this.#exclusive(() => brewMyCoffee(this.machine, this.model, slot));
    this.brewing = { recipe: { name, selector: -1 }, startedAt: Date.now(), sawProduct: false };
    this.emit('brew', { phase: 'started', ...this.brewing, view: this.view() });
    this.#startPolling();
  }

  async cancel() {
    await this.machine.cancelProcess();
  }

  async confirm() {
    await this.machine.confirmPrompt();
  }

  async myCoffee() {
    const n = this.model?.myCoffeeSlots ?? 0;
    const out = [];
    await this.#exclusive(async () => {
      for (let i = 0; i < n; i++) {
        try {
          const mc = await readMyCoffee(this.machine, this.model, i);
          if (mc.enabled || mc.name) out.push(mc);
        } catch {
          /* leerer Platz */
        }
      }
    });
    return out;
  }

  // ---------------------------------------------------------- Statistik & Pflege

  async refreshStats() {
    const stats = {};
    await this.#exclusive(async () => {
      for (const s of this.model?.stats ?? []) {
        try {
          stats[s.id] = await this.machine.readNumeric(s.id);
        } catch {
          /* nicht vorhanden */
        }
      }
    });
    this.stats = stats;
    if (stats[213] != null) store.syncCounter(stats[213]);
    this.emit('stats', stats);
    return stats;
  }

  /** Pflegepunkte mit Prozentwert (Annahme: 100 % = fällig). */
  care() {
    return (this.model?.stats ?? [])
      .filter((s) => s.kind === 'percent' && this.stats[s.id] != null)
      .map((s) => ({ ...s, value: this.stats[s.id] }));
  }

  dueCare() {
    return this.care().filter((c) => c.value >= 90).map((c) => c.label);
  }

  // ---------------------------------------------------------- Einstellungen

  async readSetting(s) {
    const v = await this.#exclusive(() => this.machine.readNumeric(s.id));
    return s.options ? v & 0xffff : v;
  }

  async writeSetting(s, value) {
    await this.#exclusive(async () => {
      if (this.model.writePrecondition) await this.machine.startProcess(this.model.writePrecondition, 0);
      await this.machine.writeNumeric(s.id, value);
    });
  }

  async #exclusive(fn) {
    while (this.busy) await new Promise((r) => setTimeout(r, 50));
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
}

export const controller = new Controller();
