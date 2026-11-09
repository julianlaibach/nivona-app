// Splash → Intro (Maschine erklären, App-Funktionen, Ersteinrichtung) → Verbinden.

import { el, icon, logo, toast } from './ui.js';
import { controller } from './controller.js';
import { store } from './store.js';

const MACHINE_IMG = 'assets/nivo9000.webp';

// Hotspots auf dem Frontrendering der NIVO 9'000 (Prozent der Bildfläche).
const HOTSPOTS = [
  { x: 54, y: 17, title: 'Touch-Display', text: 'Alle Rezepte auf einen Blick – vom Espresso bis zum Latte Macchiato mit einem Tipp. Die App spiegelt diese Auswahl.' },
  { x: 86, y: 22, title: 'Bohnenbehälter', text: 'Oben unter dem Deckel. Ganze, frische Bohnen einfüllen – die App schätzt, wie viele Tassen noch drin sind.' },
  { x: 52, y: 45, title: 'Auslauf', text: 'Hier läuft Dein Getränk in die Tasse. Stell die Tasse mittig darunter, bevor Du per App startest.' },
  { x: 68, y: 57, title: 'Milchsystem', text: 'Anschluss für den Milchschlauch. Das Milchsystem der 9\'000er-Serie kommt auch mit pflanzlichen Alternativen gut zurecht.' },
  { x: 8, y: 48, title: 'Wassertank', text: 'Links, zum Befüllen abnehmbar. Immer frisches, kaltes Wasser verwenden.' },
  { x: 90, y: 64, title: 'Brüheinheit', text: 'Hinter der Seitenklappe. Zum Reinigen herausnehmbar – für hygienischen Kaffeegenuss.' },
  { x: 54, y: 88, title: 'Tropfschale & Satzbehälter', text: 'Unten vorne. Regelmäßig leeren – die Maschine meldet sich, wenn es so weit ist.' },
];

const SETUP = [
  { title: 'Aufstellen', text: 'Auf eine stabile, ebene Fläche stellen und etwas Abstand zur Wand lassen.' },
  { title: 'Wassertank füllen', text: 'Tank abnehmen, mit frischem, kaltem Wasser bis zur Markierung füllen, einsetzen.' },
  { title: 'Bohnen einfüllen', text: 'Ganze Bohnen in den Behälter – keine aromatisierten oder karamellisierten Bohnen.' },
  { title: 'Einschalten', text: 'Die Maschine führt am Display durch Sprache und Grundeinstellungen.' },
  { title: 'Wasserhärte einstellen', text: 'Mit dem Teststreifen messen und einstellen – später auch in der App änderbar.' },
  { title: 'Bluetooth aktivieren', text: 'Im Maschinenmenü die App-Verbindung einschalten, bis die Maschine „sichtbar“ meldet.' },
];

export function splash(next) {
  const v = el('div', { class: 'view dark-view splash' }, el('div', { class: 'glow red' }), el('div', { class: 'glow aub' }), logo(), el('p', {}, 'Passion for coffee.'));
  setTimeout(next, 2100);
  return v;
}

export function intro({ onDone }) {
  let idx = 0;
  const dots = el('div', { class: 'dots' });
  const nextBtn = el('button', { class: 'btn primary block' }, 'Weiter');
  const slides = el('div', { class: 'slides' });

  // --- Slide 1: Willkommen
  slides.append(
    el('section', { class: 'slide stagger' },
      el('span', { class: 'eyebrow' }, 'Willkommen'),
      el('h1', { html: 'Für das Beste aus <em>Deiner Bohne.</em>' }),
      el('p', { class: 'lead' }, 'Deine NIVONA und Dein Smartphone – ein Team. Getränke starten, Pflege im Blick behalten und nie wieder ohne Bohnen dastehen.'),
      el('div', { class: 'hero-machine' }, el('img', { src: MACHINE_IMG, alt: 'NIVO 9000' }))),
  );

  // --- Slide 2: Maschine erklärt
  const card = el('div', { class: 'hotspot-card' }, el('b', {}, 'Tippe auf die Punkte'), el('p', {}, 'Lerne Deine NIVO 9\'000 kennen – vom Display bis zur Brüheinheit.'));
  const machine = el('div', { class: 'hero-machine small' }, el('img', { src: MACHINE_IMG, alt: 'NIVO 9000 mit markierten Bauteilen' }));
  HOTSPOTS.forEach((h, i) => {
    const b = el('button', { class: 'hotspot', style: { left: `${h.x}%`, top: `${h.y}%` }, 'aria-label': h.title, onclick: () => {
      machine.querySelectorAll('.hotspot').forEach((x) => x.classList.toggle('active', x === b));
      card.replaceChildren(el('b', {}, h.title), el('p', {}, h.text));
      card.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'ease-out' });
    } }, String(i + 1));
    machine.append(b);
  });
  slides.append(el('section', { class: 'slide stagger' }, el('span', { class: 'eyebrow' }, 'Deine Maschine'), el('h1', { html: 'Die NIVO 9\'000 <em>im Überblick</em>' }), machine, card));

  // --- Slide 3: App-Funktionen
  const F = (ic, t, d) => el('div', { class: 'feature' }, icon(ic), el('div', {}, el('b', {}, t), el('p', {}, d)));
  slides.append(
    el('section', { class: 'slide stagger' },
      el('span', { class: 'eyebrow' }, 'Was die App kann'),
      el('h1', { html: 'Dein Kaffee, <em>Deine Regeln.</em>' }),
      el('div', { class: 'feature-list stagger' },
        F('cup', 'Getränke starten', 'Stärke, Menge und Temperatur anpassen – die Maschine bereitet zu, Du siehst live zu.'),
        F('sparkle', 'Live-Status', 'Mahlen, Brühen, Schäumen: jede Phase in Echtzeit, später auch auf dem Sperrbildschirm.'),
        F('bean', 'Bohnen-Erinnerung', 'Die App schätzt den Füllstand und erinnert Dich ans Nachfüllen und Nachkaufen.'),
        F('care', 'Pflege im Blick', 'Entkalken, Reinigen, Filter – rechtzeitig, bevor die Maschine danach fragt.'))),
  );

  // --- Slide 4: Ersteinrichtung
  const done = new Set();
  const stepEls = SETUP.map((s, i) => {
    const b = el('button', { class: 'step', onclick: () => {
      done.has(i) ? done.delete(i) : done.add(i);
      b.classList.toggle('done', done.has(i));
      b.querySelector('.num').replaceChildren(done.has(i) ? icon('check') : String(i + 1));
    } }, el('span', { class: 'num' }, String(i + 1)), el('div', {}, el('b', {}, s.title), el('p', {}, s.text)));
    return b;
  });
  slides.append(
    el('section', { class: 'slide stagger' },
      el('span', { class: 'eyebrow' }, 'Ersteinrichtung'),
      el('h1', { html: 'In wenigen Schritten <em>startklar.</em>' }),
      el('p', { class: 'muted', style: { fontSize: '13px' } }, 'Tippe einen Schritt an, wenn er erledigt ist. Details findest Du in der Bedienungsanleitung Deiner Maschine.'),
      el('div', { class: 'steps' }, stepEls)),
  );

  const count = slides.children.length;
  for (let i = 0; i < count; i++) dots.append(el('i'));

  const update = () => {
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === idx));
    nextBtn.textContent = idx === count - 1 ? 'Maschine verbinden' : 'Weiter';
  };
  slides.addEventListener('scroll', () => {
    const i = Math.round(slides.scrollLeft / slides.clientWidth);
    if (i !== idx) {
      idx = i;
      update();
    }
  }, { passive: true });
  nextBtn.addEventListener('click', () => {
    if (idx === count - 1) return onDone();
    slides.scrollTo({ left: (idx + 1) * slides.clientWidth, behavior: 'smooth' });
  });
  update();

  return el('div', { class: 'view dark-view intro' },
    el('div', { class: 'glow red' }), el('div', { class: 'glow aub' }),
    el('div', { class: 'intro-top' }, logo(), el('button', { class: 'link-btn', onclick: onDone }, 'Überspringen')),
    slides,
    el('div', { class: 'intro-bottom' }, dots, nextBtn));
}

const CONN_STEPS = [
  ['gatt', 'Maschine gefunden & verbunden'],
  ['pair', 'Kopplung bestätigt'],
  ['session', 'Sichere Sitzung'],
  ['info', 'Maschinendaten gelesen'],
];

export function connect({ onConnected, onBack }) {
  const radar = el('div', { class: 'radar' }, el('i'), el('i'), el('i'), el('img', { src: MACHINE_IMG, alt: '' }), el('span', { class: 'bt-badge' }, icon('bt')));
  const title = el('h1', { class: 'serif', style: { fontSize: '28px', textAlign: 'center' } }, 'Verbinde Deine NIVONA');
  const sub = el('p', { class: 'muted', style: { textAlign: 'center', fontSize: '14px', lineHeight: '1.5' } }, 'Bluetooth an der Maschine aktivieren und das Handy in die Nähe halten.');
  const steps = el('div', { class: 'conn-steps', hidden: true }, CONN_STEPS.map(([id, t]) => el('div', { class: 'conn-step', 'data-id': id }, el('span', { class: 'dot' }, icon('check')), t)));

  const bleOk = controller.constructor.bleSupported();
  const btnBle = el('button', { class: 'btn primary block', disabled: !bleOk }, icon('bt'), 'Maschine suchen');
  const btnDemo = el('button', { class: 'btn ghost block' }, 'Demo ohne Maschine');

  const mark = (id) => {
    let reached = false;
    steps.querySelectorAll('.conn-step').forEach((s) => {
      if (s.dataset.id === id) {
        s.classList.add('active');
        reached = true;
      } else if (!reached) {
        s.classList.remove('active');
        s.classList.add('done');
      }
    });
  };
  const stepMap = { 'GATT-Verbindung wird aufgebaut …': 'gatt', 'Geräteinformationen lesen …': 'gatt', 'Nivona-Service AD00 binden …': 'gatt', 'Notifications aktivieren (ggf. Pairing bestätigen) …': 'pair', 'Session-Handshake (HU) …': 'session', 'Softwareversion lesen (HV) …': 'info' };

  const run = async (mode) => {
    btnBle.disabled = btnDemo.disabled = true;
    radar.classList.add('scanning');
    title.textContent = mode === 'demo' ? 'Demo-Maschine wird verbunden' : 'Suche läuft …';
    sub.textContent = mode === 'demo' ? 'Eine virtuelle NIVO 9\'000 – alle Funktionen, ganz ohne Hardware.' : 'Wähle im Browser-Dialog den Eintrag, der mit der Modellnummer beginnt (z. B. 9103…).';
    try {
      await controller.connect(mode, (text, id) => {
        steps.hidden = false;
        mark(id ?? stepMap[text] ?? 'gatt');
        if (mode !== 'demo') sub.textContent = text;
      });
      steps.querySelectorAll('.conn-step').forEach((s) => {
        s.classList.remove('active');
        s.classList.add('done');
      });
      title.textContent = `${controller.machineName} verbunden`;
      sub.textContent = 'Schön, dass Ihr Euch gefunden habt.';
      radar.classList.remove('scanning');
      setTimeout(onConnected, 1100);
    } catch (e) {
      radar.classList.remove('scanning');
      steps.hidden = true;
      btnBle.disabled = !bleOk;
      btnDemo.disabled = false;
      title.textContent = 'Verbinde Deine NIVONA';
      sub.textContent = 'Bluetooth an der Maschine aktivieren und das Handy in die Nähe halten.';
      if (e?.name !== 'NotFoundError') toast(e.message ?? String(e), 'error');
    }
  };
  btnBle.addEventListener('click', () => run('ble'));
  btnDemo.addEventListener('click', () => run('demo'));

  const help = el('details', { class: 'help' },
    el('summary', {}, 'Maschine wird nicht gefunden?', icon('chevron')),
    el('ul', {},
      el('li', {}, 'Andere Apps trennen: Ist die NIVONA-App auf einem Handy verbunden, ist die Maschine für andere unsichtbar.'),
      el('li', { html: 'Im Auswahldialog heißt die Maschine nach ihrer Seriennummer, z. B. <code>91031109…</code> – nicht „NIVO 9103“.' }),
      el('li', {}, 'Browser: Chrome oder Edge verwenden und Bluetooth-Zugriff erlauben (macOS: Systemeinstellungen → Datenschutz → Bluetooth).'),
      el('li', {}, 'Kopplung: Beim ersten Verbinden fragt das System nach – bitte bestätigen.')),
  );
  if (!bleOk) help.open = true;

  return el('div', { class: 'view dark-view connect' },
    el('div', { class: 'glow red' }), el('div', { class: 'glow aub' }),
    el('div', { class: 'intro-top', style: { padding: 0 } }, el('button', { class: 'link-btn', onclick: onBack }, 'Zurück zum Intro'), logo()),
    radar, title, sub, steps, el('div', { class: 'spacer' }),
    el('div', { style: { display: 'grid', gap: '10px', position: 'relative', zIndex: 2 } },
      btnBle, btnDemo,
      !bleOk ? el('p', { class: 'muted', style: { fontSize: '12px', textAlign: 'center' } }, 'Dieser Browser unterstützt kein Web Bluetooth – der Demo-Modus funktioniert trotzdem.') : null,
      help));
}

export { store };
