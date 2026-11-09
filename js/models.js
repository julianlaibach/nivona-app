// Modell- und Registertabellen. Quelle: esp-coffee-bridge docs/NIVONA.md und
// src/nivona.cpp. `verified` kennzeichnet, ob die Bridge die Familie live bzw.
// vollständig unterstützt – neuere NIVONA-Connect-Plattformen sind nur aus der
// App rekonstruiert.

import * as F9101 from './family9101.js';

const HARDNESS = ['weich', 'mittel', 'hart', 'sehr hart'];
const OFF_ON = ['aus', 'an'];
const TEMP = ['normal', 'hoch', 'max', 'individuell'];
const PROFILE = ['dynamisch', 'konstant', 'intensiv', 'individuell'];
const PROFILE_1040 = ['dynamisch', 'konstant', 'intensiv', 'quick', 'individuell'];
const AUTO_OFF_STD = ['10 min', '30 min', '1 h', '2 h', '4 h', '6 h', '8 h', '10 h', '12 h', 'aus'];
const AUTO_OFF_LONG = ['10 min', '30 min', '1 h', '2 h', '4 h', '6 h', '8 h', '10 h', '12 h', '14 h', '16 h'];
const opts = (labels) => labels.map((l, value) => (typeof l === 'object' ? l : { value, label: l }));
// NIVO 8000: der letzte Wert ist 0x0010 (nicht 10) – so in App und Bridge hinterlegt.
const AUTO_OFF_8000 = [...AUTO_OFF_LONG.slice(0, 10), { value: 0x10, label: '16 h' }];

const S = (id, label, options) => ({ id, label, options: options ? opts(options) : null });

const SETTINGS = {
  600: [S(101, 'Wasserhärte', HARDNESS), S(102, 'Temperatur', TEMP), S(103, 'Ausschaltspülen', OFF_ON), S(104, 'Auto-Aus', AUTO_OFF_STD), S(106, 'Profil', PROFILE)],
  8000: [S(101, 'Wasserhärte', HARDNESS), S(103, 'Ausschaltspülen', OFF_ON), S(104, 'Auto-Aus', AUTO_OFF_8000), S(105, 'Kaffeetemperatur', OFF_ON)],
  900: [S(102, 'Wasserhärte', HARDNESS), S(103, 'Ausschaltspülen', OFF_ON), S(104, 'Energiesparen', OFF_ON), S(105, 'Tankbeleuchtung', OFF_ON),
    S(106, 'Tanklicht-Farbe', ['rot', 'orange', 'gelb', 'grün', 'cyan', 'blau', 'magenta', 'weiß', 'disco']), S(107, 'Tanklicht-Helligkeit', ['normal', 'hell', 'maximal']),
    S(108, 'Tastensperre', OFF_ON), S(109, 'Auto-Aus', AUTO_OFF_LONG), S(110, 'Auto-An deaktiviert', OFF_ON), S(111, 'Auto-An Stunde'), S(112, 'Auto-An Minute')],
  '900-light': [S(102, 'Wasserhärte', HARDNESS), S(104, 'Energiesparen', OFF_ON), S(109, 'Auto-Aus', AUTO_OFF_LONG), S(110, 'Auto-An deaktiviert', OFF_ON), S(111, 'Auto-An Stunde'), S(112, 'Auto-An Minute')],
  1030: [S(102, 'Wasserhärte', HARDNESS), S(103, 'Ausschaltspülen', OFF_ON), S(104, 'Tassenwärmer', ['eco', 'aktiv']), S(105, 'Milchprodukte aktiv', OFF_ON),
    S(106, 'Direktstart deaktiviert', OFF_ON), S(107, 'Tastensperre', OFF_ON), S(109, 'Auto-Aus', AUTO_OFF_STD), S(110, 'Auto-An deaktiviert', OFF_ON),
    S(111, 'Auto-An Stunde'), S(112, 'Auto-An Minute'), S(113, 'Profil', PROFILE), S(114, 'Kaffeetemperatur', TEMP), S(115, 'Wassertemperatur', TEMP),
    S(116, 'Milchtemperatur', ['hoch', 'max', 'individuell'])],
  1040: [S(102, 'Wasserhärte', HARDNESS), S(103, 'Ausschaltspülen', OFF_ON), S(109, 'Auto-Aus', AUTO_OFF_STD), S(113, 'Profil', PROFILE_1040),
    S(114, 'Kaffeetemperatur', TEMP), S(115, 'Wassertemperatur', TEMP), S(116, 'Milchtemperatur', ['normal', 'hoch', 'heiß', 'max', 'individuell']),
    S(117, 'Milchschaumtemperatur', ['warm', 'max', 'individuell']), S(118, 'Einschaltspülen', OFF_ON), S(119, 'Aufschäumer-Laufzeit', ['10 min', '20 min', '30 min', '40 min'])],
  EF1109: F9101.SETTINGS,
  EF1187: [S(100, 'Sprache'), S(101, 'Wasserhärte'), S(104, 'Auto-Aus'), S(105, 'Milchgetränke aktiv'), S(106, 'Big-Picture-Modus'),
    S(107, 'Max. Bezüge bis Brühgruppen-Spülung'), S(108, 'Filter eingesetzt')],
  EF1190: [S(100, 'Sprache'), S(102, 'Auto-Aus'), S(119, 'Wasserhärte'), S(120, 'Extreme-Modus'), S(122, 'QuickSelect'),
    S(125, 'Max. Bezüge bis Brühgruppen-Spülung'), S(128, 'Milch-Doppeltasse'), S(129, 'Filter eingesetzt')],
};
SETTINGS[700] = SETTINGS[600];
SETTINGS['79x'] = SETTINGS[600].filter((s) => s.id !== 103); // Ausschaltspülen nicht auf 79x

const R = (selector, name) => ({ selector, name });
const RECIPES = {
  600: [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Milchschaum'), R(5, 'Heißwasser')],
  700: [R(0, 'Espresso'), R(1, 'Café Crème'), R(2, 'Lungo'), R(3, 'Americano'), R(4, 'Cappuccino'), R(5, 'Latte Macchiato'), R(6, 'Milch'), R(7, 'Heißwasser')],
  '79x': [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(5, 'Latte Macchiato'), R(6, 'Milch'), R(7, 'Heißwasser')],
  900: [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Caffè Latte'), R(5, 'Latte Macchiato'), R(6, 'Heiße Milch'), R(7, 'Heißwasser')],
  1030: [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Caffè Latte'), R(5, 'Latte Macchiato'), R(6, 'Heißwasser'), R(7, 'Warme Milch'), R(8, 'Heiße Milch'), R(9, 'Milchschaum')],
  1040: [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Caffè Latte'), R(5, 'Latte Macchiato'), R(6, 'Heißwasser'), R(7, 'Warme Milch'), R(8, 'Milchschaum')],
  8000: [R(0, 'Espresso'), R(1, 'Kaffee'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Caffè Latte'), R(5, 'Latte Macchiato'), R(6, 'Milch'), R(7, 'Heißwasser')],
  EF1109: F9101.RECIPES,
  EF1187: [R(0, 'Espresso'), R(1, 'Lungo'), R(2, 'Americano'), R(3, 'Cappuccino'), R(4, 'Caffè Latte'), R(5, 'Latte Macchiato'), R(6, 'Milch'), R(7, 'Wasser'),
    R(8, 'Chilled Espresso'), R(9, 'Chilled Lungo'), R(10, 'Chilled Americano'), R(11, 'Espresso Macchiato'), R(12, 'Kaffeekanne'), R(13, 'Americano-Kanne')],
};
RECIPES['900-light'] = RECIPES[900];
RECIPES.EF1190 = RECIPES.EF1109;
const CHILLED_8000 = [R(8, 'Chilled Espresso'), R(9, 'Chilled Lungo'), R(10, 'Chilled Americano')];

// Offsets relativ zur Rezeptbasis (Standard: 10000 + sel*100, Scratch: 9001).
const F = (key, label, offset, kind = 'code') => ({ key, label, offset, kind });
const LAYOUTS = {
  600: [F('strength', 'Stärke', 1), F('profile', 'Profil', 2), F('temperature', 'Temperatur', 3), F('twoCups', 'Zwei Tassen', 4),
    F('coffeeMl', 'Kaffee', 5, 'ml'), F('waterMl', 'Wasser', 6, 'ml'), F('foamMl', 'Milchschaum', 8, 'ml'), F('preparation', 'Zubereitung', 9)],
  700: [F('strength', 'Stärke', 1), F('profile', 'Profil', 2), F('temperature', 'Temperatur', 3), F('twoCups', 'Zwei Tassen', 4),
    F('coffeeMl', 'Kaffee', 5, 'ml'), F('waterMl', 'Wasser', 6, 'ml'), F('milkMl', 'Milch', 7, 'ml'), F('foamMl', 'Milchschaum', 8, 'ml')],
  900: [F('strength', 'Stärke', 1), F('profile', 'Profil', 2), F('preparation', 'Zubereitung', 3), F('twoCups', 'Zwei Tassen', 4),
    F('coffeeTemp', 'Kaffeetemp.', 5), F('waterTemp', 'Wassertemp.', 6), F('milkTemp', 'Milchtemp.', 7), F('foamTemp', 'Schaumtemp.', 8),
    F('coffeeMl', 'Kaffee', 9, 'ml'), F('waterMl', 'Wasser', 10, 'ml'), F('milkMl', 'Milch', 11, 'ml'), F('foamMl', 'Milchschaum', 12, 'ml'), F('overallTemp', 'Gesamttemp.', 13)],
};
LAYOUTS['79x'] = LAYOUTS[8000] = LAYOUTS[700];
LAYOUTS['900-light'] = LAYOUTS[900];
LAYOUTS[1030] = LAYOUTS[1040] = LAYOUTS[900].filter((f) => f.key !== 'overallTemp');

const ST = (id, label, kind = 'count') => ({ id, label, kind });
const MAINT = [ST(600, 'Entkalken', 'percent'), ST(601, 'Entkalken fällig', 'flag'), ST(610, 'Brühgruppe reinigen', 'percent'), ST(611, 'Brühgruppe fällig', 'flag'),
  ST(620, 'Aufschäumer reinigen', 'percent'), ST(621, 'Aufschäumer fällig', 'flag'), ST(640, 'Filter', 'percent'), ST(641, 'Filterwechsel fällig', 'flag')];
const STATS = {
  8000: [ST(200, 'Espresso'), ST(201, 'Kaffee'), ST(202, 'Americano'), ST(203, 'Cappuccino'), ST(204, 'Caffè Latte'), ST(205, 'Latte Macchiato'),
    ST(206, 'Warme Milch'), ST(207, 'Heißwasser'), ST(208, 'My Coffee'), ST(209, 'Dampf-/Schaumgetränke'), ST(210, 'Pulverkaffee'), ST(213, 'Getränke gesamt'),
    ST(214, 'Reinigungen Kaffeesystem'), ST(215, 'Reinigungen Aufschäumer'), ST(216, 'Spülungen'), ST(219, 'Filterwechsel'), ST(220, 'Entkalkungen'),
    ST(221, 'Bezüge per App'), ...MAINT, ST(642, 'Filter aktiv', 'flag')],
  700: [ST(200, 'Espresso'), ST(201, 'Café Crème'), ST(202, 'Lungo'), ST(203, 'Americano'), ST(204, 'Cappuccino'), ST(205, 'Latte Macchiato'), ST(206, 'Milch'),
    ST(207, 'Heißwasser'), ST(208, 'My Coffee'), ST(213, 'Getränke gesamt'), ST(214, 'Reinigungen Brühgruppe'), ST(215, 'Reinigungen Aufschäumer'),
    ST(216, 'Spülungen'), ST(219, 'Filterwechsel'), ST(220, 'Entkalkungen'), ST(221, 'Bezüge per App'), ...MAINT, ST(105, 'Filter aktiv', 'flag')],
  '79x': [ST(200, 'Espresso'), ST(201, 'Kaffee'), ST(202, 'Americano'), ST(203, 'Cappuccino'), ST(205, 'Latte Macchiato'), ST(206, 'Milch'), ST(207, 'Heißwasser'),
    ST(208, 'My Coffee'), ST(213, 'Getränke gesamt'), ST(105, 'Filter aktiv', 'flag')],
  600: [ST(200, 'Espresso'), ST(201, 'Kaffee'), ST(203, 'Cappuccino'), ST(204, 'Milchschaum'), ST(206, '—'), ST(207, '—'), ST(208, 'My Coffee'), ST(105, 'Filter aktiv', 'flag')],
  EF1109: F9101.STATS,
};

const FAMILY_META = {
  600: { title: 'NICR 6xx', encoding: 'legacy', brewMode: 0x0b, verified: true },
  700: { title: 'NICR 7xx', encoding: 'legacy', brewMode: 0x0b, verified: true },
  '79x': { title: 'NICR 79x', encoding: 'legacy', brewMode: 0x0b, verified: true },
  900: { title: 'NICR 9xx', encoding: 'utf16le', brewMode: 0x0b, verified: true, fluidScale10: true },
  '900-light': { title: 'NICR 96x/970', encoding: 'utf16le', brewMode: 0x0b, verified: true, fluidScale10: true },
  1030: { title: 'NICR 1030', encoding: 'utf16le', brewMode: 0x0b, verified: true },
  1040: { title: 'NICR 1040', encoding: 'utf16le', brewMode: 0x0b, verified: true },
  8000: { title: 'NIVO 8000', encoding: 'utf16le', brewMode: 0x04, verified: true },
  // Eigener Ablauf (plan 'ef1109'): Werte aus melitta-barista-ha, von 9101-Besitzern getestet.
  EF1109: {
    title: 'NIVO 9000 (EF1109)', encoding: 'utf16le', brewMode: F9101.BREW_MODE, verified: true, plan: 'ef1109',
    source: 'melitta-barista-ha v0.96.0b11 (an NIVO 9101 getestet)',
    writePrecondition: F9101.WRITE_PRECONDITION, status: F9101.STATUS,
    myCoffeeStart: F9101.FIRST_MYCOFFEE_SELECTOR, fixedSlots: F9101.MYCOFFEE_SLOTS,
  },
  EF1190: { title: 'NIVO 7101 (EF1190)', encoding: 'utf16le', brewMode: 0x0b, verified: false },
  EF1187: { title: 'NIVO 8141 (EF1187)', encoding: 'utf16le', brewMode: 0x04, verified: false },
};

// Präfix des BLE-Gerätenamens -> [Familie, MyCoffee-Slots, Extras]
const PREFIXES = [
  ['9101', 'EF1109', 16], ['9103', 'EF1109', 16], ['7101', 'EF1190', 17], ['8141', 'EF1187', 9],
  ['8101', 8000, 9], ['8103', 8000, 9], ['8107', 8000, 9, { chilled: true }], ['8111', 8000, 9, { chilled: true }],
  ['8112', 8000, 9, { chilled: true }], ['8113', 8000, 9, { chilled: true }], ['8115', 8000, 9, { chilled: true }],
  ['1030', 1030, 18], ['1040', 1040, 18],
  ['660', 600, 1], ['670', 600, 5], ['675', 600, 5], ['680', 600, 5],
  ['756', 700, 1], ['758', 700, 1], ['759', 700, 1], ['768', 700, 1], ['769', 700, 1], ['778', 700, 1], ['779', 700, 1],
  ['788', 700, 5], ['789', 700, 5],
  ...['790', '791', '792', '793', '794', '795', '796', '797', '799'].map((p) => [p, '79x', 5]),
  ['920', 900, 9], ['930', 900, 9], ['960', '900-light', 9], ['965', '900-light', 9], ['970', '900-light', 9],
];

/** Alle bekannten Namenspräfixe (für den requestDevice-Filter). */
// Neuere Maschinen melden sich mit Markenpräfix, z. B. "NIVO 9103" statt "9103…".
// namePrefix ist in Web Bluetooth case-sensitiv, daher mehrere Schreibweisen.
const BRAND_PREFIXES = ['NIVO', 'Nivo', 'nivo', 'NICR', 'Nicr', 'NIVONA', 'Nivona'];
export const NAME_PREFIXES = [...BRAND_PREFIXES, ...PREFIXES.map((p) => p[0])];

/** Entfernt Markenpräfix und Trenner: "NIVO 9103" -> "9103", "NICR_756…" -> "756…". */
export function normalizeDeviceName(name) {
  return (name ?? '').trim().replace(/^(NIVONA|NIVO|NICR)[\s_\-:]*/i, '');
}

export const FAMILY_KEYS = Object.keys(FAMILY_META);

export function familyInfo(familyKey, extras = {}) {
  const meta = FAMILY_META[familyKey];
  if (!meta) return null;
  let recipes = RECIPES[familyKey] ?? [];
  if (extras.chilled && familyKey === 8000) recipes = recipes.concat(CHILLED_8000);
  return {
    familyKey,
    ...meta,
    recipes,
    settings: SETTINGS[familyKey] ?? [],
    stats: STATS[familyKey] ?? STATS[8000],
    statsVerified: Boolean(STATS[familyKey]),
    layout: LAYOUTS[familyKey] ?? null,
    myCoffeeSlots: meta.fixedSlots ?? extras.slots ?? 0,
  };
}

/** Ermittelt das Modell aus Gerätename / Seriennummer (z. B. "756573071020106-----"). */
export function detectModel(name) {
  const n = normalizeDeviceName(name);
  const hit = [...PREFIXES].sort((a, b) => b[0].length - a[0].length).find(([p]) => n.startsWith(p));
  if (!hit) return null;
  const [prefix, family, slots, extras = {}] = hit;
  return { prefix, ...familyInfo(family, { slots, ...extras }) };
}

export const PROCESS_LABELS = { 3: 'bereit', 8: 'bereit', 4: 'Getränk wird zubereitet', 11: 'Getränk wird zubereitet' };
export const MESSAGE_LABELS = {
  0: '—',
  1: 'Brühgruppe entnommen',
  2: 'Schalen fehlen',
  3: 'Schalen leeren',
  4: 'Wasser auffüllen',
  5: 'Pulverschacht schließen',
  6: 'Bohnen auffüllen',
  11: 'Tasse unter Aufschäumer stellen und Ventil öffnen',
  20: 'Spülen erforderlich',
};

const DEFAULT_STATUS = { ready: [3, 8], product: [4, 11], confirmable: [11, 20], messages: MESSAGE_LABELS, subProcesses: {} };

/** Statusprofil der Familie (EF1109 hat eigene Codes). */
export function statusProfile(model) {
  return model?.status ?? DEFAULT_STATUS;
}

export function summarizeStatus(s, model) {
  if (!s) return { tone: 'idle', text: 'unbekannt' };
  const p = statusProfile(model);
  const msg = p.messages[s.message];
  if (p.confirmable.includes(s.message)) return { tone: 'confirm', text: msg };
  if (s.message !== 0) return { tone: 'warn', text: msg ?? `Meldung ${s.message}` };
  if (p.ready.includes(s.process)) return { tone: 'ok', text: 'Bereit' };
  if (p.product.includes(s.process)) return { tone: 'busy', text: 'Getränk wird zubereitet' };
  return { tone: 'busy', text: `Prozess ${s.process}` };
}
