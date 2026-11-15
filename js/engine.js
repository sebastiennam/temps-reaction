// Moteur commun des tests : entraînement, essais comptés, faux départs, mesure du temps.
import { h } from './common.js';
import { createScene } from './scenes.js';

const DELAI_MAX = 3000; // ms : au-delà, l'essai est à refaire

export function runTest(root, opts) {
  const { kind, titre, intro, nTrain = 1, nCount = 10, onDone, onProgress, reprise } = opts;
  // reprise : { times, fauxDeparts, aRefaire } — essais déjà comptés avant un plantage.
  const dejaFaits = reprise?.times?.length ?? 0;
  let abandon = () => {};
  const controle = { abort: () => { abandon(); document.body.classList.remove('en-test'); } };
  if (dejaFaits >= nCount) {      // plantage juste après le 10e essai : le test est déjà complet
    setTimeout(() => onDone({ times: reprise.times.slice(0, nCount), fauxDeparts: reprise.fauxDeparts ?? 0, aRefaire: reprise.aRefaire ?? 0 }));
    return controle;
  }
  root.replaceChildren(
    h('div', { class: 'screen center intro' },
      h('h2', {}, titre),
      intro,
      dejaFaits ? h('p', { class: 'info' }, `Reprise : ${dejaFaits} essai${dejaFaits > 1 ? 's' : ''} déjà fait${dejaFaits > 1 ? 's' : ''} sur ${nCount}. Tu continues là où tu t'étais arrêté.`) : null,
      h('button', { class: 'btn primary big', onclick: demarrer },
        dejaFaits ? 'Reprendre le test' : nTrain ? "Commencer par un essai d'entraînement" : `Commencer les ${nCount} essais`)));

  return controle;

  function demarrer() {
    document.body.classList.add('en-test');
    const phaseEl = h('span', { class: 'phase' });
    const compteurs = h('span', { class: 'compteurs' });
    const stage = h('div', { class: 'stage' });
    const overlay = h('div', { class: 'overlay' });
    const left = h('button', { class: 'steer', 'aria-label': 'Aller à gauche' }, '◀');
    const right = h('button', { class: 'steer', 'aria-label': 'Aller à droite' }, '▶');
    const frein = h('button', { class: 'frein' }, 'FREIN');
    if (kind !== 'D') { left.classList.add('invisible'); right.classList.add('invisible'); }
    root.replaceChildren(h('div', { class: 'test' },
      h('div', { class: 'test-top' }, phaseEl, compteurs),
      h('div', { class: 'stage-wrap' }, stage, overlay),
      h('div', { class: 'pedales' }, left, frein, right)));

    let phase = nTrain > 0 && !dejaFaits ? 'train' : 'count';
    const times = dejaFaits ? [...reprise.times] : [];
    let idx = times.length, fd = reprise?.fauxDeparts ?? 0, refaire = reprise?.aRefaire ?? 0;
    let running = false, signaled = false, tSignal = 0, timeoutId = null;

    const api = {
      // Appelée par la scène au moment où le signal de freinage devient visible.
      signal(ts) {
        if (!running || signaled) return;
        signaled = true;
        const appel = performance.now();
        tSignal = ts ?? appel;
        // On recale sur l'image où le signal est réellement affiché, sauf si l'affichage a pris du retard anormal.
        if (ts == null) requestAnimationFrame(t => { if (running && signaled && t - appel < 100) tSignal = Math.max(appel, t); });
        timeoutId = setTimeout(() => {
          if (running && signaled) echec("Trop tard : tu n'as pas freiné dans les 3 secondes. Essai à refaire.");
        }, DELAI_MAX);
      },
      fail(msg) { if (running) echec(msg); },
    };
    const scene = createScene(kind, stage, api, { left, right });

    // Empêche la mise en veille de l'écran pendant le test (si le navigateur le permet).
    let verrou = null;
    const garderEveille = async () => { try { verrou = await navigator.wakeLock?.request('screen'); } catch { /* refusé : sans gravité */ } };
    garderEveille();
    // Page masquée pendant un essai (changement d'application, veille) : la mesure n'est plus fiable.
    const surVisibilite = () => {
      if (document.hidden && running) echec('Essai interrompu (la page a été quittée). Essai à refaire.');
      else if (!document.hidden) garderEveille();
    };
    document.addEventListener('visibilitychange', surVisibilite);
    const sansMenu = e => e.preventDefault();
    root.addEventListener('contextmenu', sansMenu);
    const nettoyer = () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      root.removeEventListener('contextmenu', sansMenu);
      verrou?.release?.().catch(() => {});
    };
    abandon = () => { running = false; clearTimeout(timeoutId); scene.destroy?.(); nettoyer(); };

    function maj() {
      phaseEl.textContent = phase === 'train'
        ? `Entraînement n° ${idx + 1} — non compté`
        : `Essai ${Math.min(idx + 1, nCount)}/${nCount}`;
      compteurs.textContent = phase === 'count' ? `Faux départs : ${fd} · Essais à refaire : ${refaire}` : '';
    }

    function carte(...kids) { overlay.replaceChildren(h('div', { class: 'ov-card' }, ...kids)); overlay.hidden = false; }

    function proposer() {
      maj();
      carte(
        h('p', { class: 'ov-titre' }, phase === 'train' ? `Entraînement n° ${idx + 1}` : `Essai ${idx + 1}/${nCount}`),
        h('p', {}, kind === 'D' ? 'Mets tes doigts près des boutons, puis démarre.' : 'Mets ton doigt près du bouton FREIN, puis démarre.'),
        h('button', { class: 'btn primary big', onclick: lancer }, "Démarrer l'essai"));
    }

    function lancer() {
      overlay.hidden = true;
      running = true; signaled = false;
      scene.startTrial();
    }

    function stop() {
      running = false;
      clearTimeout(timeoutId);
      scene.stopTrial();
    }

    function echec(msg) {
      stop();
      if (phase === 'count') refaire++;
      maj();
      carte(h('p', { class: 'ov-titre rouge' }, 'Essai à refaire'), h('p', {}, msg),
        boutonDiffere("Recommencer l'essai", lancer));
    }

    function fauxDepart(msg) {
      stop();
      if (phase === 'count') fd++;
      maj();
      carte(h('p', { class: 'ov-titre rouge' }, 'Faux départ !'), h('p', {}, msg),
        boutonDiffere("Recommencer l'essai", lancer));
    }

    // Bouton activé après un court délai, pour éviter un appui involontaire.
    function boutonDiffere(texte, action, delai = 700) {
      const b = h('button', { class: 'btn primary big', disabled: true, onclick: action }, texte);
      setTimeout(() => { b.disabled = false; }, delai);
      return b;
    }

    frein.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!running) return;
      if (!signaled) {
        const leurre = scene.earlyBrake?.();
        if (leurre) echec(leurre);
        else fauxDepart(kind === 'temoin' || kind === 'A' || kind === 'B' || kind === 'C'
          ? "Tu as freiné alors que la voiture ne freinait pas. Essai à refaire."
          : "Tu as freiné alors qu'il n'y avait aucun danger. Essai à refaire.");
        return;
      }
      const maintenant = performance.now();
      let rt = e.timeStamp - tSignal;
      if (!(rt > 0 && rt < 10000)) rt = maintenant - tSignal;
      rt = Math.round(rt);
      if (rt < 100) { fauxDepart('Moins de 0,1 s : personne ne réagit aussi vite, tu as anticipé. Essai à refaire.'); return; }
      stop();
      resultat(rt);
    });

    function resultat(rt) {
      const compte = phase === 'count';
      if (compte) { times.push(rt); onProgress?.({ times: [...times], fauxDeparts: fd, aRefaire: refaire }); }
      carte(
        h('p', { class: 'ov-sous' }, compte ? `Essai ${idx + 1}/${nCount}` : `Entraînement n° ${idx + 1} (non compté)`),
        h('p', { class: 'ov-temps' }, `${rt} ms`),
        compte ? h('p', { class: 'ov-note' }, '✏️ Note ce temps sur la feuille') : null,
        compte ? boutonDiffere(idx + 1 >= nCount ? 'Terminer' : 'Essai suivant', suivant, 900) : choixApresEntrainement());
    }

    // Après chaque essai d'entraînement : l'élève choisit de recommencer ou de passer au vrai test.
    function choixApresEntrainement() {
      const encore = boutonDiffere("M'entraîner encore", () => { idx++; proposer(); }, 600);
      encore.className = 'btn big';
      return h('div', { class: 'ov-choix' },
        boutonDiffere('Commencer le vrai test', versVraiTest, 600), encore);
    }

    function versVraiTest() {
      phase = 'count'; idx = 0; fd = 0; refaire = 0;
      maj();
      carte(h('p', { class: 'ov-titre' }, "C'est parti pour le vrai test !"),
        h('p', {}, `${nCount} essais comptés.`),
        h('p', {}, '✏️ Ton camarade note chaque temps sur la feuille.'),
        h('p', {}, kind === 'D' ? 'Mets tes doigts près des boutons, puis démarre.' : 'Mets ton doigt près du bouton FREIN, puis démarre.'),
        h('button', { class: 'btn primary big', onclick: lancer }, "Démarrer l'essai 1"));
    }

    function suivant() {
      idx++;
      if (phase === 'count' && idx >= nCount) {
        abandon = () => {};
        scene.destroy?.();
        nettoyer();
        document.body.classList.remove('en-test');
        onDone({ times, fauxDeparts: fd, aRefaire: refaire });
        return;
      }
      proposer();
    }

    proposer();
  }
}
