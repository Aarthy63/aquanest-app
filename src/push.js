import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { api } from "./api";

const PROMPT_KEY = "aquanest_push_prompt_v1";

let readyPromise = null;

function isExpoGo() {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient"
  );
}

function useNativePush() {
  return !isExpoGo() && process.env.EXPO_PUBLIC_ENABLE_NATIVE_PUSH === "1";
}

async function requestAndroidPostNotifications() {
  if (Platform.OS !== "android" || Platform.Version < 33) {
    return true;
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function getPromptChoice() {
  try {
    return (await AsyncStorage.getItem(PROMPT_KEY)) || null;
  } catch {
    return null;
  }
}

async function setPromptChoice(value) {
  try {
    await AsyncStorage.setItem(PROMPT_KEY, value);
  } catch {
    // ignore
  }
}

/**
 * One-time Allow / Decline popup — call when Account screen opens.
 * Does not ask again after the user chooses.
 */
export async function promptAccountNotificationsOnce() {
  if (Platform.OS === "web") return { ok: false, reason: "web" };

  const existing = await getPromptChoice();
  if (existing === "allowed" || existing === "declined") {
    if (existing === "allowed") {
      await ensureLocalNotifications({ forcePrompt: false });
    }
    return { ok: existing === "allowed", reason: existing, alreadyAsked: true };
  }

  return new Promise((resolve) => {
    Alert.alert(
      "Allow notifications?",
      "AquaNest can alert you about orders, service bookings, and offers. You can change this later in Account settings.",
      [
        {
          text: "Decline",
          style: "cancel",
          onPress: async () => {
            await setPromptChoice("declined");
            resolve({ ok: false, reason: "declined", alreadyAsked: false });
          },
        },
        {
          text: "Allow",
          onPress: async () => {
            const result = await ensureLocalNotifications({ forcePrompt: true });
            await setPromptChoice(result.ok ? "allowed" : "declined");
            if (!result.ok) {
              Alert.alert(
                "Notifications are off",
                "You can enable them anytime in phone Settings → Apps → AquaNest / Expo Go → Notifications.",
                [
                  { text: "OK", style: "cancel" },
                  { text: "Open settings", onPress: () => Linking.openSettings().catch(() => {}) },
                ],
              );
            }
            resolve({ ok: !!result.ok, reason: result.ok ? "allowed" : "permission_denied", alreadyAsked: false });
          },
        },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Soft setup without forcing the system dialog (unless forcePrompt).
 */
export async function ensureLocalNotifications({ forcePrompt = false } = {}) {
  if (Platform.OS === "web") {
    return { ok: false, reason: "web" };
  }
  if (readyPromise && !forcePrompt) return readyPromise;

  readyPromise = (async () => {
    try {
      const choice = await getPromptChoice();
      if (choice === "declined" && !forcePrompt) {
        return { ok: false, reason: "declined", mode: "skipped" };
      }

      let androidOk = true;
      if (forcePrompt || choice === "allowed") {
        androidOk = await requestAndroidPostNotifications();
      } else {
        // Don't pop system permission until Account Allow
        return { ok: false, reason: "not_prompted", mode: "pending" };
      }

      if (!useNativePush()) {
        if (!androidOk && Platform.OS === "android" && Platform.Version >= 33) {
          return { ok: false, reason: "permission_denied", mode: "expo_go" };
        }
        return { ok: true, mode: "expo_go" };
      }

      // Native / APK build only — dynamic import kept behind flag
      const Notifications = await import("expo-notifications");

      if (typeof Notifications.setNotificationHandler === "function") {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      }

      if (Platform.OS === "android" && typeof Notifications.setNotificationChannelAsync === "function") {
        try {
          await Notifications.setNotificationChannelAsync("aquanest", {
            name: "AquaNest alerts",
            importance: Notifications.AndroidImportance?.MAX ?? 5,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#0B6E99",
            sound: "default",
          });
        } catch {
          // optional
        }
      }

      let status = "undetermined";
      if (typeof Notifications.getPermissionsAsync === "function") {
        const existing = await Notifications.getPermissionsAsync();
        status = existing.status;
      }
      if (status !== "granted" && typeof Notifications.requestPermissionsAsync === "function") {
        const requested = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        status = requested.status;
      }

      const granted = status === "granted" || androidOk;
      if (!granted) {
        return { ok: false, reason: "permission_denied", mode: "native" };
      }
      return { ok: true, mode: "native" };
    } catch (err) {
      console.warn("[push:local]", err?.message || String(err));
      readyPromise = null;
      return { ok: false, reason: err?.message || "push_unavailable" };
    }
  })();

  return readyPromise;
}

export async function showPhoneNotification({ title, body, data = {} } = {}) {
  if (Platform.OS === "web") return { ok: false, reason: "web" };

  const choice = await getPromptChoice();
  if (choice === "declined") return { ok: false, reason: "declined" };

  const ready = await ensureLocalNotifications({ forcePrompt: false });
  const heading = title || "AquaNest";
  const message = body || "You have a new update";

  // Expo Go / no native push: in-app Alert only if user allowed
  if (!useNativePush() || ready.mode === "expo_go" || ready.mode === "pending") {
    if (choice === "allowed" || ready.ok) {
      Alert.alert(heading, message);
      return { ok: true, mode: "alert" };
    }
    return { ok: false, reason: ready.reason || "not_ready" };
  }

  if (!ready.ok) return ready;

  try {
    const Notifications = await import("expo-notifications");
    if (typeof Notifications.scheduleNotificationAsync !== "function") {
      Alert.alert(heading, message);
      return { ok: true, mode: "alert_fallback" };
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: heading,
        body: message,
        data,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "aquanest" } : {}),
      },
      trigger: null,
    });
    return { ok: true, mode: "native" };
  } catch (err) {
    console.warn("[push:show]", err?.message || String(err));
    Alert.alert(heading, message);
    return { ok: true, mode: "alert_fallback" };
  }
}

/** Quiet token register — no permission popup (Account screen handles that once). */
export async function registerPushToken() {
  if (Platform.OS === "web") return { ok: false, reason: "web" };

  const choice = await getPromptChoice();
  if (choice !== "allowed") return { ok: false, reason: choice || "not_prompted" };

  await ensureLocalNotifications({ forcePrompt: false });

  if (!useNativePush()) {
    return { ok: false, reason: "local_only_expo_go" };
  }

  try {
    const Notifications = await import("expo-notifications");
    const ready = await ensureLocalNotifications({ forcePrompt: false });
    if (!ready.ok) return ready;

    let token = null;
    if (typeof Notifications.getDevicePushTokenAsync === "function") {
      try {
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        token = deviceToken?.data ? String(deviceToken.data) : null;
      } catch {
        token = null;
      }
    }

    if (!token && typeof Notifications.getExpoPushTokenAsync === "function") {
      try {
        const projectId =
          process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
          Constants?.easConfig?.projectId ||
          Constants?.expoConfig?.extra?.eas?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        token = tokenData?.data ? String(tokenData.data) : null;
      } catch {
        token = null;
      }
    }

    if (!token) return { ok: false, reason: "no_token" };

    await api("/api/devices", {
      method: "POST",
      body: { token, platform: Platform.OS },
    });
    return { ok: true, token };
  } catch (err) {
    console.warn("[push]", err?.message || String(err));
    return { ok: false, reason: err?.message || "push_unavailable" };
  }
}
