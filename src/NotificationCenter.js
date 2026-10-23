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
  if (kind === "login") return true;
  if (kind === "dealer") return true;
  if (kind === "admin") return true;
  return true;
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const feedback = useFeedback();
  const [items, setItems] = useState([]);
  const seenRef = useRef(new Set());
  const readyRef = useRef(false);

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
    seenRef.current = merged;
    const trimmed = [...merged].slice(-200);
    seenRef.current = new Set(trimmed);
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    try {
      const list = await api("/api/notifications");
      const next = Array.isArray(list) ? list : [];

      const settingsRaw = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = settingsRaw ? JSON.parse(settingsRaw) : {};
      const now = Date.now();
      // First load: only banner very recent unread (e.g. this login). Later: any new unread.
      const fresh = next.filter((n) => {
        if (!n?.id || seenRef.current.has(n.id) || n.read) return false;
        if (!readyRef.current) {
          const created = n.createdAt ? new Date(n.createdAt).getTime() : 0;
          return created > 0 && now - created < 3 * 60 * 1000;
        }
        return true;
      });

      for (const n of fresh) {
        if (!kindAllowed(n.kind, settings)) continue;
        const title = n.title || "AquaNest";
        const body = n.body || "You have a new update";
        showPhoneNotification({
          title,
          body,
          data: { id: n.id, kind: n.kind || "alert" },
        }).catch(() => {});
        if (readyRef.current) {
          feedback.info(title, {
            description: body,
            duration: 4200,
            actionLabel: "View",
            onAction: () => {},
          });
        }
      }

      await saveSeen(next.map((n) => n.id).filter(Boolean));
      readyRef.current = true;

      setItems(next);
    } catch {
      // ignore transient poll errors
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
    readyRef.current = false;
    seenRef.current = new Set();
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
    }, 8000);

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
