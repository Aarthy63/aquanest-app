import { NativeModules, Platform } from "react-native";

/**
 * Resolve the host the phone/emulator can reach for Metro + API.
 * Expo packs the packager URL into SourceCode.scriptURL
 * (e.g. http://192.168.0.3:8081/... or http://10.0.2.2:8081/...).
 */
function getDevHost() {
  const candidates = [
    NativeModules?.SourceCode?.scriptURL,
    NativeModules?.SourceCode?.getConstants?.()?.scriptURL,
  ].filter(Boolean);

  for (const url of candidates) {
    const match = String(url).match(/https?:\/\/([^/:]+)/);
    const host = match?.[1];
    if (host) return host;
  }
  return null;
}

function isLanHost(host) {
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "10.0.2.2") return false;
  return /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
}

function resolveApiUrl() {
  // Always prefer explicit env (Render / production) over Metro LAN guess
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, "");
  }

  if (Platform.OS === "web") {
    return "http://127.0.0.1:4000";
  }

  const host = getDevHost();

  // Local Expo Go without EXPO_PUBLIC_API_URL → same machine as Metro
  if (isLanHost(host)) {
    return `http://${host}:4000`;
  }

  if (Platform.OS === "android" || host === "10.0.2.2") {
    return "http://10.0.2.2:4000";
  }

  return "http://127.0.0.1:4000";
}

export const API_URL = resolveApiUrl();

export const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "";

export const FIREBASE_WEB = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
};

export const firebaseConfigured = !!(FIREBASE_WEB.apiKey && FIREBASE_WEB.projectId);

if (__DEV__) {
  console.log(`[AquaNest] API_URL=${API_URL} (metroHost=${getDevHost() || "n/a"})`);
}
