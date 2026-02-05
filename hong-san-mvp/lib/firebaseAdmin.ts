// lib/firebaseAdmin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (getApps().length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env missing (PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).");
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function adminDb() {
  initAdmin();
  return getFirestore();
}