import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { api, getToken, setToken } from "./api";
import { registerPushToken } from "./push";

const deviceLabel = () => `AquaNest · ${Platform.OS}`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    const token = await getToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      setUser(await api("/api/me"));
      registerPushToken().catch(() => {});
    } catch {
      await setToken(null);
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setReady(true));
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
        setUser(data.user);
        registerPushToken().catch(() => {});
        return data.user;
      },
      async logout() {
        await setToken(null);
        setUser(null);
      },
      setWishlist(wishlist) {
        setUser((current) => (current ? { ...current, wishlist: wishlist || [] } : current));
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
