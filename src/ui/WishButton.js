import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { useFeedback } from "./Feedback";

/** Heart on product image — matches web ProductCard wishlist control. */
export default function WishButton({ productId, size = 32, iconSize = 16, style }) {
  const { c } = useTheme();
  const navigation = useNavigation();
  const { user, setWishlist, refresh } = useAuth();
  const feedback = useFeedback();
  const wished = !!user?.wishlist?.includes(productId);

  async function onPress() {
    if (!user) {
      feedback.info("Sign in to save items", {
        description: "Your wishlist syncs across devices.",
        actionLabel: "Sign in",
        onAction: () => {
          const root = navigation.getParent?.()?.getParent?.() || navigation.getParent?.() || navigation;
          root.navigate?.("Login") || navigation.navigate("Login");
        },
      });
      return;
    }
    const nextOn = !wished;
    // Optimistic UI
    const prev = user.wishlist || [];
    const next = nextOn ? [productId, ...prev.filter((id) => id !== productId)] : prev.filter((id) => id !== productId);
    setWishlist?.(next);
    try {
      const data = await api(`/api/wishlist/${productId}`, { method: "POST" });
      setWishlist?.(data.wishlist);
      feedback.success(nextOn ? "Saved to wishlist" : "Removed from wishlist");
    } catch (e) {
      setWishlist?.(prev);
      await refresh?.();
      feedback.error("Wishlist", { description: e.message });
    }
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.card,
          borderColor: c.border,
        },
        style,
      ]}
      accessibilityLabel={wished ? "Remove from wishlist" : "Add to wishlist"}
    >
      <Ionicons
        name={wished ? "heart" : "heart-outline"}
        size={iconSize}
        color={wished ? c.danger : c.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
});
