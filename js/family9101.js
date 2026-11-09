// NIVO 9000 / Plattform EF1109 (9101, 9103).
//
// Übernommen aus dzerik/melitta-barista-ha v0.96.0b11,
// custom_components/melitta_barista/brands/nivona/_family_9101.py, _status.py,
// _ble_commands.py und protocol.py. Dort von Besitzern einer NIVO 9101 an der
// echten Maschine getestet (Issue #56, Stand 06.11.2026). Laut NIVONA Connect
// 1.2.0 ist die 9101 ein Klon der 9103-Spezifikation.

// ----------------------------------------------------------------- Rezepte

export const RECIPES = [
  'Lungo', 'Espresso', 'Americano', 'Caffè Latte', 'Cappuccino', 'Espresso Macchiato', 'Flat White',
  'Latte Macchiato', 'Milch', 'Heißwasser', 'Chilled Lungo', 'Chilled Espresso', 'Chilled Americano',
].map((name, selector) => ({ selector, name }));

/** Basis des gespeicherten Standardrezepts (Espresso und Lungo sind vertauscht). */
export const STANDARD_BASES = { 0: 10100, 1: 10000 };
for (let i = 2; i <= 12; i++) STANDARD_BASES[i] = 10000 + i * 100;

/** Welche Felder (Standard-Offsets) es im gespeicherten Rezept je Getränk gibt. */
export const STANDARD_OFFSETS = {
  0: [3, 4, 5, 11, 12],
  1: [3, 4, 5, 11, 12],
  2: [3, 4, 5, 6, 11, 12, 13],
  3: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14],
  4: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
  5: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15],
  6: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15],
  7: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15],
  8: [7, 8, 9, 10, 11, 14, 15],
  9: [11, 13],
  10: [3, 4, 11, 12],
  11: [3, 4, 11, 12],
  12: [3, 4, 11, 12, 13],
};

/**
 * Felder mit Offset im Standardrezept (std), im temporären Rezept ab 9000
 * (remote) und dem Wertebereich aus validate_field().
 */
export const FIELDS = [
  { key: 'strength', label: 'Stärke', std: 3, remote: 1, min: 0, max: 4 },
  { key: 'profile', label: 'Profil', std: 4, remote: 2, min: 0, max: 4, hint: '0 quick · 1 dynamic · 2 constant · 3 harmonic · 4 intense' },
  { key: 'coffee_temperature', label: 'Kaffeetemperatur', std: 5, remote: 3, min: 0, max: 3 },
  { key: 'preparation', label: 'Zubereitung', std: 6, remote: 4, min: 0, max: 3 },
  { key: 'milk_type', label: 'Milchart', std: 7, remote: 5, min: 0, max: 2 },
  { key: 'froth_type', label: 'Schaumart', std: 8, remote: 6, min: 0, max: 1 },
  { key: 'milk_temp_control', label: 'Milchtemp.-Regelung', std: 9, remote: 7, min: 0, max: 1 },
  { key: 'milk_temperature', label: 'Milchtemperatur', std: 10, remote: 8, min: 0, max: 3 },
  { key: 'two_cups', label: 'Zwei Tassen', std: 11, remote: 9, min: 0, max: 1 },
  { key: 'coffee_amount', label: 'Kaffee (ml)', std: 12, remote: 10, min: 20, max: 240, ml: true },
  { key: 'water_amount', label: 'Wasser (ml)', std: 13, remote: 11, min: 20, max: 240, ml: true },
  { key: 'milk_amount', label: 'Milch (ml)', std: 14, remote: 12, min: 20, max: 240, ml: true },
  { key: 'milk_foam_amount', label: 'Milchschaum (ml)', std: 15, remote: 13, min: 20, max: 240, ml: true },
];

/** Vollständige Vorlage für das temporäre Rezept (REMOTE_DEFAULTS). */
export const REMOTE_DEFAULTS = {
  strength: 3, profile: 2, coffee_temperature: 1, preparation: 0, milk_type: 0, froth_type: 0,
  milk_temp_control: 1, milk_temperature: 2, two_cups: 0, coffee_amount: 0, water_amount: 0,
  milk_amount: 0, milk_foam_amount: 0,
};

/** Chilled-Getränke verlangen Profil 5. */
export const REQUIRED_OVERRIDES = { 10: { profile: 5 }, 11: { profile: 5 }, 12: { profile: 5 } };

/** Felder, die der Editor für ein Getränk anzeigt, inkl. Lese-/Schreibregister und Bereich. */
export function recipeFields(selector) {
  const offsets = STANDARD_OFFSETS[selector] ?? [];
  return FIELDS.filter((f) => offsets.includes(f.std)).map((f) => {
    let { min, max } = f;
    if (f.key === 'profile' && REQUIRED_OVERRIDES[selector]) min = max = 5;
    if (f.key === 'preparation') [min, max] = selector === 2 ? [2, 3] : [0, 1];
    if (f.ml) {
      min = selector === 8 ? 0 : selector === 9 ? 50 : selector === 5 && f.key === 'milk_foam_amount' ? 15 : 20;
      max = selector === 9 && f.key === 'water_amount' ? 500 : 240;
    }
    return { ...f, min, max, readReg: STANDARD_BASES[selector] + f.std, writeReg: TEMP_TYPE_REGISTER + f.remote };
  });
}

export const TEMP_TYPE_REGISTER = 9000;
/** HE-Auswahl beim Start aus dem temporären Rezept. */
export const TEMP_SELECTOR = 0;
/** Vor Rezeptschreiben und Starts: HE [00, 98, …] und auf ACK warten. */
export const WRITE_PRECONDITION = 98;
export const BREW_MODE = 0x04;

// ----------------------------------------------------------------- MyCoffee

export const MYCOFFEE_SLOTS = 16;
/** HE-Auswahl für MyCoffee-Platz n (0-basiert): 13 + n. */
export const FIRST_MYCOFFEE_SELECTOR = 13;

// ----------------------------------------------------------------- Status

export const STATUS = {
  ready: [3, -1],
  product: [4],
  confirmable: [],
  messages: {
    1: 'Brühgruppe entnommen', 2: 'Schalen fehlen', 3: 'Schalen leeren', 4: 'Wasser auffüllen',
    5: 'Pulverdeckel schließen', 6: 'Bohnen auffüllen', 7: 'Pulver einfüllen', 8: 'Bitte warten', 9: 'Sonstige Meldung',
    254: 'Prozess abgebrochen', 255: 'Rezept ungültig',
  },
  subProcesses: { 2: 'Mahlen', 5: 'Kaffee', 7: 'Dampf', 8: 'Dampf', 9: 'Wasser' },
};

// ----------------------------------------------------------------- Einstellungen

const OFF_ON = [{ value: 0, label: 'aus' }, { value: 1, label: 'an' }];
const LANGS = ['EN', 'DE', 'FR', 'IT', 'ES', 'PT', 'PL', 'NL', 'RU', 'CS', 'SV', 'ET', 'HU', 'DA', 'LT', 'LV', 'SK', 'NO', 'FI', 'UK', 'KO'];
const o = (pairs) => pairs.map(([value, label]) => ({ value, label }));

export const SETTINGS = [
  { id: 100, label: 'Sprache', options: LANGS.map((label, i) => ({ value: i + 1, label })) },
  { id: 101, label: 'Easy Clean nach', options: [5, 10, 20, 30, 40].map((m) => ({ value: m, label: `${m} min` })) },
  { id: 102, label: 'Auto-Aus', options: o([[10, '10 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [360, '6 h'], [480, '8 h'], [600, '10 h'], [720, '12 h']]) },
  { id: 119, label: 'Wasserhärte', options: o([[0, 'sehr weich'], [1, 'weich'], [2, 'mittel'], [3, 'hart']]) },
  { id: 120, label: 'Extreme-Modus', options: OFF_ON },
  { id: 121, label: 'Big-Picture-Modus', options: o([[0, 'klein'], [1, 'groß']]) },
  { id: 122, label: 'QuickSelect', options: OFF_ON },
  { id: 124, label: 'Flying Picture', options: OFF_ON },
  { id: 125, label: 'Brühgruppen-Spülintervall', options: o([[0, 'aus'], [1, '25'], [2, '50'], [3, '100'], [4, '150']]) },
  { id: 126, label: 'Akzentfarbe', options: o([[14, 'Aqua'], [12, 'Blau'], [13, 'Fuchsia'], [10, 'Lime'], [16, 'Orange'], [9, 'Rot'], [128, 'Spektrum'], [15, 'Weiß'], [11, 'Gelb']]) },
  { id: 127, label: 'Akzent-Helligkeit', options: o([[1, 'niedrig'], [2, 'mittel'], [3, 'hoch']]) },
  { id: 128, label: 'Akzentbeleuchtung', options: OFF_ON },
  { id: 129, label: 'Filter eingesetzt', options: OFF_ON },
];

// ----------------------------------------------------------------- Statistik

const STAT_LABELS = [
  'Lungo', 'Espresso', 'Americano', 'Caffè Latte', 'Cappuccino', 'Espresso Macchiato', 'Flat White', 'Latte Macchiato',
  'Milch', 'Heißwasser', 'Chilled Lungo', 'Chilled Espresso', 'Chilled Americano', 'Getränke gesamt', 'Eine Tasse',
  'Zwei Tassen', 'Pulver', 'Mit Milch', 'Zwei Tassen mit Milch', 'Mit Kaffee', 'Zwei Tassen mit Kaffee', 'Mit Wasser',
  'Zwei Tassen mit Wasser',
  ...['Quick', 'Dynamic', 'Constant', 'Harmonic', 'Intense'].flatMap((p) => ['Kaffee', 'Espresso', 'Cappuccino'].map((d) => `${p} · ${d}`)),
  'Starts per App',
];

export const STATS = [
  ...STAT_LABELS.map((label, i) => ({ id: 200 + i, label, kind: 'count' })),
  ...['Brühvorgänge', 'Wasservorgänge', 'Dampfvorgänge', 'Pulvervorgänge', 'Mahlvorgänge'].map((label, i) => ({ id: 240 + i, label, kind: 'count' })),
  { id: 600, label: 'Entkalken', kind: 'percent' },
  { id: 610, label: 'Brühgruppe reinigen', kind: 'percent' },
  { id: 620, label: 'Aufschäumer reinigen', kind: 'percent' },
  { id: 640, label: 'Filter', kind: 'percent' },
  { id: 650, label: 'Brühgruppe spülen', kind: 'percent' },
];
