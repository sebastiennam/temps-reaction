// Onglet Classe : tableau par mode + graphique en points (une médiane par élève).
import { h, MODES, ORDRE_MODES, moyenne, mediane, fmt, ilotById } from './common.js';

const COULEUR = { T: '#6b7280', A: '#d9480f', B: '#7048e8', C: '#0c8599', D: '#2f9e44' };

export function calculClasse(eleves) {
  const ok = eleves.filter(e => e.validated && e.stats?.temoin && e.stats?.test);
  const lignes = [{
    key: 'T', nom: 'Témoin (tous les élèves)',
    pts: ok.map(e => ({ ilot: e.ilot, mode: e.mode, moy: e.stats.temoin.moyenne, med: e.stats.temoin.mediane })),
  }];
  for (const m of ORDRE_MODES) {
    lignes.push({
      key: m, nom: `${m} — ${MODES[m].nom}`,
      pts: ok.filter(e => e.mode === m).map(e => ({
        ilot: e.ilot, mode: m, moy: e.stats.test.moyenne, med: e.stats.test.mediane,
        ecart: e.stats.test.moyenne - e.stats.temoin.moyenne,
      })),
    });
  }
  for (const l of lignes) {
    l.n = l.pts.length;
    l.moyMoy = moyenne(l.pts.map(p => p.moy));
    l.medMed = mediane(l.pts.map(p => p.med));
    l.ecart = l.key === 'T' ? null : moyenne(l.pts.map(p => p.ecart));
  }
  return { lignes, nEleves: ok.length };
}

export function renderClasse(el, eleves, { grand = false, moi = null, vue = 'tout' } = {}) {
  const { lignes, nEleves } = calculClasse(eleves);
  if (!nEleves) {
    el.replaceChildren(h('p', { class: 'vide' }, 'Aucun résultat validé pour l\'instant. Les résultats apparaissent dès qu\'un élève a validé ses calculs.'));
    return;
  }
  const table = h('table', { class: 'tableau-classe' + (grand ? ' grand' : '') },
    h('thead', {}, h('tr', {},
      h('th', {}, 'Test'), h('th', {}, 'Élèves'),
      h('th', { class: 'c-moy' }, 'Moyenne des moyennes'), h('th', { class: 'c-med' }, 'Médiane des médianes'),
      h('th', {}, 'Écart moyen au témoin'))),
    h('tbody', {}, lignes.map(l => h('tr', {},
      h('td', {}, h('span', { class: 'pastille', style: `background:${COULEUR[l.key]}` }), l.nom),
      h('td', {}, String(l.n)),
      h('td', { class: 'c-moy' }, l.n ? fmt(l.moyMoy, 0) + ' ms' : '—'),
      h('td', { class: 'c-med' }, l.n ? fmt(l.medMed, 0) + ' ms' : '—'),
      h('td', {}, l.ecart == null ? '' : (l.n ? (l.ecart >= 0 ? '+' : '') + fmt(l.ecart, 0) + ' ms' : '—'))))));
  el.replaceChildren(
    h('p', { class: 'classe-info' }, `${nEleves} élève${nEleves > 1 ? 's' : ''} pour l'instant. Les données se mettent à jour en direct.`),
    vue !== 'graphe' ? table : null,
    vue !== 'tableau' ? graphique(lignes, grand, moi) : null);
}

// Empile les points proches (« essaim ») pour qu'aucun ne se chevauche. Renvoie un niveau par point.
function essaim(xs, ecart) {
  const ordre = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const places = new Map(); // niveau -> dernier x placé
  const niveaux = new Array(xs.length);
  for (const [x, i] of ordre) {
    for (let k = 0; ; k++) {
      const niv = k === 0 ? 0 : (k % 2 ? (k + 1) / 2 : -k / 2);
      if (!places.has(niv) || x - places.get(niv) >= ecart) { places.set(niv, x); niveaux[i] = niv; break; }
    }
  }
  return niveaux;
}

const abrev = id => (ilotById(id)?.court ?? id).slice(0, 3);

function graphique(lignes, grand, moi) {
  const tous = lignes.flatMap(l => [...l.pts.map(p => p.med), l.n ? l.moyMoy : null, l.n ? l.medMed : null]).filter(v => v != null && !Number.isNaN(v));
  let min = Math.floor((Math.min(...tous) - 30) / 100) * 100;
  let max = Math.ceil((Math.max(...tous) + 30) / 100) * 100;
  if (max - min < 300) max = min + 300;
  const W = 960, G = 170, D = 24, R = 13, PAS_Y = 2 * R + 3, top = 16;
  const X = v => G + (v - min) / (max - min) * (W - G - D);
  // hauteur de chaque ligne selon l'empilement
  let y0 = top;
  const geo = lignes.map(l => {
    const niv = essaim(l.pts.map(p => X(p.med)), 2 * R + 2);
    const hautMax = Math.max(0, ...niv.map(Math.abs));
    const hauteur = Math.max(70, (2 * hautMax + 1) * PAS_Y + 22);
    const g = { y: y0 + hauteur / 2, niv, hauteur };
    y0 += hauteur;
    return g;
  });
  const bas = y0, Hh = bas + 34;
  const pas = (max - min) > 1200 ? 200 : 100;
  let s = `<svg viewBox="0 0 ${W} ${Hh}" class="graphe${grand ? ' grand' : ''}" role="img" aria-label="Médiane de chaque élève, par test">`;
  for (let v = min; v <= max; v += pas) {
    s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top}" y2="${bas}" stroke="var(--grille)" />`;
    s += `<text x="${X(v)}" y="${bas + 22}" text-anchor="middle" class="axe">${v} ms</text>`;
  }
  lignes.forEach((l, i) => {
    const { y, niv, hauteur } = geo[i];
    if (i % 2) s += `<rect x="0" y="${y - hauteur / 2}" width="${W}" height="${hauteur}" fill="var(--bande)"/>`;
    s += `<text x="${G - 12}" y="${y + 5}" text-anchor="end" class="lib">${esc(l.nom.replace(' (tous les élèves)', ''))}</text>`;
    if (l.n) {
      const dy = hauteur / 2 - 6;
      s += `<line x1="${X(l.moyMoy)}" x2="${X(l.moyMoy)}" y1="${y - dy}" y2="${y + dy}" stroke="var(--moy)" stroke-width="3.5"/>`;
      s += `<line x1="${X(l.medMed)}" x2="${X(l.medMed)}" y1="${y - dy}" y2="${y + dy}" stroke="var(--med)" stroke-width="3.5" stroke-dasharray="6 4"/>`;
    }
    l.pts.forEach((p, j) => {
      const cx = X(p.med), cy = y + niv[j] * PAS_Y;
      const estMoi = moi && p.ilot === moi.ilot && p.mode === moi.mode;
      s += `<g><title>${esc(ilotById(p.ilot)?.court ?? p.ilot)} — ${esc(MODES[p.mode]?.nom ?? '')} : médiane ${fmt(p.med, 1)} ms</title>`;
      s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${COULEUR[l.key]}" stroke="${estMoi ? '#111' : '#fff'}" stroke-width="${estMoi ? 4 : 1.5}"/>`;
      s += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" class="pt">${esc(abrev(p.ilot))}</text></g>`;
    });
  });
  s += '</svg>';
  const wrap = h('div', { class: 'graphe-wrap' });
  wrap.innerHTML = s;
  wrap.append(h('p', { class: 'legende' },
    h('span', { class: 'l-pt' }), ' médiane d\'un élève (3 lettres = son îlot)   ',
    h('span', { class: 'l-moy' }), ' moyenne des moyennes   ',
    h('span', { class: 'l-med' }), ' médiane des médianes',
    moi ? h('span', {}, '   ', h('span', { class: 'l-moi' }), ' toi') : null));
  return wrap;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
