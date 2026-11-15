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
function sceneD(stage, api, { left, right }) {
  const cv = h('canvas', { class: 'sim' });
  stage.append(cv);
  const g = cv.getContext('2d', { alpha: false });
  let W = 0, H = 0;
  let running = false, raf = 0, tStart = null, last = 0, T = 0, px = 0, steer = 0, scroll = 0;
  let objets = [], dangerAt = 0, nextLeurre = 0, dangerVu = false, ph = 0;
  const VITESSE = 8, PROF = 40;                // m/s et profondeur visible (m)
  const COULEURS = ['#d9480f', '#1971c2', '#2f9e44', '#ae3ec9', '#f08c00'];
  // Tracé de la route (décalage latéral du centre en fonction du temps) : virages doux.
  const rc = t => 0.5 * Math.sin((t + ph) * 0.3) + 0.25 * Math.sin((t + ph) * 0.7 + 1.3);
  const p = d => Math.pow(1 - d, 1.7);
  const sc = d => 0.04 + 0.96 * p(d);
  function proj(d, lat) {
    const s = sc(d), yh = H * 0.4;
    return [W / 2 + (rc(T + 2.2 * d) + lat - px) * W * 0.4 * s, yh + (H - yh) * p(d), s];
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
    tStart = null; T = 0; ph = rand(0, 100); px = rc(0); objets = []; scroll = 0;
    dangerAt = rand(4, 12); nextLeurre = rand(0.8, 2.5); dangerVu = false;
  }

  function quad(d1, d2, l1, l2, c) {
    const d2b = Math.max(0, d2 - 0.004);   // léger recouvrement : évite les fines lignes entre les bandes
    const a = proj(d1, l1), b = proj(d1, l2), e = proj(d2b, l2), f = proj(d2b, l1);
    g.fillStyle = c; g.beginPath();
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(e[0], e[1]); g.lineTo(f[0], f[1]);
    g.closePath(); g.fill();
  }

  function pieton(x, y, u, c) {
    const ht = u * 0.9;
    g.fillStyle = '#333'; g.fillRect(x - ht * 0.1, y - ht * 0.35, ht * 0.08, ht * 0.35); g.fillRect(x + ht * 0.02, y - ht * 0.35, ht * 0.08, ht * 0.35);
    g.fillStyle = c; g.fillRect(x - ht * 0.15, y - ht * 0.8, ht * 0.3, ht * 0.47);
    g.fillStyle = '#f1c27d'; g.beginPath(); g.arc(x, y - ht * 0.9, ht * 0.11, 0, 7); g.fill();
  }
  function cycliste(x, y, u, c) {
    g.fillStyle = '#222'; g.fillRect(x - u * 0.03, y - u * 0.35, u * 0.06, u * 0.35);
    pieton(x, y - u * 0.25, u * 0.8, c);
    g.fillStyle = '#555'; g.fillRect(x - u * 0.18, y - u * 0.62, u * 0.36, u * 0.04);
  }
  function ballon(x, y, u) {
    const r = u * 0.17, cy = y - r, rot = (T * 4) % (2 * Math.PI);   // ballon de plage qui roule
    ['#e03131', '#ffd43b', '#1c7ed6', '#ffffff', '#e03131', '#ffd43b'].forEach((c, k) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(x, cy);
      g.arc(x, cy, r, rot + k * Math.PI / 3, rot + (k + 1) * Math.PI / 3); g.closePath(); g.fill();
    });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, cy, r * 0.22, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, cy, r, 0, 7); g.stroke();
  }
  function voiture(x, y, u) {
    const w = u * 1.1, ht = w * 0.62;
    g.fillStyle = '#495057'; g.fillRect(x - w / 2, y - ht, w, ht * 0.8);
    g.fillStyle = '#a5d8ff'; g.fillRect(x - w * 0.35, y - ht * 1.25, w * 0.7, ht * 0.45);
    g.fillStyle = '#ff2b2b'; g.fillRect(x - w * 0.46, y - ht * 0.8, w * 0.18, ht * 0.2); g.fillRect(x + w * 0.28, y - ht * 0.8, w * 0.18, ht * 0.2);
    g.fillStyle = '#111'; g.fillRect(x - w * 0.45, y - ht * 0.2, w * 0.2, ht * 0.2); g.fillRect(x + w * 0.25, y - ht * 0.2, w * 0.2, ht * 0.2);
  }

  function draw() {
    if (!W) return;
    const yh = H * 0.4;
    const ciel = g.createLinearGradient(0, 0, 0, yh);
    ciel.addColorStop(0, '#7fbbe9'); ciel.addColorStop(1, '#d6ebf7');
    g.fillStyle = ciel; g.fillRect(0, 0, W, yh);
    const N = 48;
    const bandeDe = d => Math.floor((d * PROF + scroll) / 3) % 2;
    for (let i = N; i > 0; i--) {             // 1) herbe
      const d1 = i / N, d2 = (i - 1) / N;
      const y1 = proj(d1, 0)[1], y2 = proj(d2, 0)[1];
      g.fillStyle = bandeDe(d1) ? '#7cb36a' : '#73aa61'; g.fillRect(0, y1, W, y2 - y1 + 1.5);
    }
    for (let i = N; i > 0; i--) {             // 2) route, bordures, trottoir, piste
      const d1 = i / N, d2 = (i - 1) / N;
      const bande = bandeDe(d1);
      quad(d1, d2, -2.2, -1.35, '#c0563f');                 // piste cyclable
      quad(d1, d2, -1.35, -1.15, '#6aa35a');                 // terre-plein
      quad(d1, d2, 1.15, 2.3, bande ? '#cfcac1' : '#c4beb4'); // trottoir
      quad(d1, d2, -1, 1, '#5b5f66');                        // chaussée
      quad(d1, d2, -1.15, -1, bande ? '#f1f1f1' : '#d63b2f'); // bordures
      quad(d1, d2, 1, 1.15, bande ? '#f1f1f1' : '#d63b2f');
      if (bande) quad(d1, d2, -1.8, -1.74, '#f6f6f6');       // pointillés de la piste
    }
    for (const o of [...objets].sort((a, b) => b.d - a.d)) {
      const [x, y, s] = proj(o.d, o.lat);
      const u = W * 0.4 * s;
      if (o.type === 'pieton') pieton(x, y, u, o.c);
      else if (o.type === 'cycliste') cycliste(x, y, u, o.c);
      else if (o.type === 'ballon') ballon(x, y, u);
      else voiture(x, y, u);
    }
    // avertissement : la voiture s'approche du bord de la route
    const ecart = px - rc(T);
    if (Math.abs(ecart) > 0.55) {
      const a = Math.min(0.45, (Math.abs(ecart) - 0.55) * 1.5);
      const gr = g.createLinearGradient(ecart > 0 ? W : 0, 0, W / 2, 0);
      gr.addColorStop(0, `rgba(230,30,30,${a})`); gr.addColorStop(1, 'rgba(230,30,30,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    // capot
    g.fillStyle = '#c92a2a';
    g.beginPath(); g.moveTo(W * 0.22, H); g.lineTo(W * 0.3, H * 0.86); g.lineTo(W * 0.7, H * 0.86); g.lineTo(W * 0.78, H); g.closePath(); g.fill();
    g.fillStyle = '#a61e1e'; g.fillRect(W * 0.3, H * 0.86, W * 0.4, H * 0.015);
  }

  function boucle(ts) {
    if (!running) return;
    if (tStart === null) { tStart = ts; last = ts; }
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    T = (ts - tStart) / 1000;
    px += steer * 0.9 * dt;
    scroll += VITESSE * dt;
    if (T >= nextLeurre) {
      const cyc = Math.random() < 0.5;
      objets.push({ type: cyc ? 'cycliste' : 'pieton', lat: cyc ? -1.77 : 1.7, d: 0.97, c: pick(COULEURS), vlat: 0 });
      nextLeurre = T + rand(1.2, 3.5);
    }
    let nouveau = false;
    if (!dangerVu && T >= dangerAt) {
      dangerVu = nouveau = true;
      const type = pick(['pieton', 'ballon', 'voiture']);
      objets.push({
        type, danger: true, d: 0.6, c: pick(COULEURS),
        lat: type === 'voiture' ? 0 : -0.6, vlat: type === 'voiture' ? 0 : (type === 'pieton' ? 0.3 : 0.4),
      });
    }
    for (const o of objets) { o.d -= dt * VITESSE / PROF; o.lat += o.vlat * dt; }
    objets = objets.filter(o => o.d > 0.01);
    const danger = objets.find(o => o.danger);
    if (danger && danger.d <= 0.05) { api.fail("Collision ! Tu n'as pas freiné à temps. Essai à refaire."); return; }
    if (Math.abs(px - rc(T)) > 0.85) { draw(); api.fail('Sortie de route ! Garde ta voiture sur la route avec ◀ et ▶. Essai à refaire.'); return; }
    draw();
    if (nouveau) { stage.dataset.danger = '1'; api.signal(ts); }
    if (running) raf = requestAnimationFrame(boucle);
  }

  reset();
  return {
    startTrial() { reset(); delete stage.dataset.danger; running = true; raf = requestAnimationFrame(boucle); },
    stopTrial() { running = false; cancelAnimationFrame(raf); steer = 0; left.classList.remove('actif'); right.classList.remove('actif'); },
    earlyBrake() {
      return objets.some(o => !o.danger && o.d < 0.92)
        ? "Il n'y avait rien sur ta voie : le piéton sur le trottoir ou le cycliste sur la piste ne te bloquent pas. Essai à refaire."
        : null;
    },
    destroy() { this.stopTrial(); ro.disconnect(); cv.remove(); },
  };
}
