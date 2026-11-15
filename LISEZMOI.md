# Temps de réaction — mise en ligne

Application web de l'activité « temps de réaction & distance d'arrêt » (3e, co-intervention maths / physique-chimie).

- **Lien élèves** : `https://VOTRE-PSEUDO.github.io/temps-reaction/`
- **Lien professeur** : `https://VOTRE-PSEUDO.github.io/temps-reaction/prof.html`

Tant que `js/config.js` n'est pas rempli, l'application tourne en **mode démo** : tout fonctionne, mais les données restent dans le navigateur de l'appareil (mot de passe professeur : `demo`). C'est pratique pour essayer seul.

**Essayer sur cet ordinateur** : double-cliquez sur **`lancer-demo.cmd`**. La page élève s'ouvre ; la vue professeur est à l'adresse `http://localhost:8642/prof.html`. Fermez la fenêtre noire pour arrêter.
Un double-clic sur `index.html` donne une page blanche : les navigateurs bloquent ce type de page ouverte directement depuis un fichier.

---

## 1. Firebase (base de données) — environ 10 min

1. Allez sur **console.firebase.google.com**, cliquez sur **Créer un projet** et nommez-le `temps-reaction`. Désactivez Google Analytics, puis cliquez sur **Créer**.
2. Ouvrez **Créer → Firestore Database → Créer une base de données** :
   - emplacement **eur3 (Europe)** ou **europe-west9 (Paris)** ;
   - **mode production**.
3. Ouvrez **Créer → Authentication → Commencer** :
   - activez **Anonyme** ;
   - activez **Adresse e-mail/Mot de passe** ;
   - dans l'onglet **Utilisateurs**, cliquez sur **Ajouter un utilisateur**. Saisissez votre e-mail et un mot de passe : ce sera votre accès professeur.
   - copiez l'**UID utilisateur** de ce compte.
4. Ouvrez la **roue dentée → Paramètres du projet → Vos applications** et cliquez sur l'icône **`</>`**. Nommez l'application `web`, sans cocher Hosting. Un bloc `firebaseConfig` s'affiche.
5. Ouvrez le fichier **`js/config.js`** et remplacez les valeurs vides par celles du bloc `firebaseConfig`. Collez aussi l'UID dans `PROF_UID`.
6. Ouvrez **Firestore Database → onglet Règles**. Remplacez tout le contenu par celui du fichier **`firestore.rules`**, en remplaçant `REMPLACER_PAR_UID_PROF` par votre UID. Cliquez sur **Publier**.

> Les valeurs de `firebaseConfig` ne sont pas secrètes : elles sont visibles dans toute page web qui utilise Firebase. La sécurité repose sur les règles de l'étape 6. Votre mot de passe ne doit jamais figurer dans un fichier.

## 2. GitHub Pages (mise en ligne) — environ 5 min

1. Sur **github.com**, cliquez sur **New repository**. Nommez-le `temps-reaction`, choisissez **Public**, puis cliquez sur **Create repository**.
2. Cliquez sur le lien **uploading an existing file**. Faites glisser **le contenu** du dossier `app-temps-reaction` : `index.html`, `prof.html`, `sw.js` et les dossiers `css` et `js`. Les fichiers `LISEZMOI.md`, `firestore.rules`, `lancer-demo.cmd` et le dossier `outils` sont inutiles en ligne. Cliquez ensuite sur **Commit changes**.
3. Allez dans **Settings → Pages**. Choisissez **Source : Deploy from a branch**, puis **main** et **/ (root)**, et cliquez sur **Save**. Au bout d'une à deux minutes, l'adresse du site s'affiche.
4. **Important.** Dans Firebase, allez dans **Authentication → Paramètres → Domaines autorisés** et ajoutez `VOTRE-PSEUDO.github.io`. Sans cette étape, la connexion échoue sur le site en ligne.

Pour mettre à jour l'application, déposez de nouveau les fichiers modifiés de la même façon (**Add file → Upload files**).

## 3. Avant la séance

- [ ] Essai à blanc sur les vraies tablettes, avec la collègue : affichage, fluidité du simulateur, filtrage réseau du collège.
- [ ] Dans la vue professeur, onglet **Données**, cliquez sur **Exporter puis tout effacer** pour supprimer les données de l'essai à blanc.
- [ ] Onglet **Îlots présents** : indiquez la taille de chaque îlot (3, 4, ou absent).
- [ ] Le jour même : tablettes allumées, lien élèves ouvert.

## 4. Pendant la séance (vue professeur)

- **Avancement** : l'étape de chaque élève, îlot par îlot. Touchez une case pour voir les temps de l'élève et les **bonnes valeurs** : moyenne, médiane et étendue. C'est utile quand un élève lève la main. Le même panneau permet d'**effacer un élève** pour libérer son mode, par exemple après une erreur de manipulation.
- **Classe (à projeter)** : le tableau par mode et le graphique en points, mis à jour en direct. Le bouton **Plein écran** permet de projeter.
- **Données** : l'export CSV (s'ouvre dans Excel ou LibreOffice) et l'effacement.

## Fonctionnement côté élève (résumé)

1. L'élève choisit son îlot, puis touche **Je commence**. La page lui attribue un mode libre de l'îlot, sans le mode B dans un îlot de 3.
2. Il saisit son estimation de la distance à 50 km/h.
3. Il passe le test témoin, puis le test de son mode. Chaque test commence par un essai d'entraînement ; l'élève peut s'entraîner encore autant qu'il veut, puis lance le vrai test (10 essais comptés). Un camarade note les temps sur la feuille.
4. Il laisse la tablette à l'élève suivant et fait ses calculs sur la feuille.
5. Il revient sur la tablette : îlot, puis **Je reprends**, puis son mode. Il saisit sa moyenne, sa médiane et son étendue. Une fois les calculs validés, ses résultats rejoignent la classe et l'onglet **La classe** se débloque.

Si une tablette plante ou si le réseau coupe, les mesures sont gardées sur la tablette et envoyées au retour du réseau. Pour reprendre ailleurs, l'élève choisit son îlot, puis **Je reprends**.
