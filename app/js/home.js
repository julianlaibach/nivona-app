// Start, Getränke, Getränke-Sheet und Live-Brühanzeige.

import { el, icon, logo, drinkIcon, drinkArt, drinkKind, DRINK_TEXT, sheet, toast, ring, greeting, ask } from './ui.js';
import { controller } from './controller.js';
import { store } from './store.js';

const MACHINE_IMG = 'assets/nivo9000.webp';

// ------------------------------------------------------------------ Start

export function homePage({ go }) {
  const statusPill = el('span', { class: 'status-pill' }, el('i'), 'Verbinde …');
  const heroTitle = el('h2', {}, 'Bereit für Deinen Kaffee?');
  const progress = el('div', { class: 'hero-progress', hidden: true }, el('i', { style: { width: '0%' } }));
  const heroActions = el('div', { class: 'hero-actions' });
  const hero = el('div', { class: 'hero' },
    el('img', { src: MACHINE_IMG, alt: '' }),
    el('div', {}, el('div', { class: 'greet' }, `${greeting()} · ${controller.machineName}`), heroTitle),
    el('div', {}, statusPill, progress, heroActions));

  const renderStatus = () => {
    const v = controller.view();
    statusPill.className = `status-pill ${v.tone === 'ok' ? '' : v.tone}`;
    statusPill.lastChild.textContent = v.producing ? (v.phase ?? 'Zubereitung') : v.text;
    progress.hidden = !v.producing;
    progress.firstChild.style.width = `${v.progress}%`;
    heroTitle.textContent = v.producing ? `${controller.brewing?.recipe?.name ?? 'Dein Getränk'} entsteht gerade.` : v.ready ? 'Bereit für Deinen Kaffee?' : 'Deine NIVONA braucht Dich kurz.';
    heroActions.replaceChildren(
      ...(v.tone === 'confirm' ? [el('button', { class: 'btn white', onclick: () => controller.confirm().catch((e) => toast(e.message, 'error')) }, 'Bestätigen')] : []),
      ...(v.producing ? [el('button', { class: 'btn white', onclick: () => go('brew') }, 'Live ansehen')] : []),
    );
  };

  const favRow = el('div', { class: 'drink-row' });
  const renderFavs = () => {
    const recipes = controller.recipes();
    const favs = store.get('favorites').map((s) => recipes.find((r) => r.selector === s)).filter(Boolean);
    favRow.replaceChildren(...(favs.length ? favs : recipes.slice(0, 4)).map((r) => drinkCard(r)));
  };

  const beansCard = el('div', { class: 'card' });
  const renderBeans = () => beansCard.replaceChildren(beansWidget());

  const careChips = el('div', { class: 'chips' });
  const renderCare = () => {
    const items = controller.care();
    careChips.replaceChildren(
      ...(items.length
        ? items.slice(0, 4).map((c) => el('span', { class: `chip ${c.value >= 90 ? 'warn' : ''}` }, icon(c.value >= 90 ? 'warn' : 'care'), `${c.label} · ${c.value} %`))
        : [el('span', { class: 'chip' }, 'Pflegedaten werden geladen …')]),
    );
  };

  const page = el('div', { class: 'page' },
    el('div', { class: 'scroll' },
      el('div', { class: 'stagger' },
        hero,
        el('div', { class: 'section-title' }, 'Deine Favoriten', el('button', { onclick: () => go('drinks') }, 'Alle Getränke')),
        favRow,
        el('div', { class: 'section-title' }, 'Bohnen', el('button', { onclick: () => go('reminders') }, 'Erinnerungen')),
        beansCard,
        el('div', { class: 'section-title' }, 'Pflege', el('button', { onclick: () => go('care') }, 'Details')),
        careChips)));

  const sub = [
    ['status', renderStatus], ['stats', renderCare], ['stats', renderBeans],
  ].map(([t, fn]) => (controller.addEventListener(t, fn), [t, fn]));
  const onStore = () => (renderFavs(), renderBeans());
  store.addEventListener('change', onStore);
  page.cleanup = () => {
    sub.forEach(([t, fn]) => controller.removeEventListener(t, fn));
    store.removeEventListener('change', onStore);
  };
  renderStatus();
  renderFavs();
  renderBeans();
  renderCare();
  return page;
}

export function beansWidget() {
  const b = store.beanInfo();
  return el('div', { class: 'beans' },
    el('div', { class: `bean-meter ${b.low ? 'low' : ''}` }, el('i', { style: { height: `${Math.max(4, b.pct)}%` } })),
    el('div', {},
      el('h3', {}, b.low ? 'Bohnen gehen zur Neige' : `Noch ca. ${b.cups} Tassen`),
      el('p', { class: 'muted' }, `≈ ${Math.round(b.level)} g im Behälter · ${b.packsAtHome} ${b.packsAtHome === 1 ? 'Packung' : 'Packungen'} Vorrat`),
      el('div', { class: 'row', style: { marginTop: '10px' } },
        el('button', { class: 'btn sm primary', onclick: () => { store.refillBeans(); toast('Bohnenbehälter aufgefüllt ☕'); } }, 'Nachgefüllt'),
        el('button', { class: 'btn sm ghost', onclick: () => { store.boughtBeans(1); toast('Vorrat +1 Packung'); } }, icon('cart'), 'Gekauft'))));
}

const DRINK_TAG = {
  espresso: 'Kräftig & kurz', lungo: 'Voll & lang', americano: 'Mild & klar', cappuccino: 'Mit Milchhaube',
  latte: 'Samtig & weich', 'latte-m': 'Im Glas geschichtet', flatwhite: 'Fein & intensiv', macchiato: 'Mit Schaumtupfer',
  milk: 'Heiße Milch', foam: 'Luftig', water: 'Für Tee', chilled: 'Kalt extrahiert',
};

function drinkCard(r, { grid = false } = {}) {
  return el('button', { class: 'drink-card', onclick: () => openDrink(r) },
    drinkIcon(r.name),
    el('b', {}, r.name),
    grid ? null : el('small', {}, DRINK_TAG[drinkKind(r.name)] ?? ''));
}

// ------------------------------------------------------------------ Getränke

export function drinksPage() {
  const mcList = el('div', { class: 'list' }, el('div', { class: 'list-item' }, el('div', { class: 'skeleton', style: { flex: 1 } })));
  const recipes = controller.recipes();
  const coffee = recipes.filter((r) => !['milk', 'water', 'foam', 'chilled'].includes(drinkKind(r.name)));
  const other = recipes.filter((r) => ['milk', 'water', 'foam'].includes(drinkKind(r.name)));
  const chilled = recipes.filter((r) => drinkKind(r.name) === 'chilled');

  const page = el('div', { class: 'page' },
    el('div', { class: 'scroll' },
      el('div', { class: 'page-title' }, el('h1', {}, 'Getränke')),
      el('div', { class: 'stagger' },
        el('div', { class: 'drink-grid' }, coffee.map((r) => drinkCard(r, { grid: true }))),
        chilled.length ? el('div', { class: 'section-title' }, 'Kalt genießen') : null,
        chilled.length ? el('div', { class: 'drink-grid' }, chilled.map((r) => drinkCard(r, { grid: true }))) : null,
        el('div', { class: 'section-title' }, 'Milch & Wasser'),
        el('div', { class: 'drink-grid' }, other.map((r) => drinkCard(r, { grid: true }))),
        el('div', { class: 'section-title' }, 'MyCoffee'),
        mcList)));

  controller.myCoffee().then((list) => {
    mcList.replaceChildren(
      ...(list.length
        ? list.map((mc) =>
            el('button', { class: 'list-item', onclick: () => startSlot(mc) },
              drinkIcon(mc.recipe?.name ?? 'Kaffee'),
              el('div', { class: 'grow' }, el('b', {}, mc.name || `MyCoffee ${mc.slot + 1}`), el('small', {}, mc.recipe?.name ?? 'Eigenes Rezept')),
              icon('play', 'chev')))
        : [el('div', { class: 'list-item' }, el('div', { class: 'grow' }, el('b', {}, 'Noch keine eigenen Rezepte'), el('small', {}, 'Lege MyCoffee-Rezepte am Display Deiner Maschine an.')))]),
    );
    mcList.querySelectorAll('.drink-art').forEach((d) => Object.assign(d.style, { width: '40px', height: '40px' }));
  }).catch(() => mcList.replaceChildren(el('div', { class: 'list-item' }, el('small', { class: 'muted' }, 'MyCoffee konnte nicht gelesen werden.'))));
  return page;
}

async function startSlot(mc) {
  if (!(await ask({ title: `${mc.name || 'MyCoffee'} zubereiten?`, text: 'Bitte eine Tasse unter den Auslauf stellen.', ok: 'Zubereiten' }))) return;
  try {
    await controller.brewSlot(mc.slot, mc.name || 'MyCoffee');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ------------------------------------------------------------------ Getränke-Sheet

const PROFILE_9101 = ['Quick', 'Dynamic', 'Constant', 'Harmonic', 'Intense'];
const ADVANCED = new Set(['preparation', 'milk_type', 'froth_type', 'milk_temp_control']);

export async function openDrink(recipe) {
  const kind = drinkKind(recipe.name);
  const favBtn = el('button', { class: `fav-btn ${store.get('favorites').includes(recipe.selector) ? 'on' : ''}`, 'aria-label': 'Favorit' });
  const setFav = () => favBtn.replaceChildren(icon(store.get('favorites').includes(recipe.selector) ? 'starFill' : 'star'));
  setFav();
  favBtn.addEventListener('click', () => {
    store.toggleFavorite(recipe.selector);
    favBtn.classList.toggle('on');
    setFav();
  });

  const controls = el('div', { class: 'controls' }, el('div', { class: 'skeleton' }), el('div', { class: 'skeleton' }), el('div', { class: 'skeleton' }));
  const brewBtn = el('button', { class: 'btn primary block', disabled: true }, icon('play'), 'Zubereiten');
  const hint = el('p', { class: 'muted', style: { fontSize: '12px', textAlign: 'center', marginTop: '10px' } }, 'Werte gelten nur für diese Tasse – Dein gespeichertes Rezept bleibt unverändert.');

  const s = sheet(el('div', {},
    el('div', { class: 'drink-head' }, drinkIcon(recipe.name), el('div', {}, el('h2', {}, recipe.name), el('p', {}, DRINK_TEXT[kind])), favBtn),
    controls, brewBtn, hint), { tall: false });

  let loaded;
  try {
    loaded = await controller.recipe(recipe.selector);
  } catch (e) {
    controls.replaceChildren(el('p', { class: 'muted' }, `Rezept konnte nicht gelesen werden: ${e.message}`));
    loaded = { fields: [], values: {} };
  }
  const { fields, values } = loaded;
  const current = { ...values };
  let changed = false;
  const set = (key, v) => {
    current[key] = v;
    changed = true;
  };

  const main = [];
  const adv = [];
  for (const f of fields) {
    if (current[f.key] == null) continue;
    const ctl = control(f, current[f.key], (v) => set(f.key, v));
    if (!ctl) continue;
    (ADVANCED.has(f.key) ? adv : main).push(ctl);
  }
  controls.replaceChildren(
    ...main,
    adv.length ? el('details', { class: 'help', style: { background: 'var(--surface-2)' } }, el('summary', {}, 'Weitere Optionen', icon('chevron')), el('div', { class: 'controls', style: { margin: '14px 0 0' } }, adv)) : null,
  );
  if (!fields.length) controls.append(el('p', { class: 'muted' }, 'Für dieses Modell wird das gespeicherte Rezept verwendet.'));
  brewBtn.disabled = false;

  brewBtn.addEventListener('click', async () => {
    brewBtn.disabled = true;
    brewBtn.replaceChildren('Wird gestartet …');
    try {
      await controller.brew(recipe, changed ? current : null);
      s.close();
    } catch (e) {
      toast(e.message, 'error');
      brewBtn.disabled = false;
      brewBtn.replaceChildren(icon('play'), 'Zubereiten');
    }
  });
}

function control(f, value, onChange) {
  const label = (text, val) => el('label', {}, text, el('span', {}, val));
  const plan9101 = controller.model?.plan === 'ef1109';

  if (f.key === 'strength') {
    const max = f.max ?? 4;
    const min = f.min ?? 0;
    const val = el('span', {});
    const pick = el('div', { class: 'beans-pick' });
    const render = (v) => {
      val.textContent = `${v - min + 1} von ${max - min + 1}`;
      pick.replaceChildren(...Array.from({ length: max - min + 1 }, (_, i) =>
        el('button', { class: i + min <= v ? 'on' : '', 'aria-label': `Stärke ${i + 1}`, onclick: () => { onChange(i + min); render(i + min); } }, icon('bean'))));
    };
    render(value);
    return el('div', { class: 'control' }, el('label', {}, 'Stärke', val), pick);
  }

  if (f.ml || /ml/i.test(f.label)) {
    const min = f.min ?? 20;
    const max = f.max ?? 240;
    const out = el('span', {}, `${value} ml`);
    const input = el('input', { type: 'range', min, max, step: 5, value });
    const paint = () => input.style.setProperty('--p', `${((input.value - min) / (max - min)) * 100}%`);
    paint();
    input.addEventListener('input', () => {
      out.textContent = `${input.value} ml`;
      paint();
      onChange(Number(input.value));
    });
    return el('div', { class: 'control' }, el('label', {}, f.label.replace(/\s*\(ml\)/, ''), out), input);
  }

  if (f.key === 'profile' && f.min === f.max) return null; // fest (Chilled)

  let options;
  if (f.key === 'two_cups' || f.key === 'twoCups') options = [[0, '1 Tasse'], [1, '2 Tassen']];
  else if (f.key === 'profile' && plan9101) options = PROFILE_9101.map((l, i) => [i, l]).slice(f.min ?? 0, (f.max ?? 4) + 1);
  else {
    const min = f.min ?? 0;
    const max = f.max ?? Math.max(3, value);
    options = Array.from({ length: max - min + 1 }, (_, i) => [min + i, `Stufe ${min + i + 1}`]);
  }
  const seg = el('div', { class: 'segmented' });
  const render = (v) => seg.replaceChildren(...options.map(([ov, l]) => el('button', { class: ov === v ? 'on' : '', onclick: () => { onChange(ov); render(ov); } }, l)));
  render(value);
  return el('div', { class: 'control' }, label(f.label, ''), seg);
}

// ------------------------------------------------------------------ Live-Brühen

const PHASES = [
  [2, 'Mahlen'], [5, 'Brühen'], [7, 'Schäumen'], [9, 'Wasser'],
];

export function brewView({ onClose }) {
  const b = controller.brewing;
  const name = b?.recipe?.name ?? 'Dein Getränk';
  const kind = drinkKind(name);
  const art = el('span', { class: 'drink-art', html: drinkArt(kind, { fill: 0.05 }) });
  const ringBox = el('div', {});
  const pct = el('div', { class: 'brew-pct' }, '0 %');
  const phase = el('div', { class: 'brew-phase' }, 'Wird vorbereitet …');
  const relevant = PHASES.filter(([sub]) =>
    sub === 2 || sub === 5 ? !['milk', 'water', 'foam'].includes(kind) : sub === 7 ? ['cappuccino', 'latte', 'latte-m', 'flatwhite', 'macchiato', 'milk', 'foam'].includes(kind) : kind === 'water' || kind === 'americano');
  const track = el('div', { class: 'phase-track' }, relevant.map(([sub, l]) => el('span', { 'data-sub': sub }, l)));
  const cancel = el('button', { class: 'btn ghost block' }, 'Abbrechen');
  const stage = el('div', { class: 'brew-stage brewing' }, ringBox, el('div', { class: 'steam' }, el('i'), el('i'), el('i')), art);
  const title = el('h1', {}, name);
  const footer = el('div', { style: { width: '100%', display: 'grid', gap: '10px' } }, cancel);

  const v = el('div', { class: 'view dark-view brew-live' },
    el('div', { class: 'glow red' }), el('div', { class: 'glow aub' }),
    logo(), title, stage, pct, phase, track, el('div', { class: 'spacer' }), footer);

  let lastFill = -1;
  const update = (view) => {
    const p = view?.progress ?? 0;
    ringBox.replaceChildren(ring(p, { size: 250, stroke: 5 }));
    pct.textContent = `${p} %`;
    if (view?.phase) phase.textContent = view.phase;
    const fill = Math.max(0.05, p / 100);
    if (Math.abs(fill - lastFill) > 0.04) {
      art.innerHTML = drinkArt(kind, { fill });
      lastFill = fill;
    }
    const sub = view?.raw?.subProcess;
    let seen = true;
    for (const s of track.children) {
      const sid = Number(s.dataset.sub);
      const on = sid === sub || (sub === 8 && sid === 7);
      s.classList.toggle('on', on);
      if (on) seen = false;
      s.classList.toggle('done', seen && !on && view?.producing);
    }
  };
  update(controller.view());

  const finish = (ok, msg) => {
    stage.classList.remove('brewing');
    track.querySelectorAll('span').forEach((s) => {
      s.classList.remove('on');
      if (ok) s.classList.add('done');
    });
    if (ok) {
      art.innerHTML = drinkArt(kind, { fill: 1 });
      ringBox.replaceChildren(ring(100, { size: 250, stroke: 5 }));
      pct.replaceChildren(el('div', { class: 'done-check' }, icon('check')));
      title.textContent = 'Fertig!';
      phase.textContent = `Genieß Deinen ${name}.`;
    } else {
      title.textContent = 'Nicht abgeschlossen';
      phase.textContent = msg;
    }
    footer.replaceChildren(el('button', { class: 'btn white block', onclick: onClose }, 'Schließen'));
    if (ok) setTimeout(onClose, 4500);
  };

  const onBrew = (e) => {
    const d = e.detail;
    if (d.phase === 'running') update(d.view);
    if (d.phase === 'done') finish(true);
    if (d.phase === 'failed') finish(false, d.view?.raw?.message ? d.view.text : 'Die Zubereitung wurde abgebrochen.');
  };
  const onStatus = (e) => controller.brewing && update(e.detail);
  controller.addEventListener('brew', onBrew);
  controller.addEventListener('status', onStatus);
  cancel.addEventListener('click', async () => {
    cancel.disabled = true;
    try {
      await controller.cancel();
    } catch (e) {
      toast(e.message, 'error');
      cancel.disabled = false;
    }
  });
  v.cleanup = () => {
    controller.removeEventListener('brew', onBrew);
    controller.removeEventListener('status', onStatus);
  };
  if (!b) finish(false, 'Gerade läuft keine Zubereitung.');
  return v;
}
