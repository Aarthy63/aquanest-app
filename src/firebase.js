import { FIREBASE_WEB, firebaseConfigured } from "./config";

/**
 * Lightweight Firebase web config for the mobile app.
 * Install `firebase` and initialize App/Auth when you enable client SDK.
 * Email delivery is handled by the backend (SMTP + optional Firebase Admin).
 */
export function getFirebaseWebConfig() {
  if (!firebaseConfigured) return null;
  return { ...FIREBASE_WEB };
}

export function firebaseClientStatus() {
  return {
    configured: firebaseConfigured,
    projectId: FIREBASE_WEB.projectId || null,
  };
}
