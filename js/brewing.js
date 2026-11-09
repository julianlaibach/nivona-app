// Gemeinsamer Brühablauf für Demo-Konsole und App.
// Familien mit plan 'ef1109' (NIVO 9000) nutzen den von melitta-barista-ha
// übernommenen Ablauf, alle anderen den der esp-coffee-bridge.

import * as F9101 from './family9101.js';
import { summarizeStatus, statusProfile } from './models.js';

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const startOpts = (model) => ({ productProcesses: statusProfile(model).product });

/**
 * Editierbare Rezeptfelder mit Lese- (Standardrezept) und Schreibregister
 * (temporäres Rezept). null = kein Layout bekannt.
 */
export function recipeFieldsFor(model, selector) {
  if (model.plan === 'ef1109') return F9101.recipeFields(selector);
  if (!model.layout) return null;
  const base = 10000 + selector * 100;
  return model.layout.map((f) => ({
    key: f.key,
    label: f.kind === 'ml' ? `${f.label} (ml)` : f.label,
    ml: f.kind === 'ml',
    readReg: base + f.offset,
    writeReg: 9001 + f.offset,
    scale10: f.kind === 'ml' && model.fluidScale10,
  }));
}

/** Liest die aktuellen Werte des gespeicherten Rezepts (Anzeige-Einheiten). */
export async function readRecipeValues(machine, model, selector) {
  const fields = recipeFieldsFor(model, selector) ?? [];
  const values = {};
  for (const f of fields) {
    try {
      const v = await machine.readNumeric(f.readReg);
      values[f.key] = f.scale10 ? v / 10 : v;
    } catch {
      /* Feld auf diesem Gerät nicht lesbar */
    }
  }
  return { fields, values };
}

/** Prüft Anzeige-Werte gegen die Feldbereiche und rechnet in Registerwerte um. */
export function toRegisterValues(fields, values) {
  const out = {};
  for (const f of fields) {
    if (values[f.key] == null || values[f.key] === '') continue;
    const v = Number(values[f.key]);
    if (!Number.isInteger(f.scale10 ? v * 10 : v)) throw new Error(`${f.label}: ganze Zahl erwartet`);
    if (f.min != null && (v < f.min || v > f.max)) throw new Error(`${f.label}: erlaubt ${f.min}–${f.max}, eingegeben ${v}`);
    out[f.key] = f.scale10 ? Math.round(v * 10) : v;
  }
  return out;
}

/** HE [00, 98, …] bei Familien mit Schreib-Vorbedingung, wartet auf ACK. */
export async function prepareWrite(machine, model, log = () => {}) {
  if (!model.writePrecondition) return;
  log(`Vorbereitung: HE-Prozess ${model.writePrecondition} (JOB_RETURN_HOME)`);
  await machine.startProcess(model.writePrecondition, 0);
}

/**
 * Startet ein Getränk.
 * @param values  Anzeige-Werte aus dem Editor oder null (= gespeichertes Rezept)
 * @param opts.force  bei nicht bereiter Maschine trotzdem starten (nur Legacy)
 */
export async function brewDrink(machine, model, recipe, values, { mode = model.brewMode, log = () => {}, force = false } = {}) {
  const fields = values ? recipeFieldsFor(model, recipe.selector) : null;
  const regValues = fields ? toRegisterValues(fields, values) : null;

  const status = await machine.readStatus();
  const sum = summarizeStatus(status, model);
  if (sum.tone !== 'ok' && (model.writePrecondition || !force)) {
    throw Object.assign(new Error(`Maschine nicht bereit: ${sum.text}`), { status });
  }

  if (model.plan === 'ef1109') {
    await prepareWrite(machine, model, log);
    if (regValues) {
      const template = { ...F9101.REMOTE_DEFAULTS, ...regValues, ...(F9101.REQUIRED_OVERRIDES[recipe.selector] ?? {}) };
      await machine.writeNumeric(F9101.TEMP_TYPE_REGISTER, recipe.selector);
      for (const f of F9101.FIELDS) {
        await pause(80);
        await machine.writeNumeric(F9101.TEMP_TYPE_REGISTER + f.remote, template[f.key]);
      }
      await machine.startBrew(F9101.TEMP_SELECTOR, mode, true, startOpts(model));
    } else {
      await machine.startBrew(recipe.selector, mode, false, startOpts(model));
    }
  } else {
    if (regValues) for (const f of fields) if (f.key in regValues) await machine.writeNumeric(f.writeReg, regValues[f.key]);
    await machine.writeNumeric(9001, recipe.selector);
    await machine.startBrew(recipe.selector, mode, true);
  }
  log(`${recipe.name} gestartet (${regValues ? 'angepasst' : 'gespeichertes Rezept'})`);
}

/** MyCoffee-Platz (0-basiert) starten – nur Familien mit myCoffeeStart. */
export async function brewMyCoffee(machine, model, slot, { mode = model.brewMode, log = () => {} } = {}) {
  if (model.myCoffeeStart == null) throw new Error('MyCoffee-Start ist für diese Familie nicht bekannt');
  const status = await machine.readStatus();
  const sum = summarizeStatus(status, model);
  if (sum.tone !== 'ok') throw new Error(`Maschine nicht bereit: ${sum.text}`);
  await prepareWrite(machine, model, log);
  await machine.startBrew(model.myCoffeeStart + slot, mode, false, startOpts(model));
  log(`MyCoffee #${slot + 1} gestartet`);
}

/** Liest Namen/Typ/Aktiv eines MyCoffee-Platzes (0-basiert). */
export async function readMyCoffee(machine, model, slot) {
  const base = 20000 + slot * 100;
  const enabled = await machine.readNumeric(base);
  const name = await machine.readString(base + 2, model.encoding);
  const type = await machine.readNumeric(base + 3);
  return { slot, enabled: Boolean(enabled), name, type, recipe: model.recipes.find((r) => r.selector === type) ?? null };
}
