// Vue élève.
import { initDb, DEMO } from './db.js';
import {
  ILOTS, MODES, ETAPES, LIBELLE_ETAPE, modesPourTaille, ilotById, docId, identite,
  stats, fmt, h, pick, parseNombre, lsGet, lsSet, lsDel,
} from './common.js';
import { runTest } from './engine.js';
import { introTest } from './intros.js';
import { renderClasse } from './classe.js';

const app = document.getElementById('app');
const idEl = h('span', { class: 'identite' });
const quitBtn = h('button', { class: 'btn petit', onclick: () => { if (confirm('Quitter ? Tu pourras reprendre en choisissant ton îlot puis « Je reprends ».')) quitter(); } }, 'Quitter');
const main = h('main', { id: 'main' });
app.append(...[
  h('header', { class: 'barre' }, h('span', { class: 'titre' }, '⏱️ Temps de réaction'), idEl, quitBtn),
  DEMO ? h('div', { class: 'demo' }, 'Mode démo : les données restent sur cet appareil.') : null,
  main].filter(Boolean));

let db, eleves = [], config = null, S = null, rafraichir = null, testEnCours = null;
let configServeur = false; // vrai dès qu'on a reçu les réglages depuis le serveur (pas seulement le cache)

const tailleIlot = id => config?.tailles?.[id] ?? 4;
const id = () => docId(S.ilot, S.mode);

function setEntete() {
  idEl.textContent = S ? identite(S.ilot, S.mode) : '';
  quitBtn.hidden = !S;
}

function save(partiel) {
  Object.assign(S.data, partiel);
  lsSet('tr_d_' + id(), S.data);
  db.saveEleve(id(), S.data);
}

function demarrerSession(ilot, mode, data) {
  S = { ilot, mode, data };
  lsSet('tr_courant', { ilot, mode });
  lsSet('tr_d_' + id(), data);
  setEntete();
}

function sessionEffacee() {
  lsDel('tr_d_' + id());
  messageAccueil = 'La session précédente a été effacée par le professeur. Choisis ton îlot pour commencer.';
  quitter();
}
let messageAccueil = null;

function quitter() {
  lsDel('tr_courant');
  S = null; rafraichir = null;
  setEntete();
  ecranIlots();
}

function arreterTest() { testEnCours?.abort(); testEnCours = null; }
function ecran(...kids) { arreterTest(); rafraichir = null; main.replaceChildren(h('div', { class: 'screen' }, ...kids)); window.scrollTo(0, 0); }

// ── Accueil : choix de l'îlot ────────────────────────────────────────────
function ecranIlots() {
  const liste = ILOTS.filter(i => tailleIlot(i.id) > 0);
  ecran(
    messageAccueil ? h('p', { class: 'info' }, messageAccueil) : null,
    h('h1', {}, 'Choisis ton îlot'),
    h('div', { class: 'grille-ilots' }, liste.map(i =>
      h('button', { class: 'btn ilot', onclick: () => { messageAccueil = null; ecranChoix(i.id); } }, i.nom))));
  rafraichir = () => { if (!S) ecranIlots(); };
}

// ── Nouvel élève ou reprise ──────────────────────────────────────────────
function ecranChoix(ilot) {
  const rendre = () => {
    const autorises = modesPourTaille(tailleIlot(ilot));
    const docs = eleves.filter(e => e.ilot === ilot);
    const pris = docs.map(e => e.mode);
    const libres = autorises.filter(m => !pris.includes(m));
    ecran(
      h('h1', {}, ilotById(ilot).nom),
      libres.length
        ? h('button', { class: 'btn primary big', onclick: () => nouveau(ilot, libres) }, 'Je commence (nouvel élève)')
        : h('p', { class: 'info' }, 'Tous les élèves de cet îlot ont déjà commencé.'),
      docs.length ? h('div', { class: 'reprise' },
        h('h2', {}, 'Je reprends ma session'),
        h('p', { class: 'petit-texte' }, 'Touche ta session :'),
        docs.sort((a, b) => a.mode.localeCompare(b.mode)).map(d =>
          h('button', { class: 'btn reprendre', onclick: () => reprendre(d) },
            h('b', {}, identite(d.ilot, d.mode)), h('span', { class: 'etat' }, LIBELLE_ETAPE[d.step] ?? '')))) : null,
      h('button', { class: 'btn lien', onclick: ecranIlots }, '← Changer d\'îlot'));
    rafraichir = rendre;
  };
  rendre();
}

let reservationEnCours = false;
async function nouveau(ilot, libres) {
  if (reservationEnCours) return;
  reservationEnCours = true;
  rafraichir = null;
  ecran(h('p', { class: 'chargement' }, 'Tirage de ta distraction…'));
  let mode = null;
  try {
    // Attendre les réglages à jour du serveur (numéro de session), 4 s au plus.
    for (let i = 0; i < 40 && !configServeur; i++) await new Promise(r => setTimeout(r, 100));
    // Essaie les modes libres dans un ordre aléatoire ; la base refuse un mode déjà pris entre-temps.
    for (const m of [...libres].sort(() => Math.random() - 0.5)) {
      if (await db.claimEleve(docId(ilot, m), { ilot, mode: m, step: 'accroche', validated: false })) { mode = m; break; }
    }
  } finally { reservationEnCours = false; }
  if (!mode) {
    ecran(h('h1', {}, 'Oups'), h('p', {}, 'Toutes les distractions de cet îlot viennent d\'être prises. Si tu n\'as pas encore commencé, appelle le professeur.'),
      h('button', { class: 'btn primary big', onclick: () => ecranChoix(ilot) }, 'Retour'));
    return;
  }
  demarrerSession(ilot, mode, { ilot, mode, step: 'accroche', validated: false, _session: config?.session ?? null });
  ecran(
    h('h1', {}, 'Bienvenue !'),
    h('p', {}, 'Tu es :'),
    h('p', { class: 'grosse-identite' }, identite(ilot, mode)),
    h('p', {}, `Tu vas passer deux tests : le test témoin, puis le test « ${MODES[mode].titre} ».`),
    h('p', { class: 'info' }, '✏️ Écris ta distraction sur ta feuille : elle te servira pour reprendre ta session plus tard.'),
    h('button', { class: 'btn primary big', onclick: ecranAccroche }, 'Continuer'));
}

function reprendre(doc) {
  const local = lsGet('tr_d_' + doc.id);
  const { id: _i, maj: _m, ...distant } = doc;
  // On garde la version la plus avancée (local si le réseau n'a pas encore tout envoyé).
  const data = local && local._session === (config?.session ?? null) && ETAPES.indexOf(local.step) >= ETAPES.indexOf(distant.step) ? local : distant;
  data._session = config?.session ?? null;
  demarrerSession(doc.ilot, doc.mode, data);
  allerEtape();
}

function allerEtape() {
  switch (S.data.step) {
    case 'accroche': return ecranAccroche();
    case 'temoin': return ecranTest('temoin');
    case 'test': return ecranTest('mode');
    case 'calculs': return ecranCalculs();
    case 'fini': return ecranFini('resultats');
    default: return ecranAccroche();
  }
}

// ── 0. Accroche ──────────────────────────────────────────────────────────
function ecranAccroche() {
  const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'champ', placeholder: '?', 'aria-label': 'Estimation en mètres' });
  const err = h('p', { class: 'erreur' });
  const valider = () => {
    const v = parseNombre(inp.value);
    if (!(v > 0 && v < 2000)) { err.textContent = 'Écris un nombre de mètres (par exemple 12).'; return; }
    save({ estimation: v, step: 'temoin' });
    ecranTest('temoin');
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') valider(); });
  ecran(
    h('h1', {}, 'Avant de commencer…'),
    h('p', { class: 'question' }, 'À 50 km/h, combien de mètres parcourt une voiture avant que le conducteur commence à freiner ?'),
    h('p', {}, 'Donne ton estimation, sans calcul. Il n\'y a pas de mauvaise réponse.'),
    h('div', { class: 'ligne-champ' }, inp, h('span', { class: 'unite' }, 'mètres')),
    err,
    h('button', { class: 'btn primary big', onclick: valider }, 'Valider'));
  inp.focus();
}

// ── 1. Tests ─────────────────────────────────────────────────────────────
function ecranTest(quoi) {
  arreterTest(); rafraichir = null;
  const kind = quoi === 'temoin' ? 'temoin' : S.mode;
  // Essais déjà comptés avant un plantage (gardés sur la tablette uniquement).
  const enCours = S.data._enCours?.quoi === quoi ? S.data._enCours : null;
  testEnCours = runTest(main, {
    kind,
    titre: quoi === 'temoin' ? 'Test 1 : le test témoin' : `Test 2 : ${MODES[S.mode].titre}`,
    intro: introTest(kind),
    reprise: enCours,
    onProgress: p => { S.data._enCours = { quoi, ...p }; lsSet('tr_d_' + id(), S.data); },
    onDone: r => {
      delete S.data._enCours;
      if (quoi === 'temoin') { save({ temoin: r, step: 'test' }); recap('Test témoin terminé !', r, () => ecranTest('mode')); }
      else { save({ test: r, step: 'calculs' }); recap('Test 2 terminé !', r, ecranPause); }
    },
  });
}

function tableTemps(times) {
  return h('table', { class: 'temps' },
    h('tr', {}, times.map((_, i) => h('th', {}, `n°${i + 1}`))),
    h('tr', {}, times.map(t => h('td', {}, String(t)))));
}

function recap(titre, r, suite) {
  ecran(
    h('h1', {}, titre),
    h('p', {}, 'Tes 10 temps, en millisecondes (ms) :'),
    tableTemps(r.times),
    h('p', { class: 'petit-texte' }, `Faux départs : ${r.fauxDeparts} · Essais refaits : ${r.aRefaire}`),
    h('p', { class: 'info' }, '✏️ Vérifiez ensemble que les 10 temps sont bien recopiés sur la feuille.'),
    h('button', { class: 'btn primary big', onclick: suite }, 'C\'est vérifié, continuer'));
}

function ecranPause() {
  ecran(
    h('h1', {}, 'Tes deux tests sont terminés ! 🎉'),
    h('p', {}, 'Sur ta feuille, pour chaque test : range tes 10 valeurs dans l\'ordre, puis calcule la moyenne, la médiane et l\'étendue.'),
    h('p', { class: 'info' }, `Pour revenir plus tard : choisis ton îlot, puis « Je reprends », puis « ${identite(S.ilot, S.mode)} ».`),
    h('div', { class: 'boutons' },
      h('button', { class: 'btn primary big', onclick: quitter }, 'Je laisse la tablette à l\'élève suivant'),
      h('button', { class: 'btn big', onclick: ecranCalculs }, 'J\'ai fini mes calculs, je les saisis')));
}

// ── 2. Vérification des calculs ──────────────────────────────────────────
function ecranCalculs() {
  const blocs = [
    { cle: 'temoin', titre: 'Test témoin', times: S.data.temoin.times },
    { cle: 'test', titre: `Test 2 : ${MODES[S.mode].nom}`, times: S.data.test.times },
  ].map(b => {
    const champ = (nom) => h('input', { type: 'text', inputmode: 'decimal', class: 'champ petit', 'aria-label': `${nom} — ${b.titre}` });
    b.moy = champ('Moyenne'); b.med = champ('Médiane'); b.et = champ('Étendue');
    const champLibelle = (nom, inp) => h('label', {}, nom, h('span', { class: 'ligne-champ' }, inp, h('span', { class: 'unite' }, 'ms')));
    b.el = h('section', { class: 'bloc-calcul' },
      h('h2', {}, b.titre),
      h('p', { class: 'petit-texte' }, 'Tes 10 temps (ms), dans l\'ordre des essais :'),
      tableTemps(b.times),
      h('div', { class: 'champs' },
        champLibelle('Moyenne', b.moy), champLibelle('Médiane', b.med), champLibelle('Étendue', b.et)));
    return b;
  });
  const msg = h('p', { class: 'indice', 'aria-live': 'polite' });
  let essais = S.data.essaisCalc || 0;

  const verifier = () => {
    let tout = true;
    for (const b of blocs) {
      const vrai = stats(b.times);
      const tests = [
        [b.moy, x => Math.abs(x - vrai.moyenne) <= 1],
        [b.med, x => Math.abs(x - vrai.mediane) <= 0.5],
        [b.et, x => Math.abs(x - vrai.etendue) < 0.01],
      ];
      for (const [inp, ok] of tests) {
        const x = parseNombre(inp.value);
        const bon = !Number.isNaN(x) && ok(x);
        inp.classList.toggle('juste', bon); inp.classList.toggle('faux', !bon);
        tout = tout && bon;
      }
    }
    if (tout) {
      save({
        stats: { temoin: stats(S.data.temoin.times), test: stats(S.data.test.times) },
        validated: true, step: 'fini',
      });
      ecranFini('resultats', true);
      return;
    }
    essais++;
    save({ essaisCalc: essais }); // visible par le professeur (élève en difficulté)
    msg.textContent = essais === 1
      ? 'Indice : as-tu rangé les valeurs dans l\'ordre ? (Les cases en rouge sont à corriger.)'
      : 'Les cases en rouge sont à corriger.';
  };

  ecran(
    h('h1', {}, 'Mes statistiques'),
    h('p', {}, 'Saisis les résultats calculés sur ta feuille. Tu peux arrondir la moyenne à l\'unité.'),
    blocs.map(b => b.el),
    msg,
    h('button', { class: 'btn primary big', onclick: verifier }, 'Vérifier'));
}

// ── 3. Fin : résultats, classe, essais hors série ────────────────────────
function ecranFini(onglet, bravo = false) {
  const tabs = [['resultats', 'Mes résultats'], ['classe', 'La classe'], ['hors', 'Refaire un test']];
  const contenu = h('div', { class: 'onglet' });
  const nav = h('nav', { class: 'onglets' }, tabs.map(([k, l]) =>
    h('button', { class: 'tab' + (k === onglet ? ' actif' : ''), onclick: () => ecranFini(k) }, l)));
  ecran(nav, contenu, h('button', { class: 'btn lien', onclick: quitter }, 'Laisser la tablette à l\'élève suivant'));

  if (onglet === 'resultats') {
    const st = S.data.stats;
    const ligne = (nom, s) => h('tr', {}, h('td', {}, nom), h('td', {}, fmt(s.moyenne, 1)), h('td', {}, fmt(s.mediane, 1)), h('td', {}, fmt(s.etendue, 0)));
    contenu.append(
      bravo ? h('p', { class: 'succes' }, '✅ Bravo, tes calculs sont justes ! Tes résultats rejoignent ceux de la classe.') : null,
      h('table', { class: 'resultats' },
        h('tr', {}, h('th', {}, ''), h('th', {}, 'Moyenne (ms)'), h('th', {}, 'Médiane (ms)'), h('th', {}, 'Étendue (ms)')),
        ligne('Test témoin', st.temoin), ligne(`Test 2 : ${MODES[S.mode].nom}`, st.test)),
      h('div', { class: 'rappel' },
        h('p', {}, 'Au tout début, tu as estimé qu\'une voiture à 50 km/h parcourt'),
        h('p', { class: 'estimation' }, `${fmt(S.data.estimation, 1)} m`),
        h('p', {}, 'avant que le conducteur commence à freiner.')),
      h('p', { class: 'info' }, 'Continue ta feuille : calcule ta distance de réaction et compare-la à ton estimation.'));
  } else if (onglet === 'classe') {
    rafraichir = () => renderClasse(contenu, eleves, { moi: { ilot: S.ilot, mode: S.mode } });
    rafraichir();
  } else {
    contenu.append(
      h('p', {}, 'Tu veux améliorer ton temps ? Tu peux refaire un test.'),
      h('p', { class: 'info' }, 'Ces essais « hors série » ne comptent pas dans les résultats de la classe.'),
      h('div', { class: 'boutons' },
        h('button', { class: 'btn big', onclick: () => horsSerie('temoin') }, 'Refaire le test témoin'),
        h('button', { class: 'btn big', onclick: () => horsSerie(S.mode) }, `Refaire le test ${MODES[S.mode].nom}`)));
  }
}

function horsSerie(kind) {
  arreterTest(); rafraichir = null;
  testEnCours = runTest(main, {
    kind, nTrain: 0,
    titre: 'Essai hors série (non compté)',
    intro: introTest(kind),
    onDone: r => {
      const s = stats(r.times);
      ecran(
        h('h1', {}, 'Résultat hors série'),
        tableTemps(r.times),
        h('p', {}, `Moyenne : ${fmt(s.moyenne, 1)} ms · Médiane : ${fmt(s.mediane, 1)} ms · Étendue : ${fmt(s.etendue, 0)} ms`),
        h('p', { class: 'info' }, 'Ces essais ne comptent pas dans les résultats de la classe.'),
        h('button', { class: 'btn primary big', onclick: () => ecranFini('hors') }, 'Retour'));
    },
  });
}

// ── Démarrage ────────────────────────────────────────────────────────────
async function boot() {
  setEntete();
  ecran(h('p', { class: 'chargement' }, 'Chargement…'));
  try {
    db = await initDb();
    await db.signInEleve();
  } catch (e) {
    console.error(e);
    ecran(h('h1', {}, 'Connexion impossible'),
      h('p', {}, 'Vérifie la connexion internet, puis recharge la page. Si le problème continue, appelle le professeur.'),
      h('pre', { class: 'petit-texte' }, String(e?.message || e)));
    return;
  }
  // Reprise automatique (rechargement de la page, plantage) avant d'écouter la base,
  // pour que la vérification « session effacée ? » s'applique aussi à la session reprise.
  const cur = lsGet('tr_courant');
  const data = cur && lsGet('tr_d_' + docId(cur.ilot, cur.mode));
  if (data) { demarrerSession(cur.ilot, cur.mode, data); allerEtape(); }
  else ecranIlots();
  db.watchEleves((l, meta) => {
    eleves = l;
    // Session effacée par le professeur (élève supprimé) : on remet la tablette à zéro.
    if (S && !meta?.fromCache && !reservationEnCours && !l.some(e => e.id === id())) return sessionEffacee();
    rafraichir?.();
  });
  db.watchConfig((c, meta) => {
    config = c;
    if (meta?.fromCache) return rafraichir?.();
    configServeur = true;
    // Données effacées après l'essai à blanc : les anciennes sessions des tablettes ne sont plus valables.
    if (S && c?.session && c.session !== S.data._session) return sessionEffacee();
    rafraichir?.();
  });
}
boot();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker indisponible', e));
