// Onglet « Freinage » : énergie cinétique et distance d'arrêt, à explorer après le calcul sur la feuille.
// Modèle : les freins dissipent une énergie fixe par mètre (7 000 J/m sur route sèche, 4 000 J/m mouillée),
// donc distance de freinage = Ec ÷ (J par mètre), avec Ec = ½ m v².
import { h, fmt } from './common.js';

const ROUTES = { seche: { nom: 'Route sèche', jpm: 7000 }, mouillee: { nom: 'Route mouillée', jpm: 4000 } };
const MASSES = { 1000: 'Voiture (1 000 kg)', 1500: 'Voiture chargée (1 500 kg)' };
const ECHELLE = 200;               // m : longueur de la règle (fixe, pour comparer les situations)
const EC_MAX = 0.5 * 1500 * (130 / 3.6) ** 2;

const nb = (x, d = 0) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

// temps : { cle: { nom, s } } — temps de réaction proposés (en secondes)
export function renderFreinage(el, temps) {
  const cles = Object.keys(temps);
  const etat = { kmh: 50, m: 1000, route: 'seche', t: cles[0] };

  const choix = (titre, options, cle) => h('div', { class: 'fr-choix' },
    h('span', { class: 'fr-label' }, titre),
    h('div', { class: 'boutons' }, Object.entries(options).map(([k, nom]) =>
      h('button', { class: 'btn petit' + (String(etat[cle]) === k ? ' primary' : ''), onclick: () => { etat[cle] = cle === 'm' ? +k : k; rendre(); } }, nom))));

  function rendre() {
    const curseur = h('input', { type: 'range', min: 20, max: 130, step: 10, value: etat.kmh, class: 'fr-curseur', 'aria-label': 'Vitesse en km/h' });
    curseur.addEventListener('input', () => { etat.kmh = +curseur.value; maj(); });
    const r = {
      kmh: h('b'), ms: h('span', { class: 'petit-texte' }), ec: h('b'), barre: h('div', { class: 'fr-ec' }),
      reac: h('div', { class: 'fr-seg fr-reac' }), frein: h('div', { class: 'fr-seg fr-frein' }),
      stop: h('span', { class: 'fr-stop', 'aria-hidden': 'true' }, '🛑'), trop: h('p', { class: 'petit-texte' }),
      dr: h('td'), df: h('td'), da: h('td'),
    };
    const graduations = [];
    for (let m = 0; m <= ECHELLE; m += 25) graduations.push(h('span', { class: 'fr-grad', style: `left:${m / ECHELLE * 100}%` }, `${m} m`));

    el.replaceChildren(
      h('p', {}, "Pour s'arrêter, la voiture doit perdre toute son ", h('b', {}, 'énergie cinétique'), '. Les freins en dissipent une quantité fixe à chaque mètre.'),
      h('div', { class: 'fr-reglages' },
        h('div', { class: 'fr-choix' }, h('span', { class: 'fr-label' }, 'Vitesse'), h('div', { class: 'fr-vitesse' }, curseur, r.kmh, r.ms)),
        choix('Masse', MASSES, 'm'),
        choix('Route', Object.fromEntries(Object.entries(ROUTES).map(([k, x]) => [k, `${x.nom} (${nb(x.jpm)} J par mètre)`])), 'route'),
        choix('Temps de réaction', Object.fromEntries(cles.map(k => [k, temps[k].nom])), 't')),
      h('div', { class: 'fr-bloc' },
        h('div', { class: 'fr-ligne' }, h('span', {}, 'Énergie cinétique'), r.ec),
        h('div', { class: 'fr-barre' }, r.barre)),
      h('div', { class: 'fr-bloc' },
        h('div', { class: 'fr-route' }, r.reac, r.frein, h('span', { class: 'fr-auto', 'aria-hidden': 'true' }, '🚗'), r.stop),
        h('div', { class: 'fr-regle' }, graduations), r.trop),
      h('table', { class: 'resultats fr-table' },
        h('tr', {}, h('td', {}, h('span', { class: 'fr-pastille fr-reac' }), 'Distance de réaction'), r.dr),
        h('tr', {}, h('td', {}, h('span', { class: 'fr-pastille fr-frein' }), 'Distance de freinage'), r.df),
        h('tr', { class: 'fr-total' }, h('td', {}, "Distance d'arrêt"), r.da)),
      h('p', { class: 'info' }, "À essayer : double la vitesse (de 50 à 100 km/h). Que deviennent l'énergie cinétique et la distance de freinage ? Et sur route mouillée ? Avec la voiture chargée ?"));

    function maj() {
      const v = etat.kmh / 3.6, t = temps[etat.t].s, jpm = ROUTES[etat.route].jpm;
      const ec = 0.5 * etat.m * v * v, dr = v * t, df = ec / jpm, da = dr + df;
      const pct = x => Math.min(100, x / ECHELLE * 100) + '%';
      r.kmh.textContent = `${etat.kmh} km/h`; r.ms.textContent = `≈ ${nb(v, 1)} m/s`;
      r.ec.textContent = `${nb(Math.round(ec / 100) * 100)} J`; r.barre.style.width = (ec / EC_MAX * 100) + '%';
      r.reac.style.width = pct(dr); r.frein.style.left = pct(dr); r.frein.style.width = pct(df); r.stop.style.left = pct(da);
      r.trop.textContent = da > ECHELLE ? `La distance d'arrêt dépasse ${ECHELLE} m !` : '';
      r.dr.textContent = `${nb(dr, 1)} m`; r.df.textContent = `${nb(df, 1)} m`; r.da.textContent = `${nb(da, 1)} m`;
    }
    maj();
  }
  rendre();
}

// Temps de réaction proposés à partir des résultats de l'élève (médianes en ms).
export function tempsEleve(stats, nomMode) {
  const t = {};
  if (stats?.test?.mediane) t.mode = { nom: `Ma médiane, ${nomMode} (${fmt(stats.test.mediane / 1000, 3)} s)`, s: stats.test.mediane / 1000 };
  if (stats?.temoin?.mediane) t.temoin = { nom: `Ma médiane, témoin (${fmt(stats.temoin.mediane / 1000, 3)} s)`, s: stats.temoin.mediane / 1000 };
  t.code = { nom: 'Code de la route (1 s)', s: 1 };
  return t;
}
