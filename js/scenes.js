// Les scènes des différents modes. Chaque scène expose :
//   startTrial()  : lance un essai (et appelle api.signal() quand le signal de freinage apparaît)
//   stopTrial()   : arrête l'essai en cours
//   earlyBrake()  : (facultatif) message si un freinage avant le signal est une erreur « leurre »
//   destroy()
import { h, rand, randInt, pick, shuffle } from './common.js';
import { SCENARIOS } from './sms-scenarios.js';

export const CAR_SVG = `
<svg class="car" viewBox="0 0 300 215" aria-hidden="true">
  <rect x="34" y="178" width="46" height="34" rx="7" fill="#1d1f24"/>
  <rect x="220" y="178" width="46" height="34" rx="7" fill="#1d1f24"/>
  <path d="M58 104 L78 34 Q84 14 108 14 L192 14 Q216 14 222 34 L242 104 Z" fill="#2a56a6"/>
  <path d="M74 98 L90 40 Q94 26 112 26 L188 26 Q206 26 210 40 L226 98 Z" fill="#a9cdea"/>
  <rect class="stop" x="122" y="17" width="56" height="7" rx="3"/>
  <rect x="12" y="98" width="276" height="92" rx="20" fill="#3367c2"/>
  <rect class="stop" x="22" y="110" width="58" height="30" rx="7"/>
  <rect class="clig clig-g" x="22" y="143" width="58" height="15" rx="6"/>
  <rect class="stop" x="220" y="110" width="58" height="30" rx="7"/>
  <rect class="clig clig-d" x="220" y="143" width="58" height="15" rx="6"/>
  <rect x="112" y="128" width="76" height="26" rx="4" fill="#f3f3f3" stroke="#8a8a8a"/>
  <text x="150" y="147" text-anchor="middle" font-size="15" font-family="monospace" fill="#223">FR-3E-24</text>
  <rect x="6" y="172" width="288" height="16" rx="8" fill="#22314d"/>
</svg>`;

function vueRoute(cls = '') {
  return h('div', {
    class: 'vue-route ' + cls,
    html: `<div class="ciel"></div><div class="route"><div class="ligne"></div></div><div class="voiture">${CAR_SVG}</div>`,
  });
}

function minuteurs() {
  const ids = new Set();
  return {
    set(fn, ms) { const id = setTimeout(() => { ids.delete(id); fn(); }, ms); ids.add(id); return id; },
    clear() { ids.forEach(clearTimeout); ids.clear(); },
  };
}

export function createScene(kind, stage, api, ctrl) {
  stage.replaceChildren();
  switch (kind) {
    case 'temoin': return sceneTemoin(stage, api);
    case 'A': return sceneA(stage, api);
    case 'B': return sceneB(stage, api);
    case 'C': return sceneC(stage, api);
    case 'D': return sceneD(stage, api, ctrl);
    default: throw new Error('Mode inconnu : ' + kind);
  }
}

// ── Témoin : la voiture devant freine entre 2 et 6 s ──────────────────────
function sceneTemoin(stage, api) {
  const vue = vueRoute(); stage.append(vue);
  const car = vue.querySelector('.car');
  const T = minuteurs();
  return {
    startTrial() {
      car.classList.remove('freine');
      T.set(() => { car.classList.add('freine'); api.signal(); }, rand(2000, 6000));
    },
    stopTrial() { T.clear(); },
    destroy() { T.clear(); vue.remove(); },
  };
}

// ── A : clignotants irréguliers, puis freinage ────────────────────────────
// Le scénario d'un essai est une suite d'événements : clignotant (g/d), éteint, … puis freinage.
export function scenarioA() {
  const ev = [];
  if (Math.random() < 0.2) {               // freinage « dès le début »
    ev.push([rand(2000, 3500), 'frein']);
    return ev;
  }
  const T = rand(3500, 10000);             // instant du freinage
  let t = rand(300, 1200);
  while (t < T - 500) {
    const cote = Math.random() < 0.5 ? 'g' : 'd';
    const duree = rand(1300, 3200);
    ev.push([t, 'clig', cote]);
    if (t + duree >= T - 300) break;       // le clignotant dure jusqu'au freinage
    ev.push([t + duree, 'off']);
    t += duree + rand(400, 2000);
  }
  ev.push([T, 'frein']);
  return ev;
}

function sceneA(stage, api) {
  const vue = vueRoute(); stage.append(vue);
  const car = vue.querySelector('.car');
  const T = minuteurs();
  const eteindre = () => car.classList.remove('clig-g', 'clig-d');
  return {
    startTrial() {
      car.classList.remove('freine'); eteindre();
      for (const [t, type, cote] of scenarioA()) {
        T.set(() => {
          if (type === 'clig') { eteindre(); car.classList.add('clig-' + cote); }
          else if (type === 'off') eteindre();
          else { eteindre(); car.classList.add('freine'); api.signal(); }
        }, t);
      }
    },
    stopTrial() { T.clear(); eteindre(); },
    destroy() { T.clear(); vue.remove(); },
  };
}

// ── B : calcul mental enchaîné ────────────────────────────────────────────
export function genCalcul() {
  const type = pick(['+', '+', '-', '-', '×']);
  let a, b, r;
  if (type === '+') { a = randInt(4, 15); b = randInt(2, 9); r = a + b; }
  else if (type === '-') { a = randInt(9, 20); b = randInt(2, 9); r = a - b; }
  else { a = randInt(2, 5); b = randInt(2, 9); r = a * b; }
  const ecarts = type === '×' ? [a, -a, 1, -1, 2] : [1, -1, 2, -2, 10, -10];
  const leurres = new Set();
  for (const e of shuffle(ecarts)) { const v = r + e; if (v >= 0 && v !== r) leurres.add(v); if (leurres.size === 2) break; }
  return { texte: `${a} ${type} ${b}`, reponse: r, choix: shuffle([r, ...leurres]) };
}

function sceneB(stage, api) {
  const vue = vueRoute('petite');
  const calc = h('div', { class: 'calcul' });
  const q = h('div', { class: 'calcul-q' });
  const choix = h('div', { class: 'calcul-choix' });
  calc.append(q, choix);
  const wrap = h('div', { class: 'scene-b' }, vue, calc);
  stage.append(wrap);
  const car = vue.querySelector('.car');
  const T = minuteurs();
  let actif = false, signal = false, calcTimer = null, courant = null;

  function suivant() {
    courant = genCalcul();
    q.textContent = courant.texte + ' = ?';
    choix.replaceChildren(...courant.choix.map(v =>
      h('button', { class: 'btn choix', onpointerdown: e => { e.preventDefault(); repondre(v); } }, String(v))));
    clearTimeout(calcTimer);
    calcTimer = setTimeout(() => { if (actif && !signal) api.fail("Trop lent sur le calcul : il faut répondre sans t'arrêter. Essai à refaire."); }, 4000);
  }
  function repondre(v) {
    if (!actif || signal) return;
    clearTimeout(calcTimer);
    if (v === courant.reponse) suivant();
    else api.fail('Mauvaise réponse au calcul. Essai à refaire.');
  }
  function attente() { q.textContent = '…'; choix.replaceChildren(); }
  attente();
  return {
    startTrial() {
      car.classList.remove('freine');
      actif = true; signal = false;
      suivant();
      T.set(() => { signal = true; car.classList.add('freine'); api.signal(); }, rand(4000, 10000));
    },
    stopTrial() { actif = false; clearTimeout(calcTimer); T.clear(); choix.querySelectorAll('button').forEach(b => b.disabled = true); },
    destroy() { this.stopTrial(); wrap.remove(); },
  };
}

// ── C : SMS ──────────────────────────────────────────────────────────────
function sceneC(stage, api) {
  const vue = vueRoute('petite');
  const titre = h('div', { class: 'tel-titre' });
  const fil = h('div', { class: 'tel-fil' });
  const reps = h('div', { class: 'tel-reps' });
  const tel = h('div', { class: 'tel' }, titre, fil, reps);
  const wrap = h('div', { class: 'scene-c' }, tel, h('div', { class: 'scene-c-route' }, vue));
  stage.append(wrap);
  const car = vue.querySelector('.car');
  const T = minuteurs();
  const scenarios = shuffle(SCENARIOS);
  let si = 0, step = 0, actif = false, premiereQ = false, questionAffichee = false;

  const sc = () => scenarios[si % scenarios.length];
  const couleur = nom => ['#c2410c', '#7c3aed', '#047857'][sc().membres.indexOf(nom) % 3] || '#334';

  function ouvrirConversation() {
    titre.textContent = sc().groupe;
    fil.replaceChildren(h('div', { class: 'tel-sys' }, 'Nouvelle conversation'));
  }
  function bulle(auteur, texte, moi = false, question = false) {
    const b = moi
      ? h('div', { class: 'bulle moi' }, texte)
      : h('div', { class: 'bulle' + (question ? ' question' : '') }, h('span', { class: 'auteur', style: `color:${couleur(auteur)}` }, auteur), texte);
    fil.append(b);
    while (fil.children.length > 40) fil.firstChild.remove();
    fil.scrollTop = fil.scrollHeight;
  }
  const delai = txt => Math.min(2600, 700 + 32 * txt.length);

  function avancer() {
    if (!actif) return;
    if (step >= sc().steps.length) { si++; step = 0; ouvrirConversation(); T.set(avancer, 900); return; }
    const s = sc().steps[step];
    if (s[0] === 'm') { step++; bulle(s[1], s[2]); T.set(avancer, delai(s[2])); return; }
    // question
    if (!questionAffichee) { bulle(s[1], s[2], false, true); questionAffichee = true; }
    const bonne = s[3][0];
    reps.replaceChildren(...shuffle(s[3]).map(opt =>
      h('button', { class: 'btn rep', onpointerdown: e => { e.preventDefault(); repondre(opt, bonne); } }, opt)));
    if (!premiereQ) {
      premiereQ = true;
      T.set(() => { car.classList.add('freine'); api.signal(); }, rand(3000, 12000));
    }
  }
  function repondre(opt, bonne) {
    if (!actif) return;
    reps.replaceChildren();
    bulle('moi', opt, true);
    step++; questionAffichee = false;
    if (opt === bonne) T.set(avancer, 500);
    else api.fail("Mauvaise réponse : ce n'est pas ce qui a été dit dans la conversation. Essai à refaire.");
  }
  ouvrirConversation();
  return {
    startTrial() { car.classList.remove('freine'); actif = true; premiereQ = false; avancer(); },
    stopTrial() { actif = false; T.clear(); reps.querySelectorAll('button').forEach(b => b.disabled = true); },
    destroy() { this.stopTrial(); wrap.remove(); },
  };
}

// ── D : simulateur en fausse 3D (canvas 2D, rendu léger) ─────────────────
// Route à double sens en ville : l'élève roule dans la voie de droite.
// Beaucoup d'éléments à analyser (leurres) ; les dangers ENTRENT dans la voie :
// le signal est l'instant où le danger pénètre sur la chaussée (ou où la voiture de devant pile).
// Coordonnées latérales (1 = ancienne demi-largeur de route) :
//   trottoir gauche < -1.45 | chaussée -1.3 … 1.3 (ligne centrale en 0) | stationnement 1.45 … 2.0 | trottoir > 2.0
function sceneD(stage, api, { left, right }) {
  const cv = h('canvas', { class: 'sim' });
  stage.append(cv);
  const g = cv.getContext('2d', { alpha: false });
  let W = 0, H = 0;
  let running = false, raf = 0, tStart = null, last = 0, T = 0, px = 0, steer = 0, scroll = 0;
  let objets = [], dangerAt = 0, dangerType = '', dangerPose = false, signale = false, ph = 0;
  let prochain = {};
  const VITESSE = 8, PROF = 40, K = 0.33;       // m/s, profondeur visible (m), échelle latérale
  const VOIE = 0.65, TOL = 0.62, BORD = 1.3;    // centre de ma voie, écart toléré, bord de chaussée
  const COULEURS = ['#d9480f', '#1971c2', '#2f9e44', '#ae3ec9', '#f08c00', '#495057', '#e8590c'];
  const CARROSSERIES = ['#495057', '#1864ab', '#c92a2a', '#e9ecef', '#2b8a3e', '#212529', '#868e96'];
  const vd = VITESSE / PROF;
  const AUTO = location.search.includes('autopilote');                    // vitesse de défilement en « d » par seconde
  // Tracé de la route : virages doux.
  const rc = t => 0.5 * Math.sin((t + ph) * 0.3) + 0.25 * Math.sin((t + ph) * 0.7 + 1.3);
  const p = d => Math.pow(1 - d, 1.7);
  const sc = d => 0.04 + 0.96 * p(d);
  function proj(d, lat) {
    const s = sc(d), yh = H * 0.4;
    return [W / 2 + (rc(T + d * PROF / VITESSE) + lat - px) * W * K * s, yh + (H - yh) * p(d), s];
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const k = Math.min(1, 960 / Math.max(1, r.width));   // limite la résolution pour les tablettes peu puissantes
    W = cv.width = Math.max(200, Math.round(r.width * k));
    H = cv.height = Math.max(150, Math.round(r.height * k));
    draw();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage);

  function bind(btn, dir) {
    const on = e => { e.preventDefault(); steer = dir; btn.classList.add('actif'); };
    const off = () => { if (steer === dir) steer = 0; btn.classList.remove('actif'); };
    btn.addEventListener('pointerdown', on);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => btn.addEventListener(ev, off));
  }
  bind(left, -1); bind(right, 1);

  function reset() {
    tStart = null; T = 0; ph = rand(0, 100); px = rc(0) + VOIE; scroll = 0;
    dangerAt = rand(4, 12); dangerType = pick(['pieton', 'ballon', 'velo', 'freinage', 'feu']);
    dangerPose = false; signale = false;
    prochain = { garee: 0, trottoir: rand(0.3, 1.2), face: rand(0.5, 2), cycliste: rand(2, 5), feu: rand(2.5, 5), hesite: rand(1.5, 3.5) };
    objets = [];
    // Décor de départ : quelques voitures garées et piétons déjà visibles.
    for (let d = 0.25; d < 0.95; d += rand(0.18, 0.35)) objets.push(garee(d));
    for (let k = 0; k < 2; k++) objets.push(passant(rand(0.3, 0.9)));
    if (dangerType === 'freinage') { objets.push({ type: 'devant', danger: true, d: 0.36, lat: VOIE, c: pick(CARROSSERIES), frein: false }); dangerPose = true; }
    else if (Math.random() < 0.5) objets.push({ type: 'devant', d: rand(0.45, 0.6), lat: VOIE, c: pick(CARROSSERIES), frein: false, vd: -rand(0.03, 0.06) });   // leurre : elle s'éloigne sans freiner
  }

  // ── fabriques d'objets ──
  const garee = d => ({ type: 'garee', d, lat: 2.05, c: pick(CARROSSERIES) });
  const passant = (d = 0.97) => {
    const gauche = Math.random() < 0.35;
    return { type: 'pieton', d, lat: gauche ? rand(-2.1, -1.7) : rand(2.6, 3.0), c: pick(COULEURS), vd: rand(-0.02, 0.02), vlat: 0 };
  };

  function quad(d1, d2, l1, l2, c) {
    const d2b = Math.max(0, d2 - 0.004);   // léger recouvrement : évite les fines lignes entre les bandes
    const a = proj(d1, l1), b = proj(d1, l2), e = proj(d2b, l2), f = proj(d2b, l1);
    g.fillStyle = c; g.beginPath();
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]);
    g.closePath(); g.fill();
  }

  // ── dessins ──
  function pieton(x, y, u, c, pas) {
    const ht = u * 0.66, j = pas ? Math.sin(T * 9) * ht * 0.05 : 0;
    g.fillStyle = '#333'; g.fillRect(x - ht * 0.1 + j, y - ht * 0.35, ht * 0.08, ht * 0.35); g.fillRect(x + ht * 0.02 - j, y - ht * 0.35, ht * 0.08, ht * 0.35);
    g.fillStyle = c; g.fillRect(x - ht * 0.15, y - ht * 0.8, ht * 0.3, ht * 0.47);
    g.fillStyle = '#f1c27d'; g.beginPath(); g.arc(x, y - ht * 0.9, ht * 0.11, 0, 7); g.fill();
  }
  // Cycliste vu de dos : roue arrière fine, jambes qui pédalent, dos, casque.
  function cycliste(x, y, u, c) {
    const ht = u * 0.66, ped = Math.sin(T * 7) * ht * 0.08;
    g.fillStyle = '#1b1b1b'; g.fillRect(x - ht * 0.03, y - ht * 0.42, ht * 0.06, ht * 0.42);          // roue arrière
    g.fillStyle = '#333';                                                                               // jambes
    g.fillRect(x - ht * 0.1, y - ht * 0.55, ht * 0.07, ht * 0.3 + ped); g.fillRect(x + ht * 0.03, y - ht * 0.55, ht * 0.07, ht * 0.3 - ped);
    g.fillStyle = '#555'; g.fillRect(x - ht * 0.2, y - ht * 0.82, ht * 0.4, ht * 0.03);              // guidon
    g.fillStyle = c; g.beginPath();                                                                     // dos penché
    g.moveTo(x - ht * 0.13, y - ht * 0.55); g.lineTo(x + ht * 0.13, y - ht * 0.55); g.lineTo(x + ht * 0.11, y - ht * 0.88); g.lineTo(x - ht * 0.11, y - ht * 0.88); g.fill();
    g.fillStyle = '#f1c27d'; g.beginPath(); g.arc(x, y - ht * 0.95, ht * 0.08, 0, 7); g.fill();        // tête
    g.fillStyle = '#fab005'; g.beginPath(); g.arc(x, y - ht * 0.97, ht * 0.09, Math.PI, 0); g.fill();  // casque
  }
  // Cycliste vu de profil, qui traverse vers la gauche.
  function veloProfil(x, y, u, c) {
    const ht = u * 0.66, r = ht * 0.2, e = ht * 0.38, ped = Math.sin(T * 7) * ht * 0.06;
    g.strokeStyle = '#1b1b1b'; g.lineWidth = Math.max(1.5, ht * 0.04);
    g.beginPath(); g.arc(x - e, y - r, r, 0, 7); g.stroke();                       // roue avant (à gauche)
    g.beginPath(); g.arc(x + e, y - r, r, 0, 7); g.stroke();                       // roue arrière
    g.strokeStyle = '#2b8a3e'; g.beginPath();                                       // cadre
    g.moveTo(x + e, y - r); g.lineTo(x, y - r); g.lineTo(x - e * 0.7, y - ht * 0.55); g.lineTo(x + e * 0.15, y - ht * 0.55); g.lineTo(x, y - r);
    g.moveTo(x - e * 0.7, y - ht * 0.55); g.lineTo(x - e, y - r); g.stroke();
    g.strokeStyle = '#333'; g.beginPath(); g.moveTo(x + e * 0.1, y - ht * 0.6); g.lineTo(x - e * 0.05 + ped, y - r * 0.6); g.stroke();   // jambe
    g.fillStyle = c; g.beginPath();                                                 // buste penché vers l'avant
    g.moveTo(x + e * 0.2, y - ht * 0.6); g.lineTo(x - e * 0.05, y - ht * 0.6); g.lineTo(x - e * 0.45, y - ht * 0.95); g.lineTo(x - e * 0.25, y - ht * 1.0); g.fill();
    g.fillStyle = '#f1c27d'; g.beginPath(); g.arc(x - e * 0.5, y - ht * 1.07, ht * 0.08, 0, 7); g.fill();
    g.fillStyle = '#fab005'; g.beginPath(); g.arc(x - e * 0.5, y - ht * 1.09, ht * 0.09, Math.PI, 0); g.fill();
  }
  function ballon(x, y, u) {
    const r = u * 0.2, cy = y - r - Math.abs(Math.sin(T * 6)) * u * 0.15, rot = (T * 4) % (2 * Math.PI);   // ballon de plage qui roule
    ['#e03131', '#ffd43b', '#1c7ed6', '#ffffff', '#e03131', '#ffd43b'].forEach((c, k) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(x, cy);
      g.arc(x, cy, r, rot + k * Math.PI / 3, rot + (k + 1) * Math.PI / 3); g.closePath(); g.fill();
    });
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, cy, r, 0, 7); g.stroke();
  }
  // Voiture vue de l'arrière (garée ou devant moi) ; feux stop allumés si frein.
  function voitureArriere(x, y, u, c, frein = false) {
    const w = u * 0.7, ht = w * 0.62;
    g.fillStyle = c; g.fillRect(x - w / 2, y - ht, w, ht * 0.8);
    g.fillStyle = '#a5d8ff'; g.fillRect(x - w * 0.35, y - ht * 1.25, w * 0.7, ht * 0.45);
    g.fillStyle = c; g.fillRect(x - w * 0.4, y - ht * 1.3, w * 0.8, ht * 0.07);
    // feux arrière : grands blocs, gris foncé éteints, rouge vif + halo allumés
    if (frein) {
      g.fillStyle = 'rgba(255,30,30,.45)';
      for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + sx * w * 0.33, y - ht * 0.62, w * 0.32, 0, 7); g.fill(); }
      g.beginPath(); g.arc(x, y - ht * 1.2, w * 0.2, 0, 7); g.fill();
    }
    g.fillStyle = frein ? '#ff2020' : '#3a2f2f';
    g.fillRect(x - w * 0.5, y - ht * 0.85, w * 0.32, ht * 0.38); g.fillRect(x + w * 0.18, y - ht * 0.85, w * 0.32, ht * 0.38);
    g.fillRect(x - w * 0.16, y - ht * 1.24, w * 0.32, ht * 0.09);                       // 3e feu stop
    if (frein) { g.fillStyle = '#ffd0d0'; g.fillRect(x - w * 0.44, y - ht * 0.78, w * 0.14, ht * 0.12); g.fillRect(x + w * 0.3, y - ht * 0.78, w * 0.14, ht * 0.12); }
    g.fillStyle = '#111'; g.fillRect(x - w * 0.45, y - ht * 0.2, w * 0.2, ht * 0.2); g.fillRect(x + w * 0.25, y - ht * 0.2, w * 0.2, ht * 0.2);
  }
  // Feu tricolore au bord de la route (poteau + boîtier). etat : 'vert' | 'orange' | 'rouge'
  function feu(x, y, u, etat) {
    const ht = u * 1.0, bw = u * 0.3, bh = u * 0.75, r = u * 0.1;
    g.fillStyle = '#495057'; g.fillRect(x - u * 0.025, y - ht, u * 0.05, ht);
    g.fillStyle = '#212529'; g.fillRect(x - bw / 2, y - ht - bh, bw, bh);
    const lampes = [['rouge', '#ff2020', '#4a1a1a'], ['orange', '#ffa000', '#4a3a1a'], ['vert', '#20e060', '#1a3a24']];
    lampes.forEach(([e, on, off], k) => {
      const cy = y - ht - bh + bh * (0.18 + k * 0.32);
      if (e === etat) { g.fillStyle = on + '55'; g.beginPath(); g.arc(x, cy, r * 2.2, 0, 7); g.fill(); }
      g.fillStyle = e === etat ? on : off; g.beginPath(); g.arc(x, cy, r, 0, 7); g.fill();
    });
  }

  // Voiture qui arrive en face : phares.
  function voitureFace(x, y, u, c) {
    const w = u * 0.7, ht = w * 0.62;
    g.fillStyle = c; g.fillRect(x - w / 2, y - ht, w, ht * 0.8);
    g.fillStyle = '#74c0fc'; g.fillRect(x - w * 0.36, y - ht * 1.25, w * 0.72, ht * 0.45);
    g.fillStyle = '#fff9db'; g.fillRect(x - w * 0.45, y - ht * 0.72, w * 0.2, ht * 0.16); g.fillRect(x + w * 0.25, y - ht * 0.72, w * 0.2, ht * 0.16);
    g.fillStyle = '#343a40'; g.fillRect(x - w * 0.18, y - ht * 0.5, w * 0.36, ht * 0.14);
    g.fillStyle = '#111'; g.fillRect(x - w * 0.45, y - ht * 0.2, w * 0.2, ht * 0.2); g.fillRect(x + w * 0.25, y - ht * 0.2, w * 0.2, ht * 0.2);
  }
  // Voiture vue de profil (dans la rue transversale), tournée vers la gauche.
  function voitureCote(x, y, u, c) {
    const w = u * 1.6, ht = u * 0.45;
    g.fillStyle = c; g.fillRect(x - w / 2, y - ht, w, ht * 0.7);
    g.fillRect(x - w * 0.25, y - ht * 1.35, w * 0.55, ht * 0.4);
    g.fillStyle = '#a5d8ff'; g.fillRect(x - w * 0.2, y - ht * 1.28, w * 0.2, ht * 0.3); g.fillRect(x + w * 0.04, y - ht * 1.28, w * 0.22, ht * 0.3);
    g.fillStyle = '#fff9db'; g.fillRect(x - w / 2, y - ht * 0.85, w * 0.06, ht * 0.18);
    g.fillStyle = '#111'; g.beginPath(); g.arc(x - w * 0.3, y - ht * 0.25, ht * 0.25, 0, 7); g.arc(x + w * 0.3, y - ht * 0.25, ht * 0.25, 0, 7); g.fill();
  }

  function draw() {
    if (!W) return;
    const yh = H * 0.4;
    const ciel = g.createLinearGradient(0, 0, 0, yh);
    ciel.addColorStop(0, '#7fbbe9'); ciel.addColorStop(1, '#d6ebf7');
    g.fillStyle = ciel; g.fillRect(0, 0, W, yh);
    // immeubles lointains (silhouette fixe, très léger)
    g.fillStyle = '#b8c4cf';
    for (let k = 0; k < 14; k++) { const bw = W / 14; const bh = yh * (0.18 + 0.25 * ((k * 37 % 11) / 11)); g.fillRect(k * bw, yh - bh, bw - 2, bh); }
    const N = 48;
    const bandeDe = d => Math.floor((d * PROF + scroll) / 3) % 2;
    for (let i = N; i > 0; i--) {             // 1) sol
      const d1 = i / N, d2 = (i - 1) / N;
      const y1 = proj(d1, 0)[1], y2 = proj(d2, 0)[1];
      g.fillStyle = bandeDe(d1) ? '#7cb36a' : '#73aa61'; g.fillRect(0, y1, W, y2 - y1 + 1.5);
    }
    for (let i = N; i > 0; i--) {             // 2) route, trottoirs, stationnement
      const d1 = i / N, d2 = (i - 1) / N;
      const bande = bandeDe(d1);
      quad(d1, d2, -2.4, -1.45, bande ? '#cfcac1' : '#c4beb4');  // trottoir gauche
      quad(d1, d2, 2.35, 3.3, bande ? '#cfcac1' : '#c4beb4');    // trottoir droit
      quad(d1, d2, -1.45, 2.35, '#5b5f66');                      // chaussée + bande cyclable + stationnement
      quad(d1, d2, 1.36, 1.75, '#b5533c');                       // bande cyclable (entre ma voie et les voitures garées)
      quad(d1, d2, 1.75, 2.35, '#666a71');                       // stationnement
      if (bande) quad(d1, d2, 1.73, 1.77, '#f1f1f1');            // limite stationnement
      quad(d1, d2, -1.45, -1.32, '#e9ecef');                     // bordures
      quad(d1, d2, 1.3, 1.36, '#f1f1f1');                        // ligne de rive
      if (bande) quad(d1, d2, -0.03, 0.03, '#f6f6f6');           // ligne centrale discontinue
    }
    for (const o of objets) if (o.type === 'feu' && o.d < 0.98) quad(Math.min(0.99, o.d + 0.012), Math.max(0, o.d - 0.012), 0.03, 1.3, '#f6f6f6');   // ligne d'arrêt du feu
    for (const o of objets) if (o.type === 'carrefour' && o.d < 0.98) {   // rue transversale à droite
      quad(Math.min(0.99, o.d + 0.035), Math.max(0, o.d - 0.035), 1.3, 3.5, '#5b5f66');
      quad(Math.min(0.99, o.d + 0.045), Math.min(0.99, o.d + 0.035), 1.36, 2.35, '#f6f6f6');   // ligne « stop »
    }
    for (const o of [...objets].sort((a, b) => b.d - a.d)) {
      if (o.d >= 0.99) continue;
      const [x, y, s] = proj(o.d, o.lat);
      const u = W * K * s;
      switch (o.type) {
        case 'pieton': pieton(x, y, u, o.c, o.vlat || o.vd); break;
        case 'cycliste': cycliste(x, y, u, o.c); break;
        case 'velo': veloProfil(x, y, u, o.c); break;
        case 'ballon': ballon(x, y, u); break;
        case 'garee': voitureArriere(x, y, u, o.c); break;
        case 'devant': voitureArriere(x, y, u, o.c, o.frein); break;
        case 'face': voitureFace(x, y, u, o.c); break;
        case 'feu': feu(x, y, u, o.etat); break;
      }
    }
    // avertissement : la voiture s'approche du bord de sa voie
    const ecart = px - rc(T) - VOIE;
    if (Math.abs(ecart) > 0.4) {
      const a = Math.min(0.45, (Math.abs(ecart) - 0.4) * 2);
      const gr = g.createLinearGradient(ecart > 0 ? W : 0, 0, W / 2, 0);
      gr.addColorStop(0, `rgba(230,30,30,${a})`); gr.addColorStop(1, 'rgba(230,30,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // capot
    g.fillStyle = '#c92a2a';
    g.beginPath(); g.moveTo(W * 0.32, H); g.lineTo(W * 0.37, H * 0.88); g.lineTo(W * 0.63, H * 0.88); g.lineTo(W * 0.68, H); g.closePath(); g.fill();
    g.fillStyle = '#a61e1e'; g.fillRect(W * 0.37, H * 0.88, W * 0.26, H * 0.012);
  }

  // ── génération des leurres (rien ne bloque ma voie) ──
  function leurres() {
    if (T >= prochain.garee) { if (Math.random() < 0.55) objets.push(garee(0.99)); prochain.garee = T + rand(0.7, 1.6); }
    if (T >= prochain.trottoir) { objets.push(passant()); prochain.trottoir = T + rand(0.6, 1.6); }
    if (T >= prochain.face) {
      objets.push({ type: 'face', d: 0.99, lat: -VOIE + rand(-0.05, 0.05), c: pick(CARROSSERIES), vd: rand(0.25, 0.4) });
      prochain.face = T + rand(1.2, 3.2);
    }
    if (T >= prochain.cycliste) {   // cycliste qui roule au bord droit de la chaussée, dans le même sens, plus lentement
      objets.push({ type: 'cycliste', d: 0.99, lat: 1.55, c: pick(COULEURS), vd: -0.12 });
      prochain.cycliste = T + rand(4, 8);
    }
    if (T >= prochain.feu && (dangerType !== 'feu' || dangerPose)) {
      // feu qui reste vert : on passe sans freiner
      objets.push({ type: 'feu', d: 0.99, lat: 1.5, etat: 'vert' });
      prochain.feu = T + rand(5, 9);
    }
    if (T >= prochain.hesite) {
      // piéton qui s'approche du bord du trottoir (ou sort entre deux voitures garées) puis s'arrête
      const entreGarees = Math.random() < 0.5;
      objets.push({ type: 'pieton', d: rand(0.6, 0.9), lat: entreGarees ? 2.3 : 3.0, stop: entreGarees ? 1.85 : 2.45, vlat: -rand(0.5, 0.8), c: pick(COULEURS) });
      prochain.hesite = T + rand(2.5, 5);
    }
  }

  // ── pose du danger ──
  // Le chrono part au PREMIER indice visible, pour qu'on ne puisse pas anticiper :
  //  - piéton / ballon : ils apparaissent d'un coup DANS ma voie (sortis de derrière une voiture garée) :
  //    pas de trajectoire d'approche à anticiper, c'est une menace dès le premier instant ;
  //  (la voiture au carrefour reste un leurre : elle attend au stop et ne sort jamais)
  //  - voiture de devant : dès que ses feux stop s'allument.
  function poserDanger() {
    dangerPose = true;
    const c = pick(COULEURS), d0 = 0.5;
    if (dangerType === 'pieton') {
      objets.push(garee(d0 + 0.07), garee(d0 - 0.07));
      objets.push({ type: 'pieton', danger: true, entre: true, d: d0, lat: rand(0.6, 0.9), vlat: -0.25, stop: 0.4, c });   // déjà dans ma voie
      return true;
    }
    if (dangerType === 'ballon') {
      objets.push(garee(d0 + 0.07), garee(d0 - 0.07));
      objets.push({ type: 'ballon', danger: true, entre: true, d: d0, lat: rand(0.7, 1.0), vlat: -0.6, stop: 0.3 });     // déjà dans ma voie
      return true;
    }
    if (dangerType === 'velo') {
      objets.push(garee(d0 + 0.07), garee(d0 - 0.07));
      objets.push({ type: 'velo', danger: true, entre: true, d: d0, lat: rand(0.8, 1.1), vlat: -0.7, c });   // traverse ma voie
      return true;
    }
    if (dangerType === 'feu') objets.push({ type: 'feu', danger: true, d: 0.99, lat: 1.5, etat: 'vert', rougeA: 0.55 });
    return false;
  }
  // Instant de pose avant dangerAt (le carrefour doit arriver de loin).
const avance = () => ({ pieton: 0, ballon: 0, velo: 0, feu: (0.99 - 0.55) / vd, freinage: 0 }[dangerType]);

  function boucle(ts) {
    if (!running) return;
    if (tStart === null) { tStart = ts; last = ts; }
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    T = (ts - tStart) / 1000;
    if (AUTO) steer = Math.max(-1, Math.min(1, (rc(T) + VOIE - px) * 6));   // test uniquement (?autopilote)
    px += steer * 0.9 * dt;
    scroll += VITESSE * dt;
    leurres();
    let entre = false;
    if (!dangerPose && T >= dangerAt - avance()) entre = poserDanger();
    for (const o of objets) {
      if (o.type === 'devant' && !o.danger) { o.d -= o.vd * dt; continue; }
      if (o.type === 'devant') {
        if (!o.frein) {
          // elle roule à ma vitesse devant moi
          if (T >= dangerAt) { o.frein = true; o.tFrein = T; entre = true; }
        } else {
          const vrel = Math.min(VITESSE, 3 + 6 * (T - o.tFrein)); // elle pile : elle se rapproche nettement dès l'allumage des feux
          o.d -= vrel / PROF * dt;
        }
        continue;
      }
      o.d -= dt * vd + (o.vd ?? 0) * dt;
      if (o.type === 'feu') {
        o.d -= dt * vd;
        if (o.rougeA && o.etat === 'vert' && o.d <= o.rougeA) { o.etat = 'rouge'; o.entre = true; entre = true; }   // passe au rouge : premier indice
        continue;
      }
      if (o.type === 'carrefour') {
        if (o.sortA && !o.parti && o.d <= o.sortA) { o.parti = true; o.vlat = -1.6; if (o.danger) { o.entre = true; entre = true; } }   // elle démarre : premier indice
        o.lat2 += o.vlat * dt;
        if (o.sortA) { o.lat = o.lat2; if (o.lat2 <= VOIE) { o.vlat = 0; o.lat2 = VOIE; } }
        if (o.danger && !o.entre && o.lat2 < BORD) { o.entre = true; entre = true; }
        continue;
      }
      if (o.vlat) {
        o.lat += o.vlat * dt;
        if (o.stop !== undefined && o.lat <= o.stop) { o.lat = o.stop; o.vlat = 0; }
      }
      if (o.danger && !o.entre && o.lat < BORD) { o.entre = true; entre = true; }
    }
    objets = objets.filter(o => o.d > 0.01 && o.d < 1.2);

    const danger = objets.find(o => o.danger);
    if (danger && (danger.entre || danger.frein) && danger.d <= 0.06) {
      const lat = danger.type === 'carrefour' ? danger.lat2 : danger.lat;
      if (danger.type === 'feu') { api.fail("Feu rouge grillé ! Tu n'as pas freiné à temps. Essai à refaire."); return; }
      if (lat > -0.1 && lat < BORD + 0.1) { api.fail("Collision ! Tu n'as pas freiné à temps. Essai à refaire."); return; }
    }
    if (Math.abs(px - rc(T) - VOIE) > TOL) { draw(); api.fail('Sortie de voie ! Reste dans ta voie avec ◀ et ▶. Essai à refaire.'); return; }
    draw();
    if (entre && !signale) { signale = true; stage.dataset.danger = '1'; api.signal(ts); }
    if (running) raf = requestAnimationFrame(boucle);
  }

  reset();
  return {
    startTrial() { reset(); delete stage.dataset.danger; running = true; raf = requestAnimationFrame(boucle); },
    stopTrial() { running = false; cancelAnimationFrame(raf); steer = 0; left.classList.remove('actif'); right.classList.remove('actif'); },
    earlyBrake() {
      return "Rien ne t'obligeait à t'arrêter (voitures en face ou garées, piétons sur le trottoir, cycliste sur sa bande, feu vert…). Essai à refaire.";
    },
    destroy() { this.stopTrial(); ro.disconnect(); cv.remove(); },
  };
}
