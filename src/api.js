import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";

const TOKEN_KEY = "aquanest_token";
const USER_KEY = "aquanest_user";
const CREDS_KEY = "aquanest_creds";

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function getCachedUser() {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedUser(user) {
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  else await AsyncStorage.removeItem(USER_KEY);
}

/** Save email/password so APK can silent re-login after Render wipes server memory. */
export async function setStoredCreds(creds) {
  if (creds?.email && creds?.password) {
    await AsyncStorage.setItem(
      CREDS_KEY,
      JSON.stringify({
        email: String(creds.email).trim().toLowerCase(),
        password: String(creds.password),
        name: creds.name || "",
        phone: creds.phone || "",
      }),
    );
  } else {
    await AsyncStorage.removeItem(CREDS_KEY);
  }
}

export async function getStoredCreds() {
  try {
    const raw = await AsyncStorage.getItem(CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, { status = 0, network = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.network = network;
  }
}

export async function api(path, { method = "GET", body, auth = true, headers: extraHeaders } = {}) {
  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      `Cannot reach API at ${API_URL}. Check network or wait for server wake-up.`,
      { network: true, status: 0 },
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, { status: res.status });
  }
  return data;
}
