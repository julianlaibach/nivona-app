// Lokaler App-Zustand: Onboarding, Favoriten, Bohnen-Schätzung, Erinnerungen.
// In der nativen App später durch Gerätespeicher + System-Benachrichtigungen ersetzt.

const KEY = 'nivona-app-v1';

const DEFAULTS = {
  onboarded: false,
  mode: null, // 'ble' | 'demo'
  favorites: [1, 0, 4, 7],
  beans: {
    containerGrams: 250, // Füllmenge Bohnenbehälter
    gramsPerDrink: 9, // Schätzung je Kaffeebezug
    level: 180, // geschätzt im Behälter
    packsAtHome: 1, // Vorrat
    packGrams: 1000,
    lowThreshold: 50, // „bald leer“
    lastCounter: null, // Stand des Gesamtzählers bei letzter Abrechnung
  },
  reminders: [
    { id: 'beans-refill', kind: 'beans-refill', title: 'Bohnen nachfüllen', enabled: true, auto: true },
    { id: 'beans-buy', kind: 'beans-buy', title: 'Bohnen kaufen', enabled: true, auto: true },
    { id: 'care', kind: 'care', title: 'Pflege fällig (Entkalken, Reinigen, Filter)', enabled: true, auto: true },
  ],
  fired: {}, // id -> Zeitstempel der letzten Auslösung
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULTS), ...data, beans: { ...DEFAULTS.beans, ...data.beans } };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

class Store extends EventTarget {
  constructor() {
    super();
    this.state = load();
  }

  get(key) {
    return this.state[key];
  }

  set(patch) {
    Object.assign(this.state, patch);
    this.#save();
  }

  #save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* privater Modus o. Ä. – App funktioniert trotzdem */
    }
    this.dispatchEvent(new Event('change'));
  }

  reset() {
    this.state = structuredClone(DEFAULTS);
    this.#save();
  }

  // ----------------------------------------------------------- Favoriten

  toggleFavorite(selector) {
    const fav = new Set(this.state.favorites);
    fav.has(selector) ? fav.delete(selector) : fav.add(selector);
    this.set({ favorites: [...fav] });
  }

  // ----------------------------------------------------------- Bohnen

  /** Gleicht den Gesamtzähler der Maschine ab und zieht verbrauchte Bohnen ab. */
  syncCounter(total) {
    const b = { ...this.state.beans };
    if (b.lastCounter != null && total > b.lastCounter) {
      b.level = Math.max(0, b.level - (total - b.lastCounter) * b.gramsPerDrink);
    }
    b.lastCounter = total;
    this.set({ beans: b });
  }

  refillBeans() {
    const b = { ...this.state.beans };
    b.level = b.containerGrams;
    b.packsAtHome = Math.max(0, b.packsAtHome - 1);
    this.set({ beans: b });
    this.clearFired('beans-refill');
  }

  boughtBeans(packs = 1) {
    const b = { ...this.state.beans };
    b.packsAtHome += packs;
    this.set({ beans: b });
    this.clearFired('beans-buy');
  }

  setBeans(patch) {
    this.set({ beans: { ...this.state.beans, ...patch } });
  }

  beanInfo() {
    const b = this.state.beans;
    const cups = Math.floor(b.level / b.gramsPerDrink);
    const pct = Math.round((b.level / b.containerGrams) * 100);
    return { ...b, cups, pct, low: b.level <= b.lowThreshold };
  }

  // ----------------------------------------------------------- Erinnerungen

  addReminder(r) {
    this.set({ reminders: [...this.state.reminders, { id: crypto.randomUUID(), enabled: true, ...r }] });
  }

  updateReminder(id, patch) {
    this.set({ reminders: this.state.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }

  removeReminder(id) {
    this.set({ reminders: this.state.reminders.filter((r) => r.id !== id) });
  }

  clearFired(id) {
    const fired = { ...this.state.fired };
    delete fired[id];
    this.set({ fired });
  }

  /**
   * Prüft alle Erinnerungen und liefert die fälligen (je Erinnerung höchstens
   * einmal, bis sie zurückgesetzt bzw. die Wiederholung erreicht ist).
   */
  dueReminders({ care = [] } = {}) {
    const now = Date.now();
    const beans = this.beanInfo();
    const due = [];
    for (const r of this.state.reminders) {
      if (!r.enabled) continue;
      const fired = this.state.fired[r.id];
      let hit = null;
      if (r.kind === 'beans-refill' && beans.low) hit = `Noch etwa ${beans.cups} Tassen im Bohnenbehälter.`;
      if (r.kind === 'beans-buy' && beans.low && beans.packsAtHome === 0) hit = 'Kein Bohnenvorrat mehr im Haus.';
      if (r.kind === 'care' && care.length) hit = care.join(', ');
      if (r.kind === 'date' && r.at && now >= r.at) hit = r.note || 'Erinnerung';
      if (!hit) continue;
      if (r.kind === 'date') {
        due.push({ ...r, body: hit });
        if (r.repeatDays) this.updateReminder(r.id, { at: r.at + r.repeatDays * 864e5 });
        else this.updateReminder(r.id, { enabled: false });
        continue;
      }
      if (fired && now - fired < 6 * 3600e3) continue; // Auto-Erinnerungen höchstens alle 6 h
      due.push({ ...r, body: hit });
      this.set({ fired: { ...this.state.fired, [r.id]: now } });
    }
    return due;
  }
}

export const store = new Store();
