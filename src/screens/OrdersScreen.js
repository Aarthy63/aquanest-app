import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { getProduct } from "../catalog";
import { productImage } from "../images";
import { formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../AuthContext";
import { SuccessBanner, useFeedback } from "../ui/Feedback";

const TRACK_STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "out-for-delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

function itemImage(item) {
  return productImage(getProduct(item.productId) || { category: "purifiers" });
}

function formatDate(iso, withTime = false) {
  if (!iso) return "";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

function StatusPill({ status, c }) {
  const key = String(status || "").toLowerCase();
  const tone =
    key === "cancelled" || key === "rejected"
      ? { bg: c.mist, fg: c.danger }
      : key === "completed" || key === "delivered" || key === "approved"
        ? { bg: c.successBg, fg: c.success }
        : { bg: c.secondary, fg: c.ocean };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>{key.replace(/-/g, " ")}</Text>
    </View>
  );
}

function canCancel(order) {
  const s = String(order?.status || "").toLowerCase();
  return s === "placed" || s === "confirmed";
}

/** Order history list — Account → My orders */
export function OrdersScreen({ route, navigation }) {
  const { c } = useTheme();
  const { user } = useAuth();
  const feedback = useFeedback();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const placedId = route?.params?.placedId;

  const load = useCallback(() => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api("/api/orders")
      .then(setOrders)
      .catch((e) => feedback.error("Orders", { description: e.message }))
      .finally(() => setLoading(false));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
          <Ionicons name="cube-outline" size={32} color={c.ocean} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Sign in to see orders</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>Your order history and tracking will appear here.</Text>
        <Pressable
          style={[styles.btn, { backgroundColor: c.ocean }]}
          onPress={() => navigation.navigate("Login")}
        >
          <Text style={styles.btnText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <Text style={[styles.emptyBody, { color: c.muted }]}>Loading order history…</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
          <Ionicons name="cube-outline" size={32} color={c.ocean} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>No orders yet</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>Your orders and their tracking will appear here.</Text>
        <Pressable
          style={[styles.btn, { backgroundColor: c.ocean }]}
          onPress={() => navigation.getParent()?.navigate("ShopTab")}
        >
          <Text style={styles.btnText}>Start shopping</Text>
        </Pressable>
      </View>
    );
  }

  const placed = placedId ? orders.find((o) => o.id === placedId) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageKicker, { color: c.muted }]}>Order history · {orders.length} order{orders.length === 1 ? "" : "s"}</Text>

      {placed && (
        <View style={{ marginBottom: 10 }}>
          <SuccessBanner title="Order placed successfully!" subtitle={`Payment ref ${placed.paymentRef || "COD"}`} />
        </View>
      )}

      {orders.map((o) => (
        <Pressable
          key={o.id}
          style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}
          onPress={() => navigation.navigate("OrderDetail", { id: o.id, placed: o.id === placedId })}
        >
          <View style={styles.rowBetween}>
            <Text style={[styles.meta, { color: c.muted }]}>
              #{o.id} · {formatDate(o.createdAt)}
            </Text>
            <StatusPill status={o.status} c={c} />
          </View>

          <View style={styles.cardBody}>
            <View style={styles.thumbs}>
              {(o.items || []).slice(0, 3).map((it, i) => (
                <Image
                  key={`${it.productId}-${i}`}
                  source={itemImage(it)}
                  style={[
                    styles.thumb,
                    { borderColor: c.card, marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i, backgroundColor: c.chip },
                  ]}
                />
              ))}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.itemName, { color: c.text }]}>
                {o.items?.[0]?.name}
                {(o.items?.length || 0) > 1 ? ` +${o.items.length - 1} more` : ""}
              </Text>
              <Text style={[styles.total, { color: c.text }]}>
                {formatINR(o.total)}
                {o.isDealerOrder ? <Text style={[styles.dealerTag, { color: c.ocean }]}>  DEALER</Text> : null}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Single order detail + tracking */
export function OrderDetailScreen({ route, navigation }) {
  const { c } = useTheme();
  const feedback = useFeedback();
  const { id, placed } = route.params || {};
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/api/orders")
      .then((list) => {
        const found = list.find((o) => o.id === id);
        setOrder(found || null);
      })
      .catch((e) => feedback.error("Order", { description: e.message }));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, 30000);
      return () => clearInterval(t);
    }, [load]),
  );

  function cancel() {
    if (!order) return;
    feedback.confirm({
      title: "Cancel this order?",
      message: `Your payment of ${formatINR(order.total)} will be refunded in 5–7 working days.`,
      confirmText: "Yes, cancel",
      cancelText: "Keep order",
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          const updated = await api(`/api/orders/${order.id}/cancel`, { method: "POST" });
          setOrder(updated);
          feedback.info("Order cancelled");
        } catch (e) {
          feedback.error("Cancel failed", { description: e.message });
        } finally {
          setBusy(false);
        }
      },
    });
  }

  if (!order) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
          <Ionicons name="alert-circle-outline" size={32} color={c.ocean} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Order not found</Text>
        <Pressable style={[styles.btn, { backgroundColor: c.ocean }]} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>My orders</Text>
        </Pressable>
      </View>
    );
  }

  const status = String(order.status || "").toLowerCase();
  const current = TRACK_STEPS.findIndex((s) => s.key === status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={styles.detail} showsVerticalScrollIndicator={false}>
      {placed ? (
        <View style={{ marginBottom: 10 }}>
          <SuccessBanner title="Order placed successfully!" subtitle={`Payment ref ${order.paymentRef || "COD"}`} />
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.rowBetween}>
          <View>
            <Text style={[styles.itemName, { color: c.text }]}>#{order.id}</Text>
            <Text style={[styles.meta, { color: c.muted, marginTop: 4 }]}>{formatDate(order.createdAt, true)}</Text>
          </View>
          <StatusPill status={order.status} c={c} />
        </View>
      </View>

      <Text style={[styles.section, { color: c.text }]}>Tracking</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
        {status === "cancelled" ? (
          <Text style={{ color: c.danger, fontSize: 13, lineHeight: 19 }}>
            This order was cancelled. Any payment will be refunded in 5–7 working days.
          </Text>
        ) : (
          TRACK_STEPS.map((s, i) => {
            const done = current >= 0 && i <= current;
            const active = i === current;
            return (
              <View key={s.key} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View
                    style={[
                      styles.stepDot,
                      {
                        borderColor: done ? c.ocean : c.border,
                        backgroundColor: done ? c.ocean : c.card,
                      },
                    ]}
                  >
                    {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                  </View>
                  {i < TRACK_STEPS.length - 1 ? (
                    <View style={[styles.stepLine, { backgroundColor: i < current ? c.ocean : c.border }]} />
                  ) : null}
                </View>
                <View style={{ flex: 1, paddingBottom: i < TRACK_STEPS.length - 1 ? 16 : 0 }}>
                  <Text style={{ fontWeight: "700", fontSize: 14, color: done ? c.text : c.muted }}>{s.label}</Text>
                  {active ? <Text style={{ color: c.ocean, fontSize: 11, marginTop: 2, fontWeight: "600" }}>Current status</Text> : null}
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text style={[styles.section, { color: c.text }]}>Items ({order.items?.length || 0})</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, gap: 10 }]}>
        {(order.items || []).map((it) => (
          <Pressable
            key={it.productId}
            style={styles.lineRow}
            onPress={() =>
              navigation.getParent()?.navigate("ShopTab", { screen: "Product", params: { id: it.productId } })
            }
          >
            <Image source={itemImage(it)} style={[styles.lineImg, { backgroundColor: c.chip }]} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.itemName, { color: c.text, fontSize: 13 }]}>
                {it.name}
              </Text>
              <Text style={[styles.meta, { color: c.muted }]}>
                {it.qty} × {formatINR(it.unitPrice)}
              </Text>
            </View>
            <Text style={[styles.total, { color: c.text, fontSize: 13 }]}>{formatINR(it.qty * it.unitPrice)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.section, { color: c.text }]}>Delivery address</Text>
      <View style={[styles.card, { backgroundColor: c.mist, borderColor: c.border, flexDirection: "row", gap: 10 }]}>
        <Ionicons name="location-outline" size={18} color={c.ocean} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: c.text, fontSize: 13 }]}>
            {order.address?.name}
            {order.address?.phone ? ` · ${order.address.phone}` : ""}
          </Text>
          <Text style={[styles.meta, { color: c.muted, marginTop: 4, lineHeight: 18 }]}>
            {order.address?.line1}
            {order.address?.line2 ? `, ${order.address.line2}` : ""}, {order.address?.city}
            {order.address?.state ? `, ${order.address.state}` : ""} – {order.address?.pincode}
          </Text>
        </View>
      </View>

      <Text style={[styles.section, { color: c.text }]}>Payment</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
        <Row label="Method" value={order.paymentMethod} c={c} />
        <Row label="Items" value={formatINR(order.subtotal)} c={c} />
        <Row label="Delivery" value={order.delivery ? formatINR(order.delivery) : "FREE"} c={c} />
        <Row label="Total paid" value={formatINR(order.total)} c={c} bold />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
          <Ionicons name="receipt-outline" size={14} color={c.muted} />
          <Text style={[styles.meta, { color: c.muted }]}>Ref {order.paymentRef || "—"}</Text>
        </View>
      </View>

      {canCancel(order) ? (
        <Pressable
          style={[styles.cancelBtn, { borderColor: c.danger, opacity: busy ? 0.6 : 1 }]}
          onPress={cancel}
          disabled={busy}
        >
          <Text style={[styles.cancelText, { color: c.danger }]}>Cancel order</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Row({ label, value, c, bold }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={{ color: c.muted, fontSize: 14, fontWeight: bold ? "700" : "500" }}>{label}</Text>
      <Text style={{ color: c.text, fontSize: 14, fontWeight: bold ? "800" : "600" }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 28 },
  detail: { padding: 16, paddingBottom: 36 },
  pageKicker: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  section: { fontSize: 15, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 12, marginBottom: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardBody: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  thumbs: { flexDirection: "row", alignItems: "center" },
  thumb: { width: 44, height: 44, borderRadius: 12, borderWidth: 2 },
  itemName: { fontWeight: "700", fontSize: 14 },
  total: { fontWeight: "800", fontSize: 14, marginTop: 2 },
  dealerTag: { fontSize: 10, fontWeight: "800" },
  meta: { fontSize: 12 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  prompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyBody: { marginTop: 6, textAlign: "center", fontSize: 14 },
  btn: { marginTop: 20, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  stepRow: { flexDirection: "row", gap: 12 },
  stepRail: { width: 22, alignItems: "center" },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 18, marginTop: 2 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  lineImg: { width: 52, height: 52, borderRadius: 10 },
  cancelBtn: {
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1.5,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontWeight: "700", fontSize: 14 },
});
