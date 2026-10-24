import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  ApiError,
  api,
  getCachedUser,
  getToken,
  setCachedUser,
  setToken,
} from "./api";
import { registerPushToken } from "./push";

const deviceLabel = () => `AquaNest · ${Platform.OS}`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function refresh({ allowCached = true } = {}) {
    const token = await getToken();
    if (!token) {
      setUser(null);
      await setCachedUser(null);
      return;
    }

    // Show last known profile immediately so reopen never looks logged-out
    if (allowCached) {
      const cached = await getCachedUser();
      if (cached) setUser(cached);
    }

    try {
      const me = await api("/api/me");
      setUser(me);
      await setCachedUser(me);
      registerPushToken().catch(() => {});
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const network = err instanceof ApiError ? err.network : false;
      // Keep session on network / cold-start / 5xx — only hard-logout on auth failure
      if (network || status >= 500 || status === 0) {
        const cached = await getCachedUser();
        if (cached) setUser(cached);
        return;
      }
      if (status === 401 || status === 403) {
        await setToken(null);
        await setCachedUser(null);
        setUser(null);
        return;
      }
      const cached = await getCachedUser();
      if (cached) setUser(cached);
    }
  }

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, []);

  // Re-validate when app comes back to foreground (Render may have slept)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh({ allowCached: true }).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(email, password) {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: {
            email: String(email).trim().toLowerCase(),
            password,
            device: deviceLabel(),
          },
          auth: false,
        });
        await setToken(data.token);
        await setCachedUser(data.user);
        setUser(data.user);
        registerPushToken().catch(() => {});
        return data.user;
      },
      async register(payload) {
        const data = await api("/api/auth/register", {
          method: "POST",
          body: {
            ...payload,
            email: String(payload.email || "").trim().toLowerCase(),
            device: deviceLabel(),
          },
          auth: false,
        });
        await setToken(data.token);
        await setCachedUser(data.user);
        setUser(data.user);
        registerPushToken().catch(() => {});
        return data.user;
      },
      async logout() {
        await setToken(null);
        await setCachedUser(null);
        setUser(null);
      },
      setWishlist(wishlist) {
        setUser((current) => {
          if (!current) return current;
          const next = { ...current, wishlist: wishlist || [] };
          setCachedUser(next).catch(() => {});
          return next;
        });
      },
      refresh,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
