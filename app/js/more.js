// „Mehr“: Maschine, Einstellungen, Darstellung, Intro, Trennen.
// Außerdem: Widget-Vorschau für die Seitenspalte.

import { el, icon, logo, sheet, toast, ask, drinkIcon, ring } from './ui.js';
import { controller } from './controller.js';
import { store } from './store.js';

export function morePage({ replayIntro, onDisconnect }) {
  const info = controller.machine?.info ?? {};
  const settingsList = el('div', { class: 'list' });
  const settings = controller.model?.settings ?? [];

  const renderSettings = async () => {
    settingsList.replaceChildren(...settings.map((s) => {
      const value = el('span', { class: 'value' }, '…');
      const item = el('button', { class: 'list-item', onclick: () => editSetting(s, value) }, el('div', { class: 'grow' }, el('b', {}, s.label)), value, icon('chevron', 'chev'));
      item.dataset.id = s.id;
      return item;
    }));
    for (const s of settings) {
      const cell = settingsList.querySelector(`[data-id="${s.id}"] .value`);
      try {
        const v = await controller.readSetting(s);
        cell.textContent = s.options?.find((o) => o.value === v)?.label ?? String(v);
        cell.dataset.v = v;
      } catch {
        cell.textContent = '–';
      }
    }
  };

  const theme = el('div', { class: 'segmented', style: { margin: '4px 0' } });
  const renderTheme = () => {
    const cur = document.documentElement.dataset.theme ?? 'auto';
    theme.replaceChildren(...[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, l]) =>
      el('button', { class: cur === v ? 'on' : '', onclick: () => {
        if (v === 'auto') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = v;
        try { localStorage.setItem('nivona-theme', v); } catch { /* egal */ }
        renderTheme();
      } }, l)));
  };
  renderTheme();

  const row = (ic, title, sub, onclick) => el('button', { class: 'list-item', onclick }, icon(ic), el('div', { class: 'grow' }, el('b', {}, title), sub ? el('small', {}, sub) : null), icon('chevron', 'chev'));

  const page = el('div', { class: 'page' },
    el('div', { class: 'scroll' },
      el('div', { class: 'page-title' }, el('h1', {}, 'Mehr')),
      el('div', { class: 'stagger' },
        el('div', { class: 'card', style: { display: 'grid', gridTemplateColumns: '70px 1fr', gap: '14px', alignItems: 'center' } },
          el('img', { src: 'assets/nivo9000.webp', alt: '', style: { width: '70px' } }),
          el('div', {},
            el('h3', {}, controller.machineName),
            el('p', { class: 'muted', style: { fontSize: '13px', marginTop: '4px', lineHeight: '1.5' } },
              `Software ${info.version ?? '–'}`, el('br'), `Seriennr. ${info.serialHL ?? info.ad06Name ?? '–'}`, el('br'),
              controller.simulated ? 'Demo-Modus (virtuelle Maschine)' : 'Verbunden über Bluetooth'))),
        el('div', { class: 'section-title' }, 'Maschineneinstellungen'),
        settings.length ? settingsList : el('p', { class: 'muted' }, 'Für dieses Modell sind keine Einstellungen bekannt.'),
        el('div', { class: 'section-title' }, 'Darstellung'),
        theme,
        el('div', { class: 'section-title' }, 'App'),
        el('div', { class: 'list' },
          row('sparkle', 'Intro & Ersteinrichtung', 'Maschine erklärt, Schritt für Schritt', replayIntro),
          row('info', 'Expertenansicht', 'Protokoll-Log und Rohbefehle', () => window.open('../', '_blank')),
          row('power', 'Verbindung trennen', null, async () => {
            if (await ask({ title: 'Verbindung trennen?', text: 'Du kannst Dich jederzeit wieder verbinden.', ok: 'Trennen', danger: true })) onDisconnect();
          })),
        el('p', { class: 'muted', style: { fontSize: '11.5px', textAlign: 'center', margin: '22px 0 0' } }, 'NIVONA App · Simulation · Inoffizieller Prototyp'))));

  renderSettings();
  return page;
}

async function editSetting(s, cell) {
  const current = Number(cell.dataset.v);
  let chosen = current;
  const content = s.options
    ? el('div', { class: 'list', style: { boxShadow: 'none', background: 'var(--surface-2)' } }, s.options.map((o) =>
        el('button', { class: 'list-item', onclick: (e) => {
          chosen = o.value;
          e.currentTarget.parentElement.querySelectorAll('.list-item').forEach((b) => b.querySelector('.ico')?.remove());
          e.currentTarget.append(icon('check', 'chev'));
        } }, el('div', { class: 'grow' }, el('b', {}, o.label)), o.value === current ? icon('check', 'chev') : null)))
    : el('label', { class: 'field' }, 'Wert', el('input', { type: 'number', value: current, oninput: (e) => (chosen = Number(e.target.value)) }));
  const s2 = sheet(el('div', { class: 'dialog' },
    el('h3', {}, s.label),
    content,
    el('button', { class: 'btn primary block', onclick: async () => {
      if (chosen === current) return s2.close();
      try {
        await controller.writeSetting(s, chosen);
        cell.dataset.v = chosen;
        cell.textContent = s.options?.find((o) => o.value === chosen)?.label ?? String(chosen);
        toast('An die Maschine übertragen');
        s2.close();
      } catch (e) {
        toast(e.message, 'error');
      }
    } }, 'Übernehmen')));
}

// ------------------------------------------------------------------ Widget-Vorschau (außerhalb des Telefons)

export function renderWidgets(root, { onDrink }) {
  const v = controller.connected ? controller.view() : null;
  const b = store.beanInfo();
  const recipes = controller.recipes();
  const favs = store.get('favorites').map((s) => recipes.find((r) => r.selector === s)).filter(Boolean).slice(0, 4);
  const brewing = controller.brewing && v?.producing;

  const statusW = el('div', { class: 'widget' },
    el('div', {}, logo()),
    el('div', {}, el('small', {}, controller.connected ? controller.machineName : 'Nicht verbunden'), el('h5', {}, v ? (v.producing ? v.phase ?? 'Brüht …' : v.text) : '—')),
    el('img', { src: 'assets/nivo9000.webp', alt: '' }));

  const beansW = el('div', { class: 'widget light' },
    el('div', { class: 'row', style: { justifyContent: 'space-between' } }, logo(), icon('bean')),
    el('div', {}, el('div', { class: 'w-big' }, `~${b.cups}`), el('small', {}, b.low ? 'Tassen – bald nachfüllen!' : 'Tassen im Behälter')));

  const drinksW = el('div', { class: 'widget light wide' },
    el('div', { class: 'row', style: { justifyContent: 'space-between' } }, logo(), el('small', {}, 'Schnellstart')),
    el('div', { class: 'w-drinks' }, (favs.length ? favs : recipes.slice(0, 4)).map((r) =>
      el('button', { onclick: () => onDrink(r), disabled: !controller.connected }, drinkIcon(r.name), r.name.split(' ')[0]))));

  const live = el('div', { class: `live-activity ${brewing ? '' : 'idle'}` },
    drinkIcon(controller.brewing?.recipe?.name ?? 'Espresso'),
    el('div', {},
      el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('b', { style: { fontSize: '14px' } }, brewing ? controller.brewing.recipe.name : 'Live-Aktivität'), logo()),
      el('small', {}, brewing ? `${v.phase ?? 'Zubereitung'} · ${v.progress} %` : 'Erscheint während der Zubereitung auf dem Sperrbildschirm'),
      el('div', { class: 'la-bar' }, el('i', { style: { width: `${brewing ? v.progress : 0}%` } }))),
    ring(brewing ? v.progress : 0, { size: 40, stroke: 4, label: '' }));

  root.replaceChildren(statusW, beansW, drinksW, live);
}
