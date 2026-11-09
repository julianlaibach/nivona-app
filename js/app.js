import { NivonaMachine } from './machine.js';
import { NAME_PREFIXES, FAMILY_KEYS, familyInfo, detectModel, summarizeStatus, statusProfile } from './models.js';
import { recipeFieldsFor, brewDrink, brewMyCoffee as brewMyCoffeeSlot } from './brewing.js';
import { selfTest, fromHex, toHex, HE_FACTORY_RESET_SETTINGS, HE_FACTORY_RESET_RECIPES } from './protocol.js';

const $ = (sel) => document.querySelector(sel);
const machine = new NivonaMachine();
const state = { model: null, slots: 0, pollTimer: null, polling: false, brewing: false, recipe: null, lastStatus: null };

// ------------------------------------------------------------------ UI-Helfer

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null) n.append(c);
  return n;
}

function showError(msg) {
  const box = $('#error');
  box.hidden = !msg;
  box.textContent = msg ?? '';
  if (msg) addLog('err', msg);
}

function showProgress(msg) {
  const box = $('#progress');
  box.hidden = !msg;
  box.textContent = msg ?? '';
}

function setPill(text, tone) {
  const p = $('#connPill');
  p.textContent = text;
  p.className = `pill pill-${tone}`;
}

function updateUi() {
  const connected = machine.connected;
  const session = connected && Boolean(machine.session);
  document.querySelectorAll('[data-needs]').forEach((b) => {
    b.disabled = b.dataset.needs === 'session' ? !session : !connected;
  });
  document.querySelectorAll('.tile').forEach((t) => (t.disabled = !session));
  $('#btnConnect').hidden = connected;
  $('#btnDisconnect').hidden = !connected;
  $('#familySelect').disabled = !connected;
  if (!connected) setPill('getrennt', 'idle');
  else if (session) setPill('verbunden', 'ok');
  else setPill('verbunden · ohne Session', 'busy');
}

/** Führt eine Aktion aus, sperrt den Button und zeigt Fehler an. */
async function action(btn, fn) {
  if (btn) btn.disabled = true;
  showError(null);
  try {
    return await fn();
  } catch (e) {
    showError(e.message ?? String(e));
  } finally {
    if (btn) btn.disabled = false;
    updateUi();
  }
}

// ------------------------------------------------------------------ Log

const logList = $('#log');
function addLog(dir, text) {
  const t = new Date().toLocaleTimeString('de-DE', { hour12: false }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
  const label = { tx: '→', rx: '⇠', frame: '←', sys: '•', err: '✗' }[dir] ?? '·';
  logList.append(el('li', { class: dir }, el('time', {}, t), `${label} ${text}`));
  while (logList.children.length > 600) logList.firstChild.remove();
  logList.scrollTop = logList.scrollHeight;
}
machine.addEventListener('log', (e) => {
  const { dir, text, quiet } = e.detail;
  // Die Status-Abfrage im Hintergrund nicht ins Log spammen.
  if (quiet) return;
  addLog(dir, text);
});
$('#logRaw').addEventListener('change', (e) => logList.classList.toggle('hide-rx', !e.target.checked));
logList.classList.add('hide-rx');
$('#btnLogClear').addEventListener('click', () => logList.replaceChildren());
$('#btnLogCopy').addEventListener('click', () => navigator.clipboard?.writeText(logList.innerText));

// ------------------------------------------------------------------ Verbindung

if (!NivonaMachine.isSupported()) {
  $('#unsupported').hidden = false;
  $('#btnConnect').disabled = true;
}

$('#btnConnect').addEventListener('click', (ev) =>
  action(ev.currentTarget, async () => {
    try {
      await machine.requestDevice({ acceptAll: $('#acceptAll').checked, namePrefixes: NAME_PREFIXES });
    } catch (e) {
      if (e.name === 'NotFoundError') {
        // Dialog abgebrochen – häufigster Grund: Filter greift nicht.
        if (!$('#acceptAll').checked) {
          showProgress('Maschine nicht in der Liste? Häkchen „alle Geräte“ setzen und erneut verbinden. Außerdem: Nivona-App auf dem Handy schließen und Chrome den Bluetooth-Zugriff erlauben (macOS: Systemeinstellungen → Datenschutz → Bluetooth).');
        }
        return;
      }
      throw e;
    }
    setPill('verbinde …', 'busy');
    try {
      await machine.connect((step) => showProgress(step));
    } finally {
      showProgress(null);
    }
    onReady();
  }),
);

$('#btnDisconnect').addEventListener('click', () => machine.disconnect());

machine.addEventListener('disconnected', () => {
  stopPolling();
  renderStatus(null);
  updateUi();
});

function onReady() {
  const name = machine.info.ad06Name || machine.info.bleName || machine.info.serialHL || '';
  const detected = detectModel(name) ?? detectModel(machine.info.serialHL);
  state.slots = detected?.myCoffeeSlots ?? 0;
  setFamily(detected?.familyKey ?? '700', detected);
  renderMachineInfo(detected);
  startPolling();
  updateUi();
}

// ------------------------------------------------------------------ Modell

const familySelect = $('#familySelect');
for (const key of FAMILY_KEYS) familySelect.append(el('option', { value: key }, familyInfo(key).title));
familySelect.addEventListener('change', () => setFamily(familySelect.value));

function setFamily(key, detected) {
  const info = detected?.familyKey === key ? detected : familyInfo(key, { slots: state.slots || 1 });
  state.model = info;
  familySelect.value = String(key);
  $('#brewMode').value = String(info.brewMode);
  $('#btnReturnHome').hidden = !info.writePrecondition;
  const origin = info.source ? ` Tabellen: ${info.source}.` : info.verified ? '' : ' Diese Plattform ist nur aus der App rekonstruiert und nicht live verifiziert.';
  $('#familyHint').textContent = detected
    ? `Automatisch erkannt über Namenspräfix „${detected.prefix}“.${origin}`
    : detected === undefined
      ? `Manuell gewählt.${origin}`
      : 'Modell nicht erkannt – Familie bitte manuell wählen.';
  renderRecipes();
  renderSettings();
  renderStats();
  renderMyCoffee();
}

function renderMachineInfo(detected) {
  const i = machine.info;
  const rows = [
    ['Modell', detected ? `${detected.title} (${detected.prefix})` : 'unbekannt'],
    ['BLE-Name', i.bleName],
    ['Seriennummer', i.serialHL || i.ad06Name],
    ['Softwareversion', i.version],
    ['Hersteller', i.manufacturer],
    ['BLE-Modul', i.model],
    ['Firmware', i.software || i.firmware],
    ['Session', machine.session ? toHex(machine.session) : '—'],
  ].filter(([, v]) => v);
  $('#machineInfo').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
}

// ------------------------------------------------------------------ Status

function renderStatus(s) {
  state.lastStatus = s;
  const big = $('#statusBig');
  if (!s) {
    big.className = 'status status-idle';
    big.textContent = '—';
    $('#statusDetail').replaceChildren();
    return;
  }
  const sum = summarizeStatus(s, state.model);
  const p = statusProfile(state.model);
  big.className = `status status-${sum.tone}`;
  big.textContent = sum.text;
  const procLabel = p.ready.includes(s.process) ? 'bereit' : p.product.includes(s.process) ? 'Zubereitung' : '';
  const rows = [
    ['process', `${s.process}${procLabel ? ' · ' + procLabel : ''}`],
    ['sub_process', `${s.subProcess}${p.subProcesses[s.subProcess] ? ' · ' + p.subProcesses[s.subProcess] : ''}`],
    ['message', `${s.message}${s.message && p.messages[s.message] ? ' · ' + p.messages[s.message] : ''}`],
    ['progress', s.progress],
  ];
  $('#statusDetail').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, String(v))]));
  $('#btnConfirm').classList.toggle('primary', sum.tone === 'confirm');
}

async function pollOnce() {
  if (!machine.session || state.polling || state.brewing) return;
  state.polling = true;
  try {
    renderStatus(await machine.readStatus({ quiet: true }));
  } catch (e) {
    addLog('err', `Statusabfrage: ${e.message}`);
  } finally {
    state.polling = false;
  }
}

function startPolling() {
  stopPolling();
  pollOnce();
  state.pollTimer = setInterval(() => $('#pollToggle').checked && pollOnce(), 2500);
}
function stopPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = null;
}

$('#btnStatus').addEventListener('click', (ev) => action(ev.currentTarget, async () => renderStatus(await machine.readStatus())));
$('#btnConfirm').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  await machine.confirmPrompt();
  addLog('sys', 'Aufforderung bestätigt (HY → A)');
  await pollOnce();
}));
$('#btnCancel').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  await machine.cancelProcess();
  addLog('sys', 'Prozess abgebrochen (HZ → A)');
  await pollOnce();
}));

// ------------------------------------------------------------------ Getränke

function renderRecipes() {
  const box = $('#recipes');
  const list = state.model?.recipes ?? [];
  box.replaceChildren(
    ...list.map((r) =>
      el('button', { class: 'tile', 'data-sel': r.selector, onclick: () => openRecipe(r), disabled: !machine.session },
        el('b', {}, r.name), el('span', {}, `Auswahl ${r.selector}`)),
    ),
  );
  if (!list.length) box.append(el('p', { class: 'hint' }, 'Keine Rezepte für diese Familie bekannt.'));
  $('#recipeEditor').hidden = true;
}

async function openRecipe(recipe) {
  state.recipe = recipe;
  document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('active', Number(t.dataset.sel) === recipe.selector));
  $('#recipeEditor').hidden = false;
  $('#editorTitle').textContent = `${recipe.name} · Auswahl ${recipe.selector}`;
  const fields = $('#editorFields');
  const list = recipeFieldsFor(state.model, recipe.selector);
  $('#btnBrewCustom').hidden = !list;
  if (!list) {
    fields.replaceChildren(el('p', { class: 'hint' }, 'Für diese Plattform ist kein Rezept-Registerlayout bekannt – nur Start ohne Anpassung möglich.'));
    return;
  }
  fields.replaceChildren(
    ...list.map((f) =>
      el('label', { title: f.hint ?? '' }, f.label,
        el('input', { type: 'number', id: `f_${f.key}`, placeholder: '…', min: f.min, max: f.max }),
        el('span', {}, `HR ${f.readReg} → HW ${f.writeReg}` + (f.min != null ? ` · ${f.min}–${f.max}` : ''))),
    ),
  );
  await action(null, async () => {
    for (const f of list) {
      const input = $(`#f_${f.key}`);
      try {
        let v = await machine.readNumeric(f.readReg);
        if (f.scale10) v = v / 10;
        input.value = String(v);
      } catch (e) {
        input.placeholder = 'n/v';
        input.title = e.message;
      }
    }
  });
}

$('#btnEditorClose').addEventListener('click', () => {
  $('#recipeEditor').hidden = true;
  document.querySelectorAll('.tile.active').forEach((t) => t.classList.remove('active'));
});

/** Anzeige-Werte aus dem Editor (Umrechnung/Prüfung macht brewing.js). */
function editorValues(list) {
  const values = {};
  for (const f of list) {
    const raw = $(`#f_${f.key}`)?.value;
    if (raw !== '' && raw != null) values[f.key] = Number(raw);
  }
  return values;
}

async function brew(withValues) {
  const recipe = state.recipe;
  const model = state.model;
  const list = withValues ? recipeFieldsFor(model, recipe.selector) : null;
  const values = list ? editorValues(list) : null;
  const log = (t) => addLog('sys', t);
  const mode = Number($('#brewMode').value);
  try {
    await brewDrink(machine, model, recipe, values, { mode, log });
  } catch (e) {
    // Legacy-Familien: nach Rückfrage trotzdem starten (wie bisher)
    if (!e.status || model.writePrecondition || !confirm(`${e.message}.\nTrotzdem starten?`)) throw e;
    await brewDrink(machine, model, recipe, values, { mode, log, force: true });
  }
  setTimeout(pollOnce, 800);
}
/** Pausiert die Hintergrund-Statusabfrage während einer Brüh-Sequenz. */
async function exclusive(fn) {
  if (state.brewing) throw new Error('Es läuft bereits ein Start');
  state.brewing = true;
  try {
    return await fn();
  } finally {
    state.brewing = false;
  }
}

$('#btnBrewCustom').addEventListener('click', (ev) => action(ev.currentTarget, () => exclusive(() => brew(true))));
$('#btnBrewPlain').addEventListener('click', (ev) => action(ev.currentTarget, () => exclusive(() => brew(false))));

// ------------------------------------------------------------------ Einstellungen

function renderSettings() {
  const body = $('#settingsTable tbody');
  body.replaceChildren(
    ...(state.model?.settings ?? []).map((s) => {
      const input = s.options
        ? el('select', { id: `set_${s.id}` }, el('option', { value: '' }, '—'), ...s.options.map((o) => el('option', { value: o.value }, o.label)))
        : el('input', { type: 'number', id: `set_${s.id}`, class: 'num' });
      return el('tr', {},
        el('td', {}, s.label),
        el('td', { class: 'reg' }, s.id),
        el('td', {}, input),
        el('td', { class: 'act' },
          el('button', { class: 'btn ghost', 'data-needs': 'session', title: 'Lesen', onclick: (ev) => action(ev.currentTarget, () => readSetting(s)) }, '↻'),
          el('button', { class: 'btn ghost', 'data-needs': 'session', title: 'Schreiben', onclick: (ev) => action(ev.currentTarget, () => writeSetting(s)) }, '✓')),
      );
    }),
  );
  updateUi();
}

async function readSetting(s) {
  const v = await machine.readNumeric(s.id);
  const input = $(`#set_${s.id}`);
  const code = s.options ? v & 0xffff : v; // App nutzt die unteren 16 Bit als Optionscode
  if (s.options && ![...input.options].some((o) => o.value === String(code))) input.append(el('option', { value: code }, `Code ${code}`));
  input.value = String(code);
}

async function writeSetting(s) {
  const raw = $(`#set_${s.id}`).value;
  if (raw === '') throw new Error(`Kein Wert für „${s.label}“ gewählt`);
  if (!confirm(`„${s.label}“ (Register ${s.id}) auf ${raw} setzen?`)) return;
  await machine.writeNumeric(s.id, Number(raw));
  addLog('sys', `Einstellung ${s.id} = ${raw} geschrieben`);
  await readSetting(s);
}

$('#btnReadSettings').addEventListener('click', (ev) =>
  action(ev.currentTarget, async () => {
    for (const s of state.model.settings) {
      try {
        await readSetting(s);
      } catch (e) {
        addLog('err', `Einstellung ${s.id}: ${e.message}`);
      }
    }
  }),
);

// ------------------------------------------------------------------ Statistik

function renderStats() {
  $('#statsHint').textContent = state.model && !state.model.statsVerified ? 'Für diese Familie ist keine eigene Tabelle bekannt – es wird die NIVO-8000-Tabelle verwendet.' : '';
  $('#statsTable tbody').replaceChildren(
    ...(state.model?.stats ?? []).map((s) => el('tr', {}, el('td', {}, s.label), el('td', { class: 'reg' }, s.id), el('td', { class: 'val', id: `stat_${s.id}` }, '—'))),
  );
}

$('#btnReadStats').addEventListener('click', (ev) =>
  action(ev.currentTarget, async () => {
    for (const s of state.model.stats) {
      const cell = $(`#stat_${s.id}`);
      try {
        const v = await machine.readNumeric(s.id);
        if (s.kind === 'percent') cell.replaceChildren(el('div', { class: 'bar', title: `${v} %` }, el('i', { style: `width:${Math.max(0, Math.min(100, v))}%` })), `${v} %`);
        else if (s.kind === 'flag') cell.textContent = v ? 'ja' : 'nein';
        else cell.textContent = v.toLocaleString('de-DE');
      } catch (e) {
        cell.textContent = 'n/v';
        cell.title = e.message;
      }
    }
  }),
);

// ------------------------------------------------------------------ MyCoffee

function renderMyCoffee() {
  const n = state.model?.myCoffeeSlots || state.slots || 0;
  const canBrew = state.model?.myCoffeeStart != null;
  $('#myCoffeeTable tbody').replaceChildren(
    ...Array.from({ length: n }, (_, i) =>
      el('tr', {},
        el('td', { class: 'reg' }, `#${i + 1}`),
        el('td', { id: `mc_${i + 1}` }, '—'),
        canBrew
          ? el('td', { class: 'act' },
              el('button', { class: 'btn ghost', 'data-needs': 'session', title: `HE Auswahl ${state.model.myCoffeeStart + i}`, onclick: (ev) => action(ev.currentTarget, () => exclusive(() => brewMyCoffee(i))) }, '☕'))
          : null),
    ),
  );
  updateUi();
  if (!n) $('#myCoffeeTable tbody').append(el('tr', {}, el('td', {}, 'Keine Slot-Anzahl bekannt.')));
}

$('#btnReadMyCoffee').addEventListener('click', (ev) =>
  action(ev.currentTarget, async () => {
    const n = state.model.myCoffeeSlots || state.slots;
    for (let i = 1; i <= n; i++) {
      const base = 20000 + (i - 1) * 100;
      const cell = $(`#mc_${i}`);
      try {
        const enabled = await machine.readNumeric(base);
        const name = await machine.readString(base + 2, state.model.encoding);
        const type = await machine.readNumeric(base + 3);
        const recipe = state.model.recipes.find((r) => r.selector === type);
        cell.textContent = `${name || '(ohne Namen)'} · ${recipe?.name ?? 'Typ ' + type} · ${enabled ? 'aktiv' : 'inaktiv'}`;
      } catch (e) {
        cell.textContent = `n/v (${e.message})`;
      }
    }
  }),
);

/** MyCoffee-Platz (0-basiert) mit gespeichertem Rezept starten: HE [00, mode, 00, start+slot, 00, 00]. */
async function brewMyCoffee(slot) {
  if (!confirm(`MyCoffee #${slot + 1} zubereiten?`)) return;
  await brewMyCoffeeSlot(machine, state.model, slot, { mode: Number($('#brewMode').value), log: (t) => addLog('sys', t) });
  setTimeout(pollOnce, 800);
}

// ------------------------------------------------------------------ Experten

const num = (id) => Number($(id).value);

$('#btnProcess').addEventListener('click', (ev) =>
  action(ev.currentTarget, async () => {
    const id = num('#procId');
    const type = num('#procType');
    if (!confirm(`HE-Prozess ${id} (Typ ${type}) starten?`)) return;
    await machine.startProcess(id, type);
    addLog('sys', `Prozess ${id}/${type} gestartet`);
    setTimeout(pollOnce, 800);
  }),
);
$('#btnReturnHome').addEventListener('click', (ev) => action(ev.currentTarget, () => machine.startProcess(state.model.writePrecondition, 0)));

const regOut = $('#regOut');
$('#btnRegRead').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  const v = await machine.readNumeric(num('#regId'));
  regOut.textContent = `HR ${num('#regId')} = ${v} (0x${(v >>> 0).toString(16)})`;
}));
$('#btnRegWrite').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  if (!confirm(`Register ${num('#regId')} auf ${num('#regValue')} schreiben?`)) return;
  await machine.writeNumeric(num('#regId'), num('#regValue'));
  regOut.textContent = `HW ${num('#regId')} = ${num('#regValue')} → A`;
}));
$('#btnRegString').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  const s = await machine.readString(num('#regId'), state.model?.encoding);
  regOut.textContent = `HA ${num('#regId')} = „${s}“`;
}));
$('#btnRegDefault').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  if (!confirm(`Register ${num('#regId')} auf Werkswert zurücksetzen (HD)?`)) return;
  await machine.resetToDefault(num('#regId'));
  regOut.textContent = `HD ${num('#regId')} → A`;
}));

$('#btnRaw').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  const cmd = $('#rawCmd').value.trim();
  const payload = fromHex($('#rawPayload').value);
  const f = await machine.raw(cmd, payload, { encrypt: $('#rawEncrypt').checked, withSession: $('#rawSession').checked, timeout: 4000 });
  $('#rawOut').textContent = `← ${f.command}${f.ok ? '' : ' (' + f.error + ')'}\npayload: ${toHex(f.payload) || '(leer)'}\nraw:     ${toHex(f.raw)}`;
}));

const diagOut = $('#diagOut');
$('#btnPing').addEventListener('click', (ev) => action(ev.currentTarget, async () => (diagOut.textContent = `Hp → ${await machine.ping()}`)));
$('#btnHandshake').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  diagOut.textContent = `Neue Session: ${toHex(await machine.handshake())}`;
  renderMachineInfo(detectModel(machine.info.ad06Name || machine.info.bleName));
}));
$('#btnFeatures').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  const f = await machine.readFeatures();
  diagOut.textContent = `HI: ${f.raw}\nBildübertragung: ${f.imageTransfer ? 'ja' : 'nein'}`;
}));
$('#btnSelfTest').addEventListener('click', () => {
  const res = selfTest();
  diagOut.textContent = res.map((r) => `${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n   erwartet ${r.expected}\n   erhalten ${r.actual}`}`).join('\n');
});

$('#btnResetSettings').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  if (!confirm('Alle Einstellungen der Maschine auf Werkseinstellung zurücksetzen?')) return;
  await machine.sendGlobalCommand(HE_FACTORY_RESET_SETTINGS);
  addLog('sys', 'Werksreset Einstellungen gesendet');
}));
$('#btnResetRecipes').addEventListener('click', (ev) => action(ev.currentTarget, async () => {
  if (!confirm('Alle Rezepte der Maschine auf Werkseinstellung zurücksetzen?')) return;
  await machine.sendGlobalCommand(HE_FACTORY_RESET_RECIPES);
  addLog('sys', 'Werksreset Rezepte gesendet');
}));

// ------------------------------------------------------------------ Start

setFamily('700', null);
$('#familyHint').textContent = 'Wird nach dem Verbinden automatisch erkannt.';
updateUi();
