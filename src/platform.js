// Storage, photos, downloads and sign-in for the hosted app, behind the same
// `use(name)` interface the page was first written against.
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, CACHE_SIZE_UNLIMITED,
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, writeBatch
} from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
// Keep a full copy on the device so the app opens and saves with no signal
const fs = initializeFirestore(fbApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});

const listeners = new Set();
let pending = 0;
const notify = () => listeners.forEach(fn => fn({ online: navigator.onLine, pending: pending > 0 }));
export const onSyncChange = (fn) => { listeners.add(fn); fn({ online: navigator.onLine, pending: pending > 0 }); };
addEventListener("online", notify);
addEventListener("offline", notify);

// Writes land in the local cache at once; the server confirms later, which never
// happens while offline. So resolve straight away and only report real refusals.
function queued(p) {
  pending++; notify();
  p.catch(err => {
    console.error(err);
    dispatchEvent(new CustomEvent("write-failed", { detail: err }));
  }).finally(() => { pending--; notify(); });
  return Promise.resolve();
}

const docRef = (path, id) => ({
  id,
  path: `${path}/${id}`,
  set: (data) => queued(setDoc(doc(fs, path, id), data)),
  update: (data) => queued(updateDoc(doc(fs, path, id), data)),
  delete: () => queued(deleteDoc(doc(fs, path, id)))
});

const db = {
  collection: (path) => ({
    path,
    doc: (id) => docRef(path, id || doc(collection(fs, path)).id),
    onSnapshot(next, error) {
      return onSnapshot(collection(fs, path), snap => {
        next({ docs: snap.docs.map(d => ({ id: d.id, exists: true, data: () => d.data() })), size: snap.size, empty: snap.empty });
      }, err => { console.error(err); error && error({ code: err.code === "permission-denied" ? "revoked" : "unavailable", message: err.message }); });
    }
  })
};

// Photos are shrunk on the device and kept in the database, so they work offline too
async function shrink(file, max = 900, quality = 0.72) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
const assets = {
  async upload(file) {
    const url = await shrink(file);
    const id = doc(collection(fs, "photos")).id;
    await queued(setDoc(doc(fs, "photos", id), { data: url }));
    return { id, url, sizeBytes: url.length, contentType: "image/jpeg" };
  }
};

const downloads = {
  async save({ filename, data }) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith(".csv") ? "text/csv" : "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return { status: "saved" };
  }
};

const user = { can: async () => true, canEdit: async () => true, isOwner: async () => true };

// Keep every photo synced to the device so horse pages show them offline
const photoMap = new Map();
let photoSub = null;
function watchPhotos() {
  if (photoSub) return;
  photoSub = onSnapshot(collection(fs, "photos"), snap => {
    snap.docChanges().forEach(ch => ch.type === "removed" ? photoMap.delete(ch.doc.id) : photoMap.set(ch.doc.id, ch.doc.data().data));
  }, err => console.error(err));
}

export const platform = {
  use: async (name) => ({ db, assets, downloads, user })[name] ?? null,
  signOut: () => signOut(auth),
  watchPhotos,
  async photo(id) {
    if (photoMap.has(id)) return photoMap.get(id);
    const snap = await getDoc(doc(fs, "photos", id));
    return snap.exists() ? snap.data().data : null;
  },
  async allPhotos() {
    const snap = await getDocs(collection(fs, "photos"));
    return Object.fromEntries(snap.docs.map(d => [d.id, d.data().data]));
  },
  async importBackup(b, progress) {
    const writes = [];
    for (const [id, d] of Object.entries(b.horses || {})) writes.push(["horses", id, d]);
    for (const [id, d] of Object.entries(b.records || {})) writes.push(["records", id, d]);
    for (const [id, url] of Object.entries(b.photos || {})) writes.push(["photos", id, { data: url }]);
    // Photos can be large, so keep batches well under Firestore's 10 MB request limit
    let batch = writeBatch(fs), n = 0, bytes = 0;
    for (let i = 0; i < writes.length; i++) {
      const [c, id, d] = writes[i];
      const size = JSON.stringify(d).length;
      if (n && (n >= 400 || bytes + size > 4e6)) { await batch.commit(); progress(i, writes.length); batch = writeBatch(fs); n = 0; bytes = 0; }
      batch.set(doc(fs, c, id), d); n++; bytes += size;
    }
    if (n) await batch.commit();
    progress(writes.length, writes.length);
  }
};

export { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail };
