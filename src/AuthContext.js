import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppState, Platform } from "react-native";
import {
  ApiError,
  api,
  getCachedUser,
  getStoredCreds,
  getToken,
  setCachedUser,
  setStoredCreds,
  setToken,
} from "./api";
import { registerPushToken } from "./push";

const deviceLabel = () => `AquaNest · ${Platform.OS}`;

const AuthContext = createContext(null);

function snapshotFromUser(user) {
  if (!user) return null;
  return {
    name: user.name,
    phone: user.phone,
    cart: user.cart || [],
    wishlist: user.wishlist || [],
    addresses: user.addresses || [],
    orders: user.orders || [],
    bookings: user.bookings || [],
    notifications: user.notifications || [],
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  async function pushLocalSnapshot(serverUser) {
    const cached = await getCachedUser();
    if (!cached) return serverUser;
    const localOrders = cached.orders?.length || 0;
    const serverOrders = serverUser?.orders?.length || 0;
    const localAddresses = cached.addresses?.length || 0;
    const serverAddresses = serverUser?.addresses?.length || 0;
    // Only sync up when phone has more history than wiped server account
    if (localOrders <= serverOrders && localAddresses <= serverAddresses) {
      return serverUser;
    }
    try {
      const merged = await api("/api/me/sync", {
        method: "POST",
        body: snapshotFromUser(cached),
      });
      await setCachedUser(merged);
      return merged;
    } catch {
      return serverUser;
    }
  }

  async function applySession(data) {
    await setToken(data.token);
    let nextUser = data.user;
    await setCachedUser(nextUser);
    setUser(nextUser);
    nextUser = (await pushLocalSnapshot(nextUser)) || nextUser;
    setUser(nextUser);
    registerPushToken().catch(() => {});
    return nextUser;
  }

  async function silentRecover() {
    const creds = await getStoredCreds();
    if (!creds?.email || !creds?.password) return null;
    const data = await api("/api/auth/login", {
      method: "POST",
      auth: false,
      headers: { "X-AquaNest-Recover": "1" },
      body: {
        email: creds.email,
        password: creds.password,
        name: creds.name || undefined,
        phone: creds.phone || undefined,
        recover: true,
        device: deviceLabel(),
      },
    });
    return applySession(data);
  }

  async function refresh({ allowCached = true } = {}) {
    const token = await getToken();
    const cached = allowCached ? await getCachedUser() : null;
    if (cached) setUser(cached);

    if (!token) {
      try {
        const recovered = await silentRecover();
        if (recovered) return;
      } catch {
        /* stay logged out */
      }
      setUser(null);
      return;
    }

    try {
      let me = await api("/api/me");
      me = (await pushLocalSnapshot(me)) || me;
      setUser(me);
      await setCachedUser(me);
      registerPushToken().catch(() => {});
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const network = err instanceof ApiError ? err.network : false;

      if (network || status >= 500 || status === 0) {
        if (cached) setUser(cached);
        return;
      }

      if (status === 401 || status === 403) {
        try {
          const recovered = await silentRecover();
          if (recovered) return;
        } catch {
          /* fall through */
        }
        await setToken(null);
        // Keep cached orders on device even if session ends — only clear on logout
        setUser(null);
        return;
      }

      if (cached) setUser(cached);
    }
  }

  useEffect(() => {
    // Wake Render early so cart/pay feel faster
    api("/api/health", { auth: false }).catch(() => {});
    refresh().finally(() => setReady(true));
  }, []);

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
            recover: true,
            device: deviceLabel(),
          },
          auth: false,
          headers: { "X-AquaNest-Recover": "1" },
        });
        await setStoredCreds({ email, password, name: data.user?.name, phone: data.user?.phone });
        return applySession(data);
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
        await setStoredCreds({
          email: payload.email,
          password: payload.password,
          name: payload.name,
          phone: payload.phone,
        });
        return applySession(data);
      },
      async logout() {
        await setToken(null);
        await setCachedUser(null);
        await setStoredCreds(null);
        setUser(null);
      },
      /** Keep local cache in sync after cart/order mutations */
      async setUserAndCache(next) {
        setUser(next);
        if (next) await setCachedUser(next);
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
