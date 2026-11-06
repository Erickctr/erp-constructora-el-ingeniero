import type { AppData } from "./types";

/**
 * Soporte opcional de Firebase Firestore (persistencia híbrida).
 * Si las variables NEXT_PUBLIC_FIREBASE_* no están definidas, no se carga Firebase
 * y la aplicación funciona únicamente con localStorage.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

const COLLECTION = "erp_el_ingeniero";
const DOC_ID = "estado";

async function getDb() {
  const { getApp, getApps, initializeApp } = await import("firebase/app");
  const { getFirestore } = await import("firebase/firestore");
  const app = getApps().length ? getApp() : initializeApp(config);
  return getFirestore(app);
}

export async function loadRemote(): Promise<AppData | null> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");
  const snap = await getDoc(doc(db, COLLECTION, DOC_ID));
  if (!snap.exists()) return null;
  const payload = snap.data().payload;
  return typeof payload === "string" ? (JSON.parse(payload) as AppData) : null;
}

export async function saveRemote(data: AppData): Promise<void> {
  const db = await getDb();
  const { doc, setDoc } = await import("firebase/firestore");
  await setDoc(doc(db, COLLECTION, DOC_ID), {
    payload: JSON.stringify(data),
    updatedAt: new Date().toISOString(),
  });
}

