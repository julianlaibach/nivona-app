import { $, el, icon, logo, setRoot, transition, banner, toast, ring, LOGO } from './ui.js';
import { controller } from './controller.js';
import { store } from './store.js';
import { splash, intro, connect } from './onboarding.js';
import { homePage, drinksPage, brewView, openDrink } from './home.js';
import { carePage, remindersPage } from './care.js';
import { morePage, renderWidgets } from './more.js';

// ------------------------------------------------------------------ Grundgerüst

try {
  const t = localStorage.getItem('nivona-theme');
  if (t && t !== 'auto') document.documentElement.dataset.theme = t;
} catch { /* egal */ }

const app = $('#app');
setRoot($('#screen'));
$('#sideLogo').innerHTML = LOGO;
$('#islandLogo').innerHTML = LOGO;

let current = null;
/** Ersetzt die aktuelle Ansicht mit sanfter Überblendung. */
function show(view, { dark = false } = {}) {
  const prev = current;
  current = view;
  $('#statusbar').classList.toggle('light', dark);
  transition(() => {
    prev?.cleanup?.();
    prev?.remove();
    app.append(view);
  });
}

// ------------------------------------------------------------------ Ablauf

function start() {
  show(splash(() => (store.get('onboarded') ? showConnect() : showIntro())), { dark: true });
}

function showIntro() {
  show(intro({ onDone: () => { store.set({ onboarded: true }); showConnect(); } }), { dark: true });
}

function showConnect() {
  show(connect({ onConnected: showShell, onBack: showIntro }), { dark: true });
}

// ------------------------------------------------------------------ App-Shell mit Tabs

const TABS = [
  ['home', 'Start', 'home'],
  ['drinks', 'Getränke', 'cup'],
  ['care', 'Pflege', 'care'],
  ['reminders', 'Erinnern', 'bell'],
  ['more', 'Mehr', 'more'],
];
let shell = null;

function showShell() {
  const content = el('div', { style: { position: 'absolute', inset: 0 } });
  const tabbar = el('nav', { class: 'tabbar' }, TABS.map(([id, label, ic]) =>
    el('button', { class: 'tab', 'data-tab': id, onclick: () => go(id) }, icon(ic), label, el('span', { class: 'badge', hidden: true }))));
  const dot = el('button', { class: 'conn-dot', 'aria-label': 'Verbindungsstatus', onclick: () => go('more') }, el('i'));
  const bell = el('button', { class: 'icon-btn', 'aria-label': 'Erinnerungen', onclick: () => go('reminders') }, icon('bell'), el('span', { class: 'badge', hidden: true }));
  const bar = el('header', { class: 'appbar' }, dot, logo(), bell);
  const body = el('div', { style: { position: 'absolute', top: '108px', left: 0, right: 0, bottom: 0 } }, content);
  const view = el('div', { class: 'view' }, bar, body, tabbar);
  shell = { view, content, tabbar, bell, dot, page: null, tab: null };
  view.cleanup = () => shell?.page?.cleanup?.();
  show(view);
  go('home');
  refreshBadges();
}

function go(tab) {
  if (!shell) return;
  if (tab === 'brew') return openBrew();
  if (shell.tab === tab) return;
  shell.tab = tab;
  shell.tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  const make = { home: () => homePage({ go }), drinks: drinksPage, care: carePage, reminders: remindersPage, more: () => morePage({ replayIntro: () => { controller.disconnect(); showIntro(); }, onDisconnect: () => controller.disconnect() }) }[tab];
  const page = make();
  page.classList.add('view');
  const old = shell.page;
  shell.page = page;
  transition(() => {
    old?.cleanup?.();
    old?.remove();
    shell.content.append(page);
  });
}

let brewOverlay = null;
function openBrew() {
  if (brewOverlay || !shell) return;
  brewOverlay = brewView({ onClose: closeBrew });
  $('#statusbar').classList.add('light');
  shell.view.append(brewOverlay);
}
function closeBrew() {
  if (!brewOverlay) return;
  const o = brewOverlay;
  brewOverlay = null;
  o.classList.add('leaving');
  $('#statusbar').classList.remove('light');
  setTimeout(() => {
    o.cleanup?.();
    o.remove();
  }, 350);
}

// ------------------------------------------------------------------ Controller-Ereignisse

controller.addEventListener('connection', (e) => {
  if (!e.detail.connected && shell) {
    closeBrew();
    shell = null;
    toast('Verbindung getrennt');
    showConnect();
  }
  updateSide();
});

let lastMsg = 0;
controller.addEventListener('status', (e) => {
  const v = e.detail;
  shell?.dot.classList.toggle('off', !controller.connected);
  const msg = v.raw?.message ?? 0;
  if (msg && msg !== lastMsg && !controller.brewing) {
    banner({ title: v.text, body: v.tone === 'confirm' ? 'Tippe in der App auf „Bestätigen“.' : 'Bitte kurz an der Maschine nachsehen.', icon: 'warn' });
    if (msg === 6) store.setBeans({ level: 0 });
  }
  lastMsg = msg;
  updateIsland(v);
  updateSide();
});

controller.addEventListener('brew', (e) => {
  const d = e.detail;
  if (d.phase === 'started') openBrew();
  if (d.phase === 'done') {
    banner({ title: `Dein ${d.recipe.name} ist fertig ☕`, body: 'Genieß ihn, solange er heiß ist.', icon: 'cup' });
    notifySystem(`Dein ${d.recipe.name} ist fertig`, 'Genieß ihn, solange er heiß ist.');
  }
  if (d.phase !== 'running') updateIsland(controller.view());
  updateSide();
});

controller.addEventListener('stats', () => {
  checkReminders();
  updateSide();
});

controller.addEventListener('error', (e) => console.warn(e.detail));

// ------------------------------------------------------------------ Dynamic Island (Live-Aktivität im Telefon)

function updateIsland(v) {
  const isl = $('#island');
  const live = Boolean(controller.brewing && v?.producing);
  isl.classList.toggle('live', live);
  if (live) {
    $('#islandText').textContent = `${controller.brewing.recipe.name} · ${v.progress} %`;
    $('#islandRing').replaceChildren(ring(v.progress, { size: 18, stroke: 3, label: '' }));
  }
}

// ------------------------------------------------------------------ Erinnerungen

function notifySystem(title, body) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'assets/logo.svg' });
  } catch { /* nicht unterstützt */ }
}

function checkReminders() {
  if (!controller.connected) return;
  const due = store.dueReminders({ care: controller.dueCare() });
  due.forEach((r, i) =>
    setTimeout(() => {
      banner({ title: r.title, body: r.body, icon: r.kind.startsWith('beans') ? 'bean' : r.kind === 'care' ? 'care' : 'calendar' });
      notifySystem(r.title, r.body);
    }, i * 1800));
  refreshBadges();
}
setInterval(checkReminders, 30000);
store.addEventListener('change', () => {
  refreshBadges();
  updateSide();
});

function refreshBadges() {
  if (!shell) return;
  const attention = store.beanInfo().low || controller.dueCare().length > 0;
  shell.bell.querySelector('.badge').hidden = !attention;
  shell.tabbar.querySelector('[data-tab="reminders"] .badge').hidden = !attention;
}

// ------------------------------------------------------------------ Seitenspalten (Demo-Steuerung, Widgets)

let sideQueued = false;
function updateSide() {
  if (sideQueued) return;
  sideQueued = true;
  requestAnimationFrame(() => {
    sideQueued = false;
    renderWidgets($('#widgets'), {
      onDrink: (r) => {
        if (shell && shell.tab !== 'drinks') go('drinks');
        openDrink(r);
      },
    });
    const sim = controller.simulated && controller.connected;
    document.querySelectorAll('[data-sim]').forEach((b) => (b.disabled = !sim));
  });
}

document.querySelectorAll('[data-sim]').forEach((b) =>
  b.addEventListener('click', () => {
    const code = Number(b.dataset.sim);
    controller.machine?.setMessage?.(code);
    if (code === 0 || code === 6) controller.machine?.refillBeans?.();
    if (code === 6) controller.machine?.setMessage?.(6);
  }));
$('#simBeansLow').addEventListener('click', () => {
  store.setBeans({ level: Math.min(store.get('beans').lowThreshold - 5, 40), packsAtHome: 0 });
  store.clearFired('beans-refill');
  store.clearFired('beans-buy');
  checkReminders();
});
$('#simReset').addEventListener('click', () => {
  controller.disconnect();
  store.reset();
  location.reload();
});

// Uhr in der Statusleiste
const tickClock = () => ($('#clock').textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
tickClock();
setInterval(tickClock, 15000);

updateSide();
start();
