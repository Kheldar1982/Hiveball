// Gemeinsame Kopfzeile (Logo-Slot + Navigation) für alle Manager-Seiten.
// Kein Framework, kein Build-Schritt: reine DOM-Erzeugung, jede Seite bindet
// sie über ein Platzhalter-Element <div id="app-header"></div> ein und ruft
// renderHeader(<eigener key>) auf. Gebäude ohne href sind noch nicht gebaut
// (siehe Club.facilities, Spezifikation 2.2) und erscheinen nur als Text.

const NAV_ITEMS = [
  { key: 'overview', label: 'Übersicht', href: 'overview.html' },
  { key: 'kader', label: 'Kader', href: 'index.html' },
  { key: 'training', label: 'Trainingscenter', href: 'training.html' },
  { key: 'academy', label: 'Akademie', href: 'academy.html' },
  { key: 'hall-of-fame', label: 'Hall of Fame', href: 'hall-of-fame.html' },
  { key: 'medical', label: 'Medizinische Abteilung', href: null },
  { key: 'fanSector', label: 'Fan-Sektor', href: null },
  { key: 'fanshop', label: 'Fanshop', href: null },
  { key: 'catering', label: 'Catering', href: null },
  { key: 'stadium', label: 'Stadion', href: null },
];

export function renderHeader(activeKey) {
  const container = document.getElementById('app-header');
  if (!container) return;

  const header = document.createElement('header');
  header.className = 'app-header';

  const logo = document.createElement('div');
  logo.className = 'app-logo';
  logo.textContent = '🏈 Hiveball';
  header.appendChild(logo);

  const nav = document.createElement('nav');
  nav.className = 'app-nav';
  for (const item of NAV_ITEMS) {
    const el = document.createElement(item.href ? 'a' : 'span');
    if (item.href) el.href = item.href;
    else el.className = 'nav-disabled';
    el.textContent = item.label;
    if (item.key === activeKey) el.classList.add('active');
    nav.appendChild(el);
  }
  header.appendChild(nav);

  container.replaceChildren(header);
}
