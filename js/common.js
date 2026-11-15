// Visite enseignant (?visite) : parcours élève complet, tests raccourcis, données locales uniquement.
export const VISITE = new URLSearchParams(location.search).has('visite');
export const N_ESSAIS = VISITE ? 3 : 10;

export const ILOTS = [
  { id: 'turing',    court: 'Turing',    nom: 'Alan Turing' },
  { id: 'archimede', court: 'Archimède', nom: 'Archimède' },
  { id: 'descartes', court: 'Descartes', nom: 'Descartes' },
  { id: 'noether',   court: 'Noether',   nom: 'Emmy Noether' },
  { id: 'fibonacci', court: 'Fibonacci', nom: 'Fibonacci' },
  { id: 'johnson',   court: 'Johnson',   nom: 'Katherine Johnson' },
  { id: 'ramanujan', court: 'Ramanujan', nom: 'Ramanujan' },
  { id: 'germain',   court: 'Germain',   nom: 'Sophie Germain' },
];

export const MODES = {
  A: { id: 'A', nom: 'Clignotants',   titre: 'Réaction avec choix' },
  B: { id: 'B', nom: 'Calcul mental', titre: 'Calcul mental' },
  C: { id: 'C', nom: 'SMS',           titre: 'SMS au volant' },
  D: { id: 'D', nom: 'Simulateur',    titre: 'Simulateur de conduite' },
};
export const ORDRE_MODES = ['A', 'B', 'C', 'D'];
export const ETAPES = ['accroche', 'temoin', 'test', 'calculs', 'fini'];
export const LIBELLE_ETAPE = {
  accroche: 'Estimation', temoin: 'Test témoin', test: 'Test du mode',
  calculs: 'Calculs', fini: '✓ Validé',
};

export function modesPourTaille(n) { return n === 3 ? ['A', 'C', 'D'] : ['A', 'B', 'C', 'D']; }
export const ilotById = id => ILOTS.find(i => i.id === id);
export const docId = (ilot, mode) => `${ilot}_${mode}`;
export const identite = (ilot, mode) => `${ilotById(ilot)?.court ?? ilot} — ${MODES[mode]?.nom ?? mode}`;

export function moyenne(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
export function mediane(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
export function etendue(a) { return a.length ? Math.max(...a) - Math.min(...a) : NaN; }
export function stats(a) { return { moyenne: moyenne(a), mediane: mediane(a), etendue: etendue(a) }; }

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function fmt(x, d = 1) {
  if (x == null || Number.isNaN(x)) return '—';
  return Number(x).toLocaleString('fr-FR', { maximumFractionDigits: d });
}
export function parseNombre(s) {
  if (typeof s !== 'string') return NaN;
  s = s.trim().replace(/\s/g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
}

// Petit utilitaire de création d'éléments DOM.
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
export function lsDel(k) { try { localStorage.removeItem(k); } catch { /* idem */ } }
