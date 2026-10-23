import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";

let readyPromise = null;
let askedThisSession = false;

/** Expo Go cannot load expo-notifications native modules on Android SDK 53+. */
function isExpoGo() {
  return (
    Constants.appOwnership === "expo" ||
    Constants.executionEnvironment === "storeClient"
  );
}

async function requestAndroidPostNotifications() {
  if (Platform.OS !== "android" || Platform.Version < 33) {
    return true;
  }
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Allow AquaNest notifications",
        message:
          "AquaNest needs permission to show order, login, and service alerts on your phone.",
        buttonPositive: "Allow",
        buttonNegative: "Not now",
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function explainDenied() {
  Alert.alert(
    "Notifications are off",
    "Enable notifications in system settings so AquaNest can show alerts on your phone.",
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Open settings",
        onPress: () => Linking.openSettings().catch(() => {}),
      },
    ],
  );
}

/**
 * Permission + local setup.
 * Expo Go: Android permission dialog only (no expo-notifications — avoids ExpoApplication crash).
 * Dev/production build: full expo-notifications when EXPO_PUBLIC_ENABLE_NATIVE_PUSH=1.
 */
export async function ensureLocalNotifications({ forcePrompt = false } = {}) {
  if (Platform.OS === "web") {
    return { ok: false, reason: "web" };
  }
  if (readyPromise && !forcePrompt) return readyPromise;

  readyPromise = (async () => {
    try {
      const androidOk = await requestAndroidPostNotifications();

      // Expo Go path — never import expo-notifications
      if (isExpoGo() || process.env.EXPO_PUBLIC_ENABLE_NATIVE_PUSH !== "1") {
        if (!androidOk && Platform.OS === "android" && Platform.Version >= 33) {
          if (!askedThisSession || forcePrompt) {
            askedThisSession = true;
            explainDenied();
          }
          return { ok: false, reason: "permission_denied", mode: "expo_go" };
        }
        askedThisSession = true;
        return { ok: true, mode: "expo_go" };
      }

      const Notifications = await import("expo-notifications");

      if (typeof Notifications.setNotificationHandler === "function") {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
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
          // channel optional
        }
      }

      let status = "undetermined";
      if (typeof Notifications.getPermissionsAsync === "function") {
        const existing = await Notifications.getPermissionsAsync();
        status = existing.status;
      }
      if (
        (status !== "granted" || forcePrompt) &&
        typeof Notifications.requestPermissionsAsync === "function"
      ) {
        const requested = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        status = requested.status;
      }

      const granted = status === "granted" || androidOk;
      if (!granted) {
        if (!askedThisSession || forcePrompt) {
          askedThisSession = true;
          explainDenied();
        }
        return { ok: false, reason: "permission_denied", mode: "native" };
      }

      askedThisSession = true;
      return { ok: true, mode: "native" };
    } catch (err) {
      console.warn("[push:local]", err?.message || String(err));
      readyPromise = null;
      return { ok: false, reason: err?.message || "push_unavailable" };
    }
  })();

  return readyPromise;
}

/**
 * Show an alert on the phone.
 * Expo Go: system Alert (reliable). Native build: tray notification via expo-notifications.
 */
export async function showPhoneNotification({ title, body, data = {} } = {}) {
  if (Platform.OS === "web") return { ok: false, reason: "web" };

  const ready = await ensureLocalNotifications();
  const heading = title || "AquaNest";
  const message = body || "You have a new update";

  if (isExpoGo() || process.env.EXPO_PUBLIC_ENABLE_NATIVE_PUSH !== "1" || ready.mode === "expo_go") {
    Alert.alert(heading, message);
    return { ok: true, mode: "alert" };
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

/** Register remote FCM token — development / production builds only. */
export async function registerPushToken() {
  if (Platform.OS === "web") {
    return { ok: false, reason: "web" };
  }

  await ensureLocalNotifications({ forcePrompt: true });

  if (isExpoGo() || process.env.EXPO_PUBLIC_ENABLE_NATIVE_PUSH !== "1") {
    return { ok: false, reason: "local_only_expo_go" };
  }

  try {
    const Notifications = await import("expo-notifications");
    const ready = await ensureLocalNotifications();
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
