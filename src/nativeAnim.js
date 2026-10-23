import { Platform } from "react-native";

/** Native driver is unavailable on web — use JS fallback there. */
export const nativeDriver = Platform.OS !== "web";
