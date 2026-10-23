import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { nativeDriver } from "../nativeAnim";
import { useTheme } from "../ThemeContext";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const hideToast = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: nativeDriver }).start(() => setToast(null));
  }, [opacity]);

  const showToast = useCallback(
    (payload) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(payload);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: nativeDriver }).start();
      timer.current = setTimeout(hideToast, payload.duration ?? 3200);
    },
    [hideToast, opacity],
  );

  const api = useMemo(
    () => ({
      success(title, options = {}) {
        showToast({ type: "success", title, ...options });
      },
      error(title, options = {}) {
        showToast({ type: "error", title, ...options });
      },
      info(title, options = {}) {
        showToast({ type: "info", title, ...options });
      },
      confirm({ title, message, confirmText = "Confirm", cancelText = "Cancel", destructive = false, onConfirm }) {
        setDialog({ title, message, confirmText, cancelText, destructive, onConfirm });
      },
    }),
    [showToast],
  );

  const icon =
    toast?.type === "error" ? "close-circle" : toast?.type === "info" ? "mail" : "checkmark-circle";
  const iconColor = toast?.type === "error" ? c.danger : toast?.type === "info" ? c.ocean : c.success;

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {toast && (
        <Animated.View style={[styles.toastWrap, { top: insets.top + 10, opacity }]} pointerEvents="box-none">
          <View style={[styles.toast, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name={icon} size={20} color={iconColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.toastTitle, { color: c.text }]}>{toast.title}</Text>
              {!!toast.description && <Text style={[styles.toastDesc, { color: c.muted }]}>{toast.description}</Text>}
            </View>
            {toast.actionLabel ? (
              <Pressable
                style={[styles.toastAction, { backgroundColor: c.ocean }]}
                onPress={() => {
                  hideToast();
                  toast.onAction?.();
                }}
              >
                <Text style={styles.toastActionText}>{toast.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      )}

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDialog(null)}>
          <Pressable style={[styles.dialog, { backgroundColor: c.sheet }]} onPress={() => {}}>
            <Text style={[styles.dialogTitle, { color: c.text }]}>{dialog?.title}</Text>
            {!!dialog?.message && <Text style={[styles.dialogMsg, { color: c.muted }]}>{dialog.message}</Text>}
            <View style={styles.dialogActions}>
              <Pressable style={[styles.dialogCancel, { borderColor: c.border }]} onPress={() => setDialog(null)}>
                <Text style={[styles.dialogCancelText, { color: c.text }]}>{dialog?.cancelText}</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogConfirm, { backgroundColor: c.ocean }, dialog?.destructive && { backgroundColor: c.danger }]}
                onPress={() => {
                  const fn = dialog?.onConfirm;
                  setDialog(null);
                  fn?.();
                }}
              >
                <Text style={styles.dialogConfirmText}>{dialog?.confirmText}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback requires FeedbackProvider");
  return ctx;
}

export function SuccessBanner({ title, subtitle, onClose }) {
  const { c } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: c.successBg }]}>
      <Ionicons name="checkmark-circle" size={32} color={c.success} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerTitle, { color: c.success }]}>{title}</Text>
        {!!subtitle && <Text style={[styles.bannerSub, { color: c.success }]}>{subtitle}</Text>}
      </View>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={18} color={c.success} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: "absolute", left: 12, right: 12, zIndex: 1000 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#123",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastTitle: { fontSize: 14, fontWeight: "700", color: "#173042" },
  toastDesc: { fontSize: 12, color: "#5C6B73", marginTop: 2 },
  toastAction: {
    backgroundColor: "#1B7C98",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  toastActionText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(18,38,58,0.45)",
    justifyContent: "center",
    padding: 28,
  },
  dialog: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    maxWidth: 340,
    width: "100%",
    alignSelf: "center",
  },
  dialogTitle: { fontSize: 17, fontWeight: "800", color: "#173042" },
  dialogMsg: { marginTop: 8, fontSize: 14, color: "#5C6B73", lineHeight: 20 },
  dialogActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  dialogCancel: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8EC",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dialogCancelText: { fontWeight: "700", color: "#173042" },
  dialogConfirm: {
    borderRadius: 20,
    backgroundColor: "#1B7C98",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dialogDanger: { backgroundColor: "#C1121F" },
  dialogConfirmText: { fontWeight: "700", color: "#fff" },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#E5F4EC",
    borderRadius: 16,
    padding: 14,
  },
  bannerTitle: { fontWeight: "700", color: "#2D6A4F", fontSize: 15 },
  bannerSub: { marginTop: 2, fontSize: 12, color: "#3E7A5C" },
});
