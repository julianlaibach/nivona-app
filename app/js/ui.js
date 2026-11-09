// UI-Bausteine der App-Simulation: DOM-Helfer, Icons, Logo, Getränke-
// Illustrationen, Bottom-Sheets, Dialoge und In-App-Banner.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Kleiner Element-Builder. Strings in `html` werden als Markup gesetzt. */
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) n.append(c instanceof Node ? c : String(c));
  return n;
}

export const svg = (markup) => el('span', { class: 'ico', html: markup, 'aria-hidden': 'true' });

// --------------------------------------------------------------- Logo

// NIVONA-Wortmarke aus logo.svg, Farbe über currentColor steuerbar.
export const LOGO = `<svg viewBox="0 0 87 24" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NIVONA"><g fill="currentColor">
<path d="M19.3359 23.7234H22.8828V3.69189H19.3359V23.7234Z"/>
<path d="M31.1548 23.7234H35.1936L39.9303 3.69189H36.4522L33.2143 18.0036L29.8963 3.69189H26.3838L31.1548 23.7234Z"/>
<path d="M61.7947 23.7234V10.7923L67.2752 23.7234H70.6732V3.69189H67.4353V15.5629L62.4355 3.69189H58.5454V23.7234H61.7947Z"/>
<path d="M3.34087 23.7233V9.44852L10.9837 23.7233H14.4047V-0.00634766L11.0638 1.75642V17.3379L3.707 3.67945H0V23.7233H3.34087Z"/>
<path d="M54.4036 17.2885V10.1265C54.4036 5.1833 51.9781 3.4082 48.5342 3.4082C45.0904 3.4082 42.6648 5.1833 42.6648 10.1265V17.2885C42.6648 22.2316 45.0789 24.0067 48.5342 24.0067C51.9895 24.0067 54.4036 22.2193 54.4036 17.2885ZM50.8454 17.7816C50.8454 20.0004 49.9415 20.6168 48.5342 20.6168C47.1269 20.6168 46.2116 20.0004 46.2116 17.7816V9.63338C46.2116 7.4145 47.1155 6.79815 48.5342 6.79815C49.9529 6.79815 50.8454 7.4145 50.8454 9.63338V17.7816Z"/>
<path d="M87.0001 23.7234L82.5151 3.69189H77.9615L73.3506 23.7234H76.7716L77.7784 19.5075H82.6982L83.602 23.7234H87.0001ZM81.9545 16.1176H78.4305L80.1811 8.0187L81.9545 16.1176Z"/>
</g></svg>`;

export const logo = (cls = '') => el('span', { class: `logo ${cls}`, html: LOGO });

// --------------------------------------------------------------- Icons (Linien, 24px)

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const ICON = {
  home: I('<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>'),
  cup: I('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"/>'),
  care: I('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5Z"/><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"/>'),
  bell: I('<path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
  more: I('<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>'),
  bt: I('<path d="m7 7.5 10 9-5 4v-17l5 4-10 9"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  chevron: I('<path d="m9 5 7 7-7 7"/>'),
  back: I('<path d="m15 5-7 7 7 7"/>'),
  star: I('<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8Z"/>'),
  starFill: I('<path fill="currentColor" d="m12 3.8 2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8Z"/>'),
  bean: I('<ellipse cx="12" cy="12" rx="5.5" ry="8" transform="rotate(35 12 12)"/><path d="M8.5 17c1.5-3 1-6.5 7-10"/>'),
  drop: I('<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5Z"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  trash: I('<path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7"/>'),
  info: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>'),
  warn: I('<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17h.01"/>'),
  power: I('<path d="M12 3.5V12"/><path d="M7 6.5a7 7 0 1 0 10 0"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>'),
  widget: I('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="17" height="7" rx="2"/>'),
  play: I('<path d="M8 5.5v13l10.5-6.5Z"/>'),
  calendar: I('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  cart: I('<path d="M3 4h2.5l2 11h11l2-8H7"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>'),
  sparkle: I('<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2Z"/>'),
};
export const icon = (name, cls = '') => el('span', { class: `ico ${cls}`, html: ICON[name], 'aria-hidden': 'true' });

// --------------------------------------------------------------- Getränke

/** Art der Darstellung je Getränk (über den Namen, gilt für alle Familien). */
export function drinkKind(name = '') {
  const n = name.toLowerCase();
  if (n.includes('chilled')) return 'chilled';
  if (n.includes('wasser')) return 'water';
  if (n === 'milch' || n.includes('heiße milch') || n.includes('warme milch')) return 'milk';
  if (n.includes('milchschaum')) return 'foam';
  if (n.includes('latte macchiato')) return 'latte-m';
  if (n.includes('latte')) return 'latte';
  if (n.includes('flat white')) return 'flatwhite';
  if (n.includes('cappuccino')) return 'cappuccino';
  if (n.includes('espresso macchiato')) return 'macchiato';
  if (n.includes('espresso')) return 'espresso';
  if (n.includes('americano') || n.includes('kanne')) return 'americano';
  return 'lungo';
}

export const DRINK_TEXT = {
  espresso: 'Kurz, kräftig, mit dichter Crema – das Herz jeder Kaffeespezialität.',
  lungo: 'Der verlängerte Espresso: mehr Wasser durchs Pulver, voller Körper.',
  americano: 'Espresso, verlängert mit heißem Wasser – mild und klar.',
  cappuccino: 'Espresso mit heißer Milch und einer Haube aus feinporigem Schaum.',
  latte: 'Viel heiße Milch mit Espresso – samtig und weich.',
  'latte-m': 'Geschichtet im Glas: Milch, Espresso und eine luftige Schaumkrone.',
  flatwhite: 'Doppelter Espresso mit wenig, sehr feinem Milchschaum.',
  macchiato: 'Espresso, „befleckt“ mit einem Tupfer Milchschaum.',
  milk: 'Heiße Milch – auch mit pflanzlichen Alternativen.',
  foam: 'Luftiger Milchschaum für Deine eigene Kreation.',
  water: 'Heißes Wasser, z. B. für Tee.',
  chilled: 'Kalt extrahiert, erfrischend und mild – Kaffeegenuss für warme Tage.',
};

const COFFEE = '#5b3a24';
const CREMA = '#c89466';
const MILK = '#f3ece3';
const FOAM = '#fffaf3';

/** Stilisierte Tasse/Glas als SVG (64×64), passend zum Getränk. */
export function drinkArt(kind, { fill = 1 } = {}) {
  const glass = (layers, ice = false) => {
    let y = 54;
    const rects = layers
      .map(([h, c]) => {
        const hh = h * fill;
        y -= hh;
        return `<rect x="21" y="${y}" width="22" height="${hh}" fill="${c}"/>`;
      })
      .join('');
    const cubes = ice ? '<rect x="24" y="30" width="7" height="7" rx="1.5" fill="#fff" opacity=".75" transform="rotate(-12 27 33)"/><rect x="32" y="38" width="7" height="7" rx="1.5" fill="#fff" opacity=".7" transform="rotate(10 35 41)"/>' : '';
    return `<svg viewBox="0 0 64 64"><defs><clipPath id="g${kind}"><path d="M20 12h24l-2 43H22Z"/></clipPath></defs>
      <g clip-path="url(#g${kind})">${rects}${cubes}</g>
      <path d="M20 12h24l-2 43H22Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>
      <ellipse cx="32" cy="57.5" rx="12" ry="1.6" fill="currentColor" opacity=".12"/></svg>`;
  };
  const cup = ({ h = 16, coffee = COFFEE, top = CREMA, foam = false, art = false, small = false }) => {
    const w = small ? 20 : 26;
    const x = 32 - w / 2;
    const top0 = 44 - h;
    const level = top0 + (h - 2) * (1 - fill) + 2;
    return `<svg viewBox="0 0 64 64">
      <defs><clipPath id="c${kind}"><path d="M${x} ${top0}h${w}v${h - 6}a${w / 2} 7 0 0 1-${w} 0Z"/></clipPath></defs>
      <g clip-path="url(#c${kind})"><rect x="${x}" y="${level}" width="${w}" height="${h + 8}" fill="${coffee}"/>
      ${fill > 0.6 ? `<ellipse cx="32" cy="${level}" rx="${w / 2}" ry="${foam ? 4 : 2.2}" fill="${top}"/>` : ''}
      ${art && fill > 0.9 ? `<path d="M32 ${level + 2.6}c-2-2.2-4.6-.4-3.2 1.4L32 ${level + 6}l3.2-3.6c1.4-1.8-1.2-3.6-3.2-1.4Z" fill="${CREMA}"/>` : ''}</g>
      <path d="M${x} ${top0}h${w}v${h - 6}a${w / 2} 7 0 0 1-${w} 0Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" opacity=".55"/>
      <path d="M${x + w} ${top0 + 4}h3a4.5 4.5 0 0 1 0 9h-3.4" fill="none" stroke="currentColor" stroke-width="1.6" opacity=".55"/>
      <ellipse cx="32" cy="${top0 + h + 3.5}" rx="${w / 2 + 7}" ry="2.2" fill="currentColor" opacity=".12"/></svg>`;
  };
  switch (kind) {
    case 'espresso': return cup({ h: 13, small: true });
    case 'macchiato': return cup({ h: 13, small: true, top: FOAM, foam: true });
    case 'lungo': return cup({ h: 20 });
    case 'americano': return cup({ h: 20, coffee: '#6d4a33', top: '#a9774f' });
    case 'cappuccino': return cup({ h: 18, coffee: '#b98a63', top: FOAM, foam: true });
    case 'flatwhite': return cup({ h: 16, coffee: '#c7a07c', top: '#e9d6c0', art: true });
    case 'latte': return glass([[16, '#d2b08d'], [16, MILK], [6, FOAM]]);
    case 'latte-m': return glass([[16, MILK], [8, '#9c6a45'], [10, '#e7d6c2'], [8, FOAM]]);
    case 'milk': return glass([[34, MILK], [4, FOAM]]);
    case 'foam': return glass([[10, MILK], [26, FOAM]]);
    case 'water': return glass([[34, '#d8e8f4']]);
    case 'chilled': return glass([[30, '#6e4a33'], [4, '#c89466']], true);
    default: return cup({ h: 18 });
  }
}

export const drinkIcon = (name, opts) => el('span', { class: 'drink-art', html: drinkArt(drinkKind(name), opts) });

// --------------------------------------------------------------- Screens & Overlays

let phoneRoot = null;
export function setRoot(root) {
  phoneRoot = root;
}

/** Weiche Überblendung zwischen zwei Zuständen (View Transitions, sonst CSS). */
export function transition(update) {
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return document.startViewTransition(update).finished.catch(() => {});
  }
  update();
  return Promise.resolve();
}

/** Bottom-Sheet. Gibt { close, body } zurück. */
export function sheet(content, { onClose, tall = false } = {}) {
  const backdrop = el('div', { class: 'sheet-backdrop' });
  const panel = el('div', { class: `sheet${tall ? ' tall' : ''}`, role: 'dialog', 'aria-modal': 'true' }, el('div', { class: 'sheet-grip' }), content);
  const wrap = el('div', { class: 'sheet-wrap' }, backdrop, panel);
  phoneRoot.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 380);
    onClose?.();
  };
  backdrop.addEventListener('click', close);
  // Wischen nach unten schließt
  let y0 = null;
  panel.addEventListener('pointerdown', (e) => {
    if (e.target.closest('input,select,button,textarea') || panel.scrollTop > 0) return;
    y0 = e.clientY;
  });
  panel.addEventListener('pointerup', (e) => {
    if (y0 != null && e.clientY - y0 > 70) close();
    y0 = null;
  });
  return { close, panel };
}

/** Bestätigungsdialog im App-Stil. */
export function ask({ title, text, ok = 'OK', cancel = 'Abbrechen', danger = false }) {
  return new Promise((resolve) => {
    const s = sheet(
      el('div', { class: 'dialog' },
        el('h3', {}, title),
        text ? el('p', { class: 'muted' }, text) : null,
        el('div', { class: 'dialog-actions' },
          el('button', { class: 'btn ghost', onclick: () => { s.close(); resolve(false); } }, cancel),
          el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onclick: () => { s.close(); resolve(true); } }, ok))),
      { onClose: () => resolve(false) },
    );
  });
}

/** Benachrichtigung oben im Telefon (wie eine System-Notification). */
export function banner({ title, body, icon: ic = 'bell', tone = '' }) {
  const b = el('div', { class: `banner ${tone}` },
    el('div', { class: 'banner-icon', html: LOGO }),
    el('div', { class: 'banner-text' }, el('div', { class: 'banner-head' }, el('b', {}, 'NIVONA'), el('span', {}, 'jetzt')), el('strong', {}, title), body ? el('p', {}, body) : null),
    icon(ic, 'banner-ico'),
  );
  phoneRoot.append(b);
  requestAnimationFrame(() => b.classList.add('in'));
  const hide = () => {
    b.classList.remove('in');
    setTimeout(() => b.remove(), 500);
  };
  b.addEventListener('click', hide);
  setTimeout(hide, 5200);
}

/** Kleiner Hinweis unten (Fehler, Erfolg). */
export function toast(text, tone = '') {
  const t = el('div', { class: `toast ${tone}` }, text);
  phoneRoot.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => {
    t.classList.remove('in');
    setTimeout(() => t.remove(), 400);
  }, 3200);
}

/** Fortschrittsring (SVG). */
export function ring(pct, { size = 64, stroke = 6, cls = '', label = null } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct ?? 0));
  return el('div', { class: `ring ${cls}`, style: { width: `${size}px`, height: `${size}px` } },
    el('span', {
      html: `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`,
    }),
    el('b', {}, label ?? `${Math.round(p)}%`));
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Guten Morgen' : h < 17 ? 'Schön, dass Du da bist' : h < 22 ? 'Guten Abend' : 'Späte Kaffeelust?';
};
