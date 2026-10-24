import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { FREE_DELIVERY_THRESHOLD } from "../catalog";
import { productImage } from "../images";
import { colors, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../AuthContext";
import { useFeedback } from "../ui/Feedback";
import AnimatedBackground from "../ui/AnimatedBackground";

export default function CartScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { user } = useAuth();
  const feedback = useFeedback();
  const [cart, setCart] = useState(null);

  const load = useCallback(() => {
    if (!user) {
      setCart({ items: [], subtotal: 0, delivery: 0, total: 0, itemCount: 0 });
      return;
    }
    api("/api/cart")
      .then(setCart)
      .catch((e) => feedback.error("Cart", { description: e.message }));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const toFree = FREE_DELIVERY_THRESHOLD - subtotal;
  const savings = items.reduce((sum, line) => sum + Math.max(0, (line.product.mrp - line.unitPrice) * line.qty), 0);

  function setQty(line, qty) {
    // Optimistic local update for snappy APK feel
    setCart((prev) => {
      if (!prev) return prev;
      const items = (prev.items || []).map((l) =>
        l.productId === line.productId ? { ...l, qty } : l,
      );
      return { ...prev, items, itemCount: items.reduce((s, l) => s + l.qty, 0) };
    });
    api(`/api/cart/items/${line.productId}`, { method: "PATCH", body: { qty } })
      .then(setCart)
      .catch((e) => {
        load();
        feedback.error("Cart", { description: e.message });
      });
  }

  function remove(line) {
    feedback.confirm({
      title: "Remove item?",
      message: `${line.product.name} will be removed from your cart.`,
      confirmText: "Remove",
      cancelText: "Keep",
      destructive: true,
      onConfirm: () =>
        api(`/api/cart/items/${line.productId}`, { method: "DELETE" })
          .then(setCart)
          .catch((e) => feedback.error("Cart", { description: e.message })),
    });
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <AnimatedBackground intensity={0.75} />
      <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <Text style={[styles.headerTitle, { color: c.text }]}>Cart{cart?.itemCount ? ` (${cart.itemCount})` : ""}</Text>
      </View>

      {!cart || items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="cart-outline" size={32} color={c.ocean} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>Your cart is empty</Text>
          <Text style={[styles.emptyBody, { color: c.muted }]}>Add purifiers, filters or spare parts to get started.</Text>
          <Pressable style={[styles.shopBtn, { backgroundColor: c.ocean }]} onPress={() => navigation.getParent()?.navigate("ShopTab")}>
            <Text style={styles.shopBtnText}>Start shopping</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.body}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <View style={[styles.banner, { backgroundColor: toFree > 0 ? c.bannerSoon : c.successBg }]}>
              <Ionicons name="car-outline" size={16} color={toFree > 0 ? c.oceanDeep : c.success} />
              <Text style={[styles.bannerText, { color: toFree > 0 ? c.oceanDeep : c.success }]}>
                {toFree > 0 ? `Add ${formatINR(toFree)} more for free delivery` : "You get free delivery!"}
              </Text>
            </View>

            {items.map((line) => (
              <View key={line.productId} style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
                <Image source={productImage(line.product)} style={[styles.img, { backgroundColor: c.chip }]} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[styles.name, { color: c.text }]}>
                    {line.product.name}
                  </Text>
                  <Text style={[styles.price, { color: c.text }]}>
                    {formatINR(line.unitPrice)} <Text style={[styles.each, { color: c.muted }]}>each</Text>
                  </Text>
                  <View style={styles.qtyRow}>
                    <View style={[styles.stepper, { borderColor: c.border }]}>
                      <Pressable style={styles.step} onPress={() => setQty(line, line.qty - 1)}>
                        <Text style={[styles.stepText, { color: c.text }]}>−</Text>
                      </Pressable>
                      <Text style={[styles.qty, { color: c.text }]}>{line.qty}</Text>
                      <Pressable style={styles.step} onPress={() => setQty(line, Math.min(line.qty + 1, line.product.stock))}>
                        <Text style={[styles.stepText, { color: c.text }]}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => remove(line)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={c.muted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            <View style={[styles.details, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.detailsTitle, { color: c.text }]}>Price details</Text>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.muted }]}>Items ({cart.itemCount})</Text>
                <Text style={[styles.detailValue, { color: c.text }]}>{formatINR(cart.subtotal)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.muted }]}>Delivery</Text>
                <Text style={[styles.detailValue, { color: cart.delivery === 0 ? c.success : c.text }]}>
                  {cart.delivery === 0 ? "FREE" : formatINR(cart.delivery)}
                </Text>
              </View>
              <View style={[styles.detailRow, styles.totalRow, { borderTopColor: c.border }]}>
                <Text style={[styles.totalLabel, { color: c.text }]}>Total</Text>
                <Text style={[styles.totalLabel, { color: c.text }]}>{formatINR(cart.total)}</Text>
              </View>
              {savings > 0 && <Text style={[styles.save, { color: c.success }]}>You save {formatINR(savings)} on this order</Text>}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: 12, backgroundColor: c.card, borderTopColor: c.border }]}>
            <View style={styles.footerPrice}>
              <Text style={[styles.footerKicker, { color: c.muted }]}>Total</Text>
              <Text style={[styles.footerTotal, { color: c.text }]}>{formatINR(cart.total)}</Text>
            </View>
            <Pressable
              style={[styles.checkout, { backgroundColor: c.ocean }]}
              onPress={() => (user ? navigation.navigate("Checkout") : navigation.navigate("Login"))}
            >
              <Text style={styles.checkoutText}>{user ? "Proceed to checkout" : "Sign in to checkout"}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F9FA" },
  header: {
    height: 56,
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF1",
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#173042" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E7F3F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#173042" },
  emptyBody: { marginTop: 6, textAlign: "center", color: colors.muted, fontSize: 14 },
  shopBtn: { marginTop: 22, backgroundColor: "#1B7C98", borderRadius: 24, paddingHorizontal: 22, paddingVertical: 12 },
  shopBtnText: { color: "#fff", fontWeight: "700" },
  body: { flex: 1 },
  scroll: { flex: 1 },
  list: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  bannerSoon: { backgroundColor: "#E7F3F7" },
  bannerFree: { backgroundColor: "#E5F4EC" },
  bannerText: { fontSize: 12, fontWeight: "600", color: "#1A4E63", flex: 1 },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 12,
    marginBottom: 12,
  },
  img: { width: 80, height: 80, borderRadius: 12, backgroundColor: "#F3F6F8" },
  name: { fontSize: 14, fontWeight: "700", color: "#173042" },
  price: { marginTop: 4, fontWeight: "800", color: "#173042" },
  each: { fontWeight: "500", fontSize: 11, color: colors.muted },
  qtyRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8EC",
    borderRadius: 20,
    overflow: "hidden",
  },
  step: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 18, color: "#173042", fontWeight: "600" },
  qty: { minWidth: 18, textAlign: "center", fontWeight: "700", color: "#173042" },
  details: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 16,
    gap: 8,
  },
  detailsTitle: { fontWeight: "700", color: "#173042", marginBottom: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { color: colors.muted, fontSize: 14 },
  detailValue: { color: "#173042", fontSize: 14, fontWeight: "600" },
  totalRow: { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: "#E2E8EC", paddingTop: 8, marginTop: 4 },
  totalLabel: { fontWeight: "800", color: "#173042", fontSize: 15 },
  save: { color: "#2D6A4F", fontSize: 12, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E6EEF1",
  },
  footerPrice: { minWidth: 84 },
  footerKicker: { fontSize: 11, color: colors.muted },
  footerTotal: { fontSize: 18, fontWeight: "800", color: "#173042" },
  checkout: {
    flex: 1,
    backgroundColor: "#1B7C98",
    borderRadius: 24,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  checkoutText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
