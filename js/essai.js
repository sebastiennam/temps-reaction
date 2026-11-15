// Page « essayer les modes » : lance n'importe quel test directement, sans îlot ni enregistrement.
// Rien n'est envoyé à la base : utile pour découvrir les modes ou les montrer en classe.
import { MODES, ORDRE_MODES, h, stats, fmt } from './common.js';
import { runTest } from './engine.js';
import { introTest } from './intros.js';
import { renderFreinage } from './freinage.js';

const app = document.getElementById('app');
const main = h('main', { id: 'main' });
const retour = h('button', { class: 'btn petit', hidden: true, onclick: () => menu() }, 'Retour aux modes');
app.append(
  h('header', { class: 'barre' }, h('span', { class: 'titre' }, '⏱️ Temps de réaction — essayer les modes'), h('span'), retour),
  h('div', { class: 'demo' }, 'Page d\'essai : rien n\'est enregistré, rien n\'apparaît dans la classe.'),
  main);

let test = null, nCount = 3;

function menu() {
  test?.abort(); test = null;
  retour.hidden = true;
  const choixN = h('div', { class: 'boutons' }, [3, 10].map(n =>
    h('button', { class: 'btn' + (n === nCount ? ' primary' : ''), onclick: () => { nCount = n; menu(); } }, `${n} essais comptés`)));
  const carte = (kind, nom, desc) => h('button', { class: 'btn big', onclick: () => lancer(kind) },
    h('strong', {}, nom), h('br'), h('small', {}, desc));
  main.replaceChildren(h('div', { class: 'screen' },
    h('h1', {}, 'Essayer un mode'),
    h('p', {}, 'Choisis un test pour voir exactement ce que voient les élèves : écran d\'explication, entraînement, puis essais comptés.'),
    h('div', { class: 'grille-ilots' },
      carte('temoin', 'Témoin', 'La voiture devant freine, rien d\'autre à faire'),
      ...ORDRE_MODES.map(m => carte(m, `${m} — ${MODES[m].nom}`, MODES[m].titre)),
      h('button', { class: 'btn big', onclick: freinage }, h('strong', {}, 'Onglet Freinage'), h('br'), h('small', {}, "Énergie cinétique et distance d'arrêt"))),
    h('p', { style: 'margin-top:24px' }, 'Longueur du test :'),
    choixN));
}

function lancer(kind) {
  retour.hidden = false;
  const nom = kind === 'temoin' ? 'Test témoin' : `${kind} — ${MODES[kind].nom}`;
  test = runTest(main, {
    kind, nCount, titre: nom, intro: introTest(kind),
    onDone: r => {
      test = null;
      const s = stats(r.times);
      main.replaceChildren(h('div', { class: 'screen center' },
        h('h1', {}, nom),
        h('p', {}, `Temps : ${r.times.join(' · ')} ms`),
        h('p', {}, `Moyenne : ${fmt(s.moyenne, 1)} ms · Médiane : ${fmt(s.mediane, 1)} ms · Étendue : ${fmt(s.etendue, 0)} ms`),
        h('p', { class: 'info' }, `Faux départs : ${r.fauxDeparts} · Essais à refaire : ${r.aRefaire}`),
        h('div', { class: 'boutons' },
          h('button', { class: 'btn primary big', onclick: () => lancer(kind) }, 'Refaire ce test'),
          h('button', { class: 'btn big', onclick: menu }, 'Autre mode'))));
    },
  });
}

function freinage() {
  test?.abort(); test = null; retour.hidden = false;
  const el = h('div');
  main.replaceChildren(h('div', { class: 'screen' }, h('h1', {}, 'Freinage'), el));
  renderFreinage(el, { a: { nom: 'Élève rapide (0,35 s)', s: 0.35 }, b: { nom: 'Élève distrait (0,8 s)', s: 0.8 }, code: { nom: 'Code de la route (1 s)', s: 1 } });
}

menu();
