// Accès aux données : Firebase (Firestore) si configuré, sinon mode démo local.
import { firebaseConfig, PROF_UID } from './config.js';

export const DEMO = !firebaseConfig || !firebaseConfig.apiKey;
const CHAMPS = ['ilot', 'mode', 'step', 'estimation', 'temoin', 'test', 'stats', 'validated', 'essaisCalc'];
const propre = d => Object.fromEntries(CHAMPS.filter(k => d[k] !== undefined).map(k => [k, d[k]]));

export async function initDb() { return DEMO ? demo() : firebase(); }

async function firebase() {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js'), import(base + 'firebase-auth.js'),
  ]);
  const app = initializeApp(firebaseConfig);
  let db;
  try {
    // Cache local persistant : les mesures restent sur la tablette et partent quand le réseau revient.
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch { db = fs.getFirestore(app); }
  const auth = au.getAuth(app);
  const estProf = u => !!u && !u.isAnonymous && (!PROF_UID || u.uid === PROF_UID);

  return {
    async signInEleve() { await auth.authStateReady(); if (!auth.currentUser) await au.signInAnonymously(auth); },
    async profConnecte() { await auth.authStateReady(); return estProf(auth.currentUser); },
    async loginProf(email, mdp) {
      await au.signInWithEmailAndPassword(auth, email, mdp);
      if (!estProf(auth.currentUser)) { await au.signOut(auth); throw new Error("Ce compte n'est pas le compte professeur."); }
    },
    logoutProf() { return au.signOut(auth); },
    watchEleves(cb) {
      return fs.onSnapshot(fs.collection(db, 'eleves'), { includeMetadataChanges: true },
        s => cb(s.docs.map(d => ({ id: d.id, ...d.data() })), { fromCache: s.metadata.fromCache }), e => console.error(e));
    },
    // Réserve une identité « îlot + mode » : échoue si quelqu'un l'a prise entre-temps.
    async claimEleve(id, data) {
      const ref = fs.doc(db, 'eleves', id);
      try {
        return await fs.runTransaction(db, async tx => {
          const snap = await tx.get(ref);
          if (snap.exists()) return false;
          tx.set(ref, { ...propre(data), maj: fs.serverTimestamp() });
          return true;
        });
      } catch (e) {
        // Hors ligne : on écrit quand même (au pire, le professeur corrige un doublon).
        console.warn('Transaction impossible, écriture directe', e);
        fs.setDoc(ref, { ...propre(data), maj: fs.serverTimestamp() }, { merge: true }).catch(console.error);
        return true;
      }
    },
    watchConfig(cb) {
      return fs.onSnapshot(fs.doc(db, 'config', 'ilots'), { includeMetadataChanges: true },
        s => cb(s.exists() ? s.data() : null, { fromCache: s.metadata.fromCache }), e => console.error(e));
    },
    saveEleve(id, data) {
      return fs.setDoc(fs.doc(db, 'eleves', id), { ...propre(data), maj: fs.serverTimestamp() }, { merge: true })
        .catch(e => console.error(e));
    },
    setConfig(c) { return fs.setDoc(fs.doc(db, 'config', 'ilots'), c); },
    async deleteAll(ids) {
      const b = fs.writeBatch(db);
      ids.forEach(id => b.delete(fs.doc(db, 'eleves', id)));
      await b.commit();
    },
  };
}

function demo() {
  const KEY = 'tr_demo_db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { config: null, eleves: {} }; } catch { return { config: null, eleves: {} }; } };
  const ecouteurs = new Set();
  const emit = () => ecouteurs.forEach(f => f());
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('tr_demo') : null;
  if (bc) bc.onmessage = emit;
  window.addEventListener('storage', e => { if (e.key === KEY) emit(); });
  const save = d => { localStorage.setItem(KEY, JSON.stringify(d)); emit(); bc?.postMessage(1); };
  const watch = (f, cb) => { const g = () => cb(f(load())); ecouteurs.add(g); g(); return () => ecouteurs.delete(g); };

  return {
    async signInEleve() {},
    async profConnecte() { return sessionStorage.getItem('tr_demo_prof') === '1'; },
    async loginProf(email, mdp) {
      if (mdp !== 'demo') throw new Error('En mode démo, le mot de passe est « demo ».');
      sessionStorage.setItem('tr_demo_prof', '1');
    },
    async logoutProf() { sessionStorage.removeItem('tr_demo_prof'); },
    watchEleves: cb => watch(d => Object.entries(d.eleves).map(([id, e]) => ({ id, ...e })), l => cb(l, { fromCache: false })),
    async claimEleve(id, data) {
      const d = load();
      if (d.eleves[id]) return false;
      d.eleves[id] = propre(data); save(d);
      return true;
    },
    watchConfig: cb => watch(d => d.config, c => cb(c, { fromCache: false })),
    async saveEleve(id, data) { const d = load(); d.eleves[id] = { ...(d.eleves[id] || {}), ...propre(data) }; save(d); },
    async setConfig(c) { const d = load(); d.config = c; save(d); },
    async deleteAll(ids) { const d = load(); ids.forEach(id => delete d.eleves[id]); save(d); },
  };
}
