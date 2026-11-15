// Écrans d'explication affichés avant chaque test.
import { h } from './common.js';
import { CAR_SVG } from './scenes.js';

const regle = txt => h('p', { class: 'regle' }, txt);
const consigne = txt => h('p', { class: 'consigne' }, txt);

function miniVoiture(etat, legende, ok) {
  const fig = h('figure', { class: 'schema-voiture ' + (ok ? 'ok' : 'non') });
  fig.innerHTML = CAR_SVG;
  fig.querySelector('.car').classList.add(...etat.split(' '));
  fig.append(h('figcaption', {}, legende));
  return fig;
}

export function introTest(kind) {
  switch (kind) {
    case 'temoin': return h('div', {},
      consigne('Freine dès que les feux stop de la voiture devant toi s\'allument.'),
      regle('Une voiture roule devant toi. Quand ses feux stop (rouges) s\'allument, appuie le plus vite possible sur le bouton FREIN, en bas de l\'écran.'),
      regle('Si tu appuies trop tôt, c\'est un faux départ : l\'essai est à refaire.'),
      regle('✏️ Un camarade note chaque temps sur ta feuille.'));

    case 'A': return h('div', {},
      consigne('Freine uniquement si la voiture devant toi freine.'),
      h('div', { class: 'schemas' },
        miniVoiture('freine', h('span', {}, h('b', {}, 'Feux stop (rouges) allumés'), ' : la voiture freine → ', h('b', {}, 'FREINE !')), true),
        miniVoiture('clig-d', h('span', {}, h('b', {}, 'Clignotant (orange)'), ' : la voiture va tourner → ', h('b', {}, 'NE FREINE PAS')), false)),
      regle('La voiture peut clignoter à gauche ou à droite, s\'arrêter de clignoter, recommencer… puis freiner à un moment imprévisible.'),
      regle('Freiner alors que la voiture ne freine pas = faux départ, l\'essai est à refaire.'));

    case 'B': return h('div', {},
      consigne('Calcule sans t\'arrêter, et freine dès que la voiture devant toi freine.'),
      regle('Des calculs s\'affichent les uns après les autres : touche la bonne réponse le plus vite possible.'),
      regle('En même temps, surveille la voiture : dès que ses feux stop s\'allument, appuie sur FREIN.'),
      regle('Une erreur de calcul, ou plus de 4 secondes sans répondre : l\'essai est à refaire.'));

    case 'C': return h('div', {},
      consigne('Réponds à tes amis, et freine dès que la voiture devant toi freine.'),
      regle('Tes amis t\'écrivent. Lis bien les messages : des questions arrivent sur ce qui a été dit plus tôt. Touche la bonne réponse.'),
      regle('En même temps, surveille la voiture : dès que ses feux stop s\'allument, appuie sur FREIN.'),
      regle('Une mauvaise réponse : l\'essai est à refaire.'));

    case 'D': return h('div', {},
      consigne('Reste dans ta voie, à droite. Freine dès que quelque chose bloque ta voie.'),
      regle('Maintiens ◀ ou ▶ appuyé pour rester dans ta voie.'),
      regle('Observe bien : voitures en face, voitures garées, piétons au bord du trottoir, voiture qui attend à un carrefour, cycliste… Tant que rien n\'entre dans ta voie, ne freine pas.'),
      regle('Sortie de voie, ou freinage alors que ta voie est libre : l\'essai est à refaire.'));
  }
  return h('div');
}
