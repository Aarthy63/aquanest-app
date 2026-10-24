import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { registerPushToken, showPhoneNotification } from "./push";
import { useFeedback } from "./ui/Feedback";

const SETTINGS_KEY = "aquanest_settings";
const SEEN_KEY = "aquanest_notif_seen";

const NotificationContext = createContext({
  unread: 0,
  items: [],
  refresh: async () => {},
  markAllRead: async () => {},
});

function kindAllowed(kind, settings) {
  if (kind === "order") return settings.pushOrders !== false;
  if (kind === "service") return settings.pushService !== false;
  if (kind === "offer") return settings.pushOffers !== false;
  if (kind === "login") return settings.pushOrders !== false;
  if (kind === "dealer") return true;
  if (kind === "admin") return true;
  return true;
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const feedback = useFeedback();
  const [items, setItems] = useState([]);
  const seenRef = useRef(new Set());
  const primedRef = useRef(false);
  const busyRef = useRef(false);
  const lastPopupAt = useRef(0);

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const loadSeen = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY);
      const list = raw ? JSON.parse(raw) : [];
      seenRef.current = new Set(Array.isArray(list) ? list : []);
    } catch {
      seenRef.current = new Set();
    }
  }, []);

  const saveSeen = useCallback(async (ids) => {
    const merged = new Set([...seenRef.current, ...ids]);
    const trimmed = [...merged].slice(-300);
    seenRef.current = new Set(trimmed);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  }, []);

  const refresh = useCallback(async () => {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    try {
      const list = await api("/api/notifications");
      const next = Array.isArray(list) ? list : [];
      const allIds = next.map((n) => n.id).filter(Boolean);

      // First load after open/login: mark everything seen — no popup spam
      if (!primedRef.current) {
        await saveSeen(allIds);
        primedRef.current = true;
        setItems(next);
        return;
      }

      const settingsRaw = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};

      const fresh = next
        .filter((n) => {
          if (!n?.id || n.read || seenRef.current.has(n.id)) return false;
          if (!kindAllowed(n.kind, settings)) return false;
          // Ignore login noise and very old rows
          if (n.kind === "login") return false;
          const created = n.createdAt ? new Date(n.createdAt).getTime() : 0;
          return created > 0 && Date.now() - created < 2 * 60 * 1000;
        })
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      // Always advance seen set so history never re-fires
      await saveSeen(allIds);

      const newest = fresh[0];
      const now = Date.now();
      // One popup max (cooldown), one channel only — native OR toast, not both
      if (newest && now - lastPopupAt.current > 8000) {
        lastPopupAt.current = now;
        const title = newest.title || "AquaNest";
        const body = newest.body || "You have a new update";
        const shown = await showPhoneNotification({
          title,
          body,
          data: { id: newest.id, kind: newest.kind || "alert" },
        }).catch(() => ({ ok: false }));
        // Fallback toast only when native/Alert path did not show
        if (!shown?.ok) {
          feedback.info(title, { description: body, duration: 3600 });
        }
      }

      setItems(next);
    } catch {
      // ignore transient poll errors
    } finally {
      busyRef.current = false;
    }
  }, [user, feedback, saveSeen]);

  const markAllRead = useCallback(async () => {
    try {
      const list = await api("/api/notifications/read", { method: "POST" });
      setItems(Array.isArray(list) ? list : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    primedRef.current = false;
    if (!user) {
      setItems([]);
      return undefined;
    }

    let alive = true;
    (async () => {
      await loadSeen();
      if (!alive) return;
      registerPushToken().catch(() => {});
      await refresh();
    })();

    const poll = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, 25000);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      alive = false;
      clearInterval(poll);
      sub.remove();
    };
  }, [user?.id, loadSeen, refresh]);

  const value = useMemo(
    () => ({ unread, items, refresh, markAllRead }),
    [unread, items, refresh, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  return useContext(NotificationContext);
}
