// Vue professeur.
import { initDb, DEMO } from './db.js';
import { ILOTS, MODES, LIBELLE_ETAPE, modesPourTaille, identite, h, fmt, ilotById, stats } from './common.js';
import { renderClasse } from './classe.js';

const app = document.getElementById('app');
const main = h('main', { id: 'main' });
const deco = h('button', { class: 'btn petit', hidden: true, onclick: async () => { await db.logoutProf(); location.reload(); } }, 'Se déconnecter');
app.append(...[
  h('header', { class: 'barre' }, h('span', { class: 'titre' }, '⏱️ Temps de réaction — Professeur'), h('span'), deco),
  DEMO ? h('div', { class: 'demo' }, 'Mode démo : mot de passe « demo ». Les données restent sur cet appareil.') : null,
  main].filter(Boolean));

let db, eleves = [], config = null, onglet = 'avancement', rafraichir = () => {};

function connexion() {
  const email = h('input', { type: 'email', class: 'champ', placeholder: 'E-mail', autocomplete: 'username', hidden: DEMO });
  const mdp = h('input', { type: 'password', class: 'champ', placeholder: 'Mot de passe', autocomplete: 'current-password' });
  const err = h('p', { class: 'erreur' });
  const go = async () => {
    err.textContent = '';
    try { await db.loginProf(email.value.trim(), mdp.value); tableau(); }
    catch (e) { err.textContent = /auth\/(invalid|wrong|user-not)/.test(e.code || '') ? 'E-mail ou mot de passe incorrect.' : (e.message || String(e)); }
  };
  mdp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  main.replaceChildren(h('div', { class: 'screen center' },
    h('h1', {}, 'Connexion professeur'), email, mdp, err,
    h('button', { class: 'btn primary big', onclick: go }, 'Se connecter')));
}

function tableau() {
  deco.hidden = false;
  db.watchEleves(l => { eleves = l; rafraichir(); });
  db.watchConfig(c => { config = c; rafraichir(); });
  afficher();
}

function afficher() {
  const tabs = [['avancement', 'Avancement'], ['ilots', 'Îlots présents'], ['classe', 'Classe (à projeter)'], ['donnees', 'Données']];
  const contenu = h('div', { class: 'onglet' });
  main.replaceChildren(h('div', { class: 'screen large' },
    h('nav', { class: 'onglets' }, tabs.map(([k, l]) =>
      h('button', { class: 'tab' + (k === onglet ? ' actif' : ''), onclick: () => { onglet = k; afficher(); } }, l))),
    contenu));
  const vues = { avancement, ilots, classe, donnees };
  rafraichir = () => vues[onglet](contenu);
  rafraichir();
}

const taille = id => config?.tailles?.[id] ?? 4;

let selection = null; // id de l'élève dont on affiche le détail

function detail(d) {
  if (!d) return null;
  const bloc = (titre, r) => {
    if (!r?.times?.length) return h('div', { class: 'det-bloc' }, h('h3', {}, titre), h('p', { class: 'petit-texte' }, 'Pas encore passé.'));
    const s = stats(r.times);
    return h('div', { class: 'det-bloc' },
      h('h3', {}, titre),
      h('p', {}, 'Temps (ms) : ', r.times.join(' · ')),
      h('p', {}, 'Rangés : ', [...r.times].sort((a, b) => a - b).join(' · ')),
      h('p', { class: 'det-stats' },
        h('span', {}, 'Moyenne ', h('b', {}, fmt(s.moyenne, 1))),
        h('span', {}, 'Médiane ', h('b', {}, fmt(s.mediane, 1))),
        h('span', {}, 'Étendue ', h('b', {}, fmt(s.etendue, 0)))),
      h('p', { class: 'petit-texte' }, `Faux départs : ${r.fauxDeparts ?? 0} · Essais refaits : ${r.aRefaire ?? 0}`));
  };
  return h('section', { class: 'detail' },
    h('div', { class: 'det-tete' },
      h('h2', {}, identite(d.ilot, d.mode)),
      h('button', { class: 'btn petit', onclick: () => { selection = null; rafraichir(); } }, 'Fermer')),
    h('p', {}, `Étape : ${LIBELLE_ETAPE[d.step] ?? d.step}`, d.estimation != null ? ` · Estimation : ${fmt(d.estimation, 1)} m` : ''),
    h('div', { class: 'det-blocs' }, bloc('Test témoin', d.temoin), bloc(`Test ${d.mode} — ${MODES[d.mode].nom}`, d.test)),
    h('button', {
      class: 'btn danger petit', onclick: async () => {
        if (!confirm(`Effacer « ${identite(d.ilot, d.mode)} » ?\nSes mesures seront perdues et le mode redeviendra libre dans l'îlot.`)) return;
        await db.deleteAll([d.id]); selection = null; rafraichir();
      },
    }, 'Effacer cet élève (libérer le mode)'));
}

function avancement(el) {
  const actifs = ILOTS.filter(i => taille(i.id) > 0);
  const nVal = eleves.filter(e => e.validated).length;
  el.replaceChildren(
    h('p', { class: 'petit-texte' }, 'Touchez une case pour voir les temps et les bonnes valeurs (moyenne, médiane, étendue) d\'un élève.'),
    h('p', { class: 'classe-info' }, `${eleves.length} élève(s) ont commencé · ${nVal} ont validé leurs calculs.`),
    h('table', { class: 'avancement' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Îlot'), ['A', 'B', 'C', 'D'].map(m => h('th', {}, `${m} — ${MODES[m].nom}`)))),
      h('tbody', {}, actifs.map(i => {
        const permis = modesPourTaille(taille(i.id));
        return h('tr', {}, h('td', {}, h('b', {}, i.nom), h('span', { class: 'petit-texte' }, ` (${taille(i.id)})`)),
          ['A', 'B', 'C', 'D'].map(m => {
            const d = eleves.find(e => e.ilot === i.id && e.mode === m);
            if (!permis.includes(m) && !d) return h('td', { class: 'na' }, '—');
            if (!d) return h('td', { class: 'attente' }, 'pas commencé');
            const bloque = d.step === 'calculs' && (d.essaisCalc ?? 0) >= 2;
            return h('td', {
              class: 'cliquable etape-' + d.step + (bloque ? ' bloque' : '') + (selection === d.id ? ' choisi' : ''),
              onclick: () => { selection = d.id; rafraichir(); document.querySelector('.detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); },
            },
              LIBELLE_ETAPE[d.step] ?? d.step,
              d.step === 'calculs' && d.essaisCalc ? h('span', { class: 'petit-texte' }, ` (${d.essaisCalc} essai${d.essaisCalc > 1 ? 's' : ''} faux)`) : null,
              d.estimation != null ? h('span', { class: 'petit-texte' }, ` · estim. ${fmt(d.estimation, 1)} m`) : null);
          }));
      }))),
    detail(eleves.find(e => e.id === selection)));
}

function ilots(el) {
  const t = { ...(config?.tailles || {}) };
  ILOTS.forEach(i => { if (t[i.id] == null) t[i.id] = 4; });
  const lignes = ILOTS.map(i => {
    const sel = h('select', { class: 'champ petit' },
      [[0, 'Absent'], [3, '3 élèves (sans mode B)'], [4, '4 élèves']].map(([v, l]) => h('option', { value: v, selected: t[i.id] === v }, l)));
    sel.addEventListener('change', () => { t[i.id] = Number(sel.value); majTotal(); });
    return h('tr', {}, h('td', {}, i.nom), h('td', {}, sel));
  });
  const total = h('p', { class: 'classe-info' });
  const majTotal = () => {
    const n = Object.values(t).reduce((s, v) => s + v, 0);
    const nB = Object.values(t).filter(v => v === 4).length;
    total.textContent = `Total : ${n} élèves · le mode B sera testé par ${nB} élève${nB > 1 ? 's' : ''}, les autres modes par ${Object.values(t).filter(v => v > 0).length}.`;
  };
  majTotal();
  const ok = h('p', { class: 'succes', hidden: true }, 'Enregistré ✓');
  el.replaceChildren(
    h('p', {}, 'Indiquez combien d\'élèves sont présents dans chaque îlot. Dans un îlot de 3, le mode B (calcul mental) est retiré.'),
    h('table', { class: 'reglage' }, lignes),
    total,
    h('button', { class: 'btn primary', onclick: async () => { await db.setConfig({ ...(config || {}), tailles: t }); ok.hidden = false; setTimeout(() => { ok.hidden = true; }, 2000); } }, 'Enregistrer'),
    ok);
  rafraichir = () => {}; // ne pas écraser la saisie en cours
}

let vueClasse = 'tout';
function classe(el) {
  const zone = h('div');
  const choix = [['tout', 'Tableau + graphique'], ['tableau', 'Tableau'], ['graphe', 'Graphique']];
  const barre = h('div', { class: 'boutons' },
    choix.map(([k, l]) => h('button', { class: 'btn petit' + (k === vueClasse ? ' primary' : ''), onclick: () => { vueClasse = k; classe(el); } }, l)),
    h('button', { class: 'btn petit', onclick: () => document.documentElement.requestFullscreen?.() }, 'Plein écran'));
  el.replaceChildren(barre, zone);
  rafraichir = () => renderClasse(zone, eleves, { grand: true, vue: vueClasse });
  rafraichir();
}

function donnees(el) {
  el.replaceChildren(
    h('p', {}, `${eleves.length} enregistrement(s) dans la base.`),
    h('div', { class: 'boutons' },
      h('button', { class: 'btn', onclick: exporter }, 'Exporter vers un tableur (CSV)'),
      h('button', { class: 'btn danger', onclick: exporterEffacer }, 'Exporter puis tout effacer')),
    h('p', { class: 'petit-texte' }, 'À faire après la séance (et après l\'essai à blanc). Le fichier CSV s\'ouvre dans Excel ou LibreOffice.'));
}

function csv() {
  const nb = x => x == null || Number.isNaN(x) ? '' : String(Math.round(x * 10) / 10).replace('.', ',');
  const ent = ['Îlot', 'Mode', 'Identité', 'Étape', 'Validé', 'Estimation (m)'];
  for (const t of ['Témoin', 'Mode']) {
    for (let i = 1; i <= 10; i++) ent.push(`${t} n°${i} (ms)`);
    ent.push(`${t} moyenne`, `${t} médiane`, `${t} étendue`, `${t} faux départs`, `${t} essais refaits`);
  }
  const lignes = [ent];
  for (const e of [...eleves].sort((a, b) => a.id.localeCompare(b.id))) {
    const l = [ilotById(e.ilot)?.nom ?? e.ilot, e.mode, identite(e.ilot, e.mode), e.step, e.validated ? 'oui' : 'non', nb(e.estimation)];
    for (const [k, sk] of [['temoin', 'temoin'], ['test', 'test']]) {
      const r = e[k] || {}, s = e.stats?.[sk] || {};
      for (let i = 0; i < 10; i++) l.push(nb(r.times?.[i]));
      l.push(nb(s.moyenne), nb(s.mediane), nb(s.etendue), nb(r.fauxDeparts), nb(r.aRefaire));
    }
    lignes.push(l);
  }
  return '﻿' + lignes.map(l => l.map(c => /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c).join(';')).join('\r\n');
}

function exporter() {
  const blob = new Blob([csv()], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `temps-reaction-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exporterEffacer() {
  if (!eleves.length) { alert('Aucune donnée à effacer.'); return; }
  exporter();
  setTimeout(async () => {
    if (!confirm(`Le fichier CSV vient d'être téléchargé.\nVérifiez qu'il est bien dans vos Téléchargements.\n\nEffacer définitivement les ${eleves.length} enregistrement(s) ?`)) return;
    try {
      await db.deleteAll(eleves.map(e => e.id));
      // Nouveau numéro de session : les tablettes encore ouvertes sur une ancienne session reviennent à l'accueil.
      await db.setConfig({ ...(config || {}), session: Date.now().toString(36) });
      alert('Données effacées. Les tablettes reviennent à l\'écran d\'accueil.');
    }
    catch (e) { alert('Échec de l\'effacement : ' + (e.message || e)); }
  }, 600);
}

async function boot() {
  try { db = await initDb(); }
  catch (e) { main.replaceChildren(h('p', { class: 'erreur' }, 'Connexion impossible : ' + (e.message || e))); return; }
  if (await db.profConnecte()) tableau(); else connexion();
}
boot();
