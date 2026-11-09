// Pflege & Statistik, Erinnerungen & Bohnen.

import { el, icon, ring, drinkIcon, sheet, toast, ask } from './ui.js';
import { controller } from './controller.js';
import { store } from './store.js';
import { beansWidget } from './home.js';

// ------------------------------------------------------------------ Pflege

const CARE_TEXT = {
  600: 'Entkalken schützt Heizsystem und Geschmack.',
  610: 'Die Brüheinheit lässt sich herausnehmen und reinigen.',
  620: 'Sauberes Milchsystem = feinporiger Schaum.',
  640: 'Ein frischer Filter macht weicheres Wasser.',
  650: 'Kurzer Spülgang der Brüheinheit.',
};

export function carePage() {
  const careBox = el('div', { class: 'care-grid' });
  const total = el('div', { class: 'big-number' }, '–');
  const bars = el('div', { class: 'bars' });

  const render = () => {
    const care = controller.care();
    careBox.replaceChildren(
      ...(care.length
        ? care.map((c) =>
            el('div', { class: 'care-item' },
              ring(c.value, { size: 54, stroke: 5, cls: c.value >= 90 ? '' : 'ok' }),
              el('div', {}, el('b', {}, c.label), el('small', {}, c.value >= 90 ? 'Bald fällig' : CARE_TEXT[c.id] ?? 'Alles im grünen Bereich'))))
        : [el('p', { class: 'muted' }, 'Keine Pflegedaten verfügbar.')]),
    );
    const st = controller.stats;
    total.textContent = st[213] != null ? st[213].toLocaleString('de-DE') : '–';
    const drinks = controller.recipes()
      .map((r) => ({ r, n: st[(controller.model?.plan === 'ef1109' ? 200 : 200) + r.selector] }))
      .filter((d) => d.n != null && d.r.selector < 13)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
    const max = Math.max(1, ...drinks.map((d) => d.n));
    bars.replaceChildren(...drinks.map((d) =>
      el('div', { class: 'bar-row' }, drinkIcon(d.r.name),
        el('div', {}, el('div', {}, d.r.name), el('div', { class: 'track' }, el('i', { style: { width: `${(d.n / max) * 100}%` } }))),
        el('b', {}, d.n.toLocaleString('de-DE')))));
  };

  const page = el('div', { class: 'page' },
    el('div', { class: 'scroll' },
      el('div', { class: 'page-title' }, el('h1', {}, 'Pflege'), el('button', { class: 'icon-btn', 'aria-label': 'Aktualisieren', onclick: () => controller.refreshStats().then(() => toast('Aktualisiert')) }, icon('sparkle'))),
      el('div', { class: 'stagger' },
        el('p', { class: 'muted', style: { fontSize: '13px', marginBottom: '12px' } }, 'Fortschritt bis zur nächsten Pflege. Bei 100 % meldet sich die Maschine.'),
        careBox,
        el('div', { class: 'section-title' }, 'Statistik'),
        el('div', { class: 'card' },
          el('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '16px' } },
            el('div', {}, el('small', { class: 'muted' }, 'Getränke insgesamt'), total),
            icon('cup')),
          bars))));

  controller.addEventListener('stats', render);
  page.cleanup = () => controller.removeEventListener('stats', render);
  render();
  return page;
}

// ------------------------------------------------------------------ Erinnerungen

const KIND = {
  'beans-refill': ['bean', 'Wenn der Behälter fast leer ist'],
  'beans-buy': ['cart', 'Wenn kein Vorrat mehr im Haus ist'],
  care: ['care', 'Wenn Entkalken, Reinigen oder Filter anstehen'],
  date: ['calendar', null],
};

export function remindersPage() {
  const beansCard = el('div', { class: 'card' });
  const list = el('div', { class: 'list' });

  const render = () => {
    beansCard.replaceChildren(beansWidget(), el('button', { class: 'btn ghost block', style: { marginTop: '14px' }, onclick: beanSettings }, icon('settings'), 'Bohnen-Einstellungen'));
    list.replaceChildren(...store.get('reminders').map((r) => {
      const [ic, auto] = KIND[r.kind] ?? KIND.date;
      const sw = el('label', { class: 'switch' }, el('input', { type: 'checkbox', checked: r.enabled, onchange: (e) => store.updateReminder(r.id, { enabled: e.target.checked }) }), el('span'));
      const when = r.kind === 'date'
        ? `${new Date(r.at).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${r.repeatDays ? ` · alle ${r.repeatDays} Tage` : ''}`
        : auto;
      return el('div', { class: 'list-item' }, icon(ic),
        el('div', { class: 'grow' }, el('b', {}, r.title), el('small', {}, when)),
        r.auto ? null : el('button', { class: 'fav-btn', 'aria-label': 'Löschen', onclick: async () => { if (await ask({ title: 'Erinnerung löschen?', ok: 'Löschen', danger: true })) store.removeReminder(r.id); } }, icon('trash')),
        sw);
    }));
  };

  const perm = typeof Notification !== 'undefined' && Notification.permission !== 'granted'
    ? el('button', { class: 'btn ghost block', style: { marginTop: '12px' }, onclick: async () => {
        const p = await Notification.requestPermission();
        toast(p === 'granted' ? 'Benachrichtigungen aktiv' : 'Benachrichtigungen bleiben in der App');
      } }, icon('bell'), 'System-Benachrichtigungen erlauben')
    : null;

  const page = el('div', { class: 'page' },
    el('div', { class: 'scroll' },
      el('div', { class: 'page-title' }, el('h1', {}, 'Erinnerungen'), el('button', { class: 'icon-btn', 'aria-label': 'Neue Erinnerung', onclick: newReminder }, icon('plus'))),
      el('div', { class: 'stagger' },
        beansCard,
        el('div', { class: 'section-title' }, 'Deine Erinnerungen', el('button', { onclick: newReminder }, 'Neu')),
        list,
        perm,
        el('p', { class: 'muted', style: { fontSize: '12px', marginTop: '12px', lineHeight: '1.45' } },
          'Der Bohnen-Füllstand ist eine Schätzung: Die App zählt die Bezüge der Maschine und rechnet pro Kaffee mit der eingestellten Bohnenmenge.'))));

  store.addEventListener('change', render);
  page.cleanup = () => store.removeEventListener('change', render);
  render();
  return page;
}

function beanSettings() {
  const b = store.get('beans');
  const num = (label, key, unit, step = 1) => {
    const input = el('input', { type: 'number', value: b[key], min: 0, step });
    return [el('label', { class: 'field' }, `${label} (${unit})`, input), () => [key, Number(input.value)]];
  };
  const fields = [
    num('Füllmenge Bohnenbehälter', 'containerGrams', 'g', 10),
    num('Aktuell im Behälter', 'level', 'g', 5),
    num('Bohnen pro Kaffee', 'gramsPerDrink', 'g'),
    num('Erinnern ab', 'lowThreshold', 'g', 5),
    num('Vorrat zuhause', 'packsAtHome', 'Packungen'),
  ];
  const s = sheet(el('div', { class: 'dialog' },
    el('h3', {}, 'Bohnen'),
    ...fields.map((f) => f[0]),
    el('button', { class: 'btn primary block', onclick: () => {
      store.setBeans(Object.fromEntries(fields.map((f) => f[1]())));
      s.close();
      toast('Gespeichert');
    } }, 'Speichern')));
}

function newReminder() {
  const presets = [['Bohnen kaufen', 'cart'], ['Milch kaufen', 'cart'], ['Wasserfilter wechseln', 'drop'], ['Eigene', 'bell']];
  const title = el('input', { type: 'text', value: presets[0][0] });
  const t = new Date(Date.now() + 864e5);
  t.setHours(9, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const at = el('input', { type: 'datetime-local', value: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T09:00` });
  const repeat = el('select', {}, [['0', 'Einmalig'], ['7', 'Wöchentlich'], ['14', 'Alle 2 Wochen'], ['30', 'Monatlich']].map(([v, l]) => el('option', { value: v }, l)));
  const chips = el('div', { class: 'segmented' }, presets.map(([p]) => el('button', { onclick: (e) => {
    chips.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === e.currentTarget));
    title.value = p === 'Eigene' ? '' : p;
    if (p === 'Eigene') title.focus();
  } }, p.split(' ')[0])));
  chips.firstChild.classList.add('on');

  const s = sheet(el('div', { class: 'dialog' },
    el('h3', {}, 'Neue Erinnerung'),
    chips,
    el('label', { class: 'field' }, 'Titel', title),
    el('label', { class: 'field' }, 'Wann', at),
    el('label', { class: 'field' }, 'Wiederholen', repeat),
    el('button', { class: 'btn primary block', onclick: () => {
      if (!title.value.trim()) return toast('Bitte einen Titel eingeben', 'error');
      store.addReminder({ kind: 'date', title: title.value.trim(), at: new Date(at.value).getTime(), repeatDays: Number(repeat.value) || 0 });
      s.close();
      toast('Erinnerung gespeichert');
    } }, 'Speichern')));
}
