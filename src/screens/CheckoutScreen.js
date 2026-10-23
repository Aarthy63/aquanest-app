import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { RAZORPAY_KEY_ID } from "../config";
import { productImage } from "../images";
import { colors, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import { SuccessBanner, useFeedback } from "../ui/Feedback";
import RazorpayCheckout from "../ui/RazorpayCheckout";

const METHODS = [
  { id: "upi", label: "UPI", sub: "GPay, PhonePe, Paytm", icon: "phone-portrait-outline" },
  { id: "card", label: "Credit / Debit card", sub: "Visa, Mastercard, RuPay", icon: "card-outline" },
  { id: "netbanking", label: "Net banking", sub: "All major banks", icon: "business-outline" },
  { id: "wallet", label: "Wallets", sub: "Paytm, Amazon Pay", icon: "wallet-outline" },
];

const EMPTY_FORM = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" };

export default function CheckoutScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const feedback = useFeedback();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [method, setMethod] = useState("upi");
  const [addOpen, setAddOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paying, setPaying] = useState("idle");
  const [form, setForm] = useState(EMPTY_FORM);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [payMode, setPayMode] = useState("demo");
  const [rzpOrder, setRzpOrder] = useState(null);
  const [checkoutReady, setCheckoutReady] = useState(false);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const load = useCallback(() => {
    Promise.all([api("/api/cart"), api("/api/addresses")])
      .then(([c, list]) => {
        setCart(c);
        setAddresses(list);
        setAddressId((current) => current || list[0]?.id || null);
      })
      .catch((e) => feedback.error("Checkout", { description: e.message }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!placedOrder) load();
    }, [load, placedOrder]),
  );

  const useRealCheckout = payMode === "test" || payMode === "live";
  const methodLabel = METHODS.find((m) => m.id === method)?.label;

  async function saveAddress() {
    try {
      const list = await api("/api/addresses", { method: "POST", body: form });
      setAddresses(list);
      setAddressId(list[list.length - 1].id);
      setForm(EMPTY_FORM);
      setAddOpen(false);
      feedback.success("Address saved");
    } catch (e) {
      feedback.error("Address", { description: e.message });
    }
  }

  async function openPaySheet() {
    if (!addressId) return;
    setPayOpen(true);
    setPaying("idle");
    setCheckoutReady(false);
    setRzpOrder(null);
    try {
      const created = await api("/api/payments/razorpay/order", {
        method: "POST",
        body: { addressId },
      });
      const keyId = created.keyId || RAZORPAY_KEY_ID;
      const mode = created.mode || "demo";
      setRzpOrder({ ...created, keyId });
      setPayMode(mode);
      // Real Checkout when backend created a Razorpay order with a key
      setCheckoutReady(!!(keyId && created.id && !String(created.id).startsWith("order_test_")));
    } catch (e) {
      setPayOpen(false);
      feedback.error("Payment", { description: e.message });
    }
  }

  async function completeOrder({ paymentId, orderId, signature }) {
    if (orderId && paymentId) {
      await api("/api/payments/razorpay/verify", {
        method: "POST",
        body: {
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || "",
        },
      });
    }
    const order = await api("/api/orders", {
      method: "POST",
      body: {
        addressId,
        paymentMethod: `Razorpay · ${methodLabel || method}`,
        paymentRef: paymentId || orderId,
      },
    });
    return order;
  }

  async function finishSuccess({ paymentId, orderId, signature }) {
    setPaying("processing");
    try {
      const order = await completeOrder({ paymentId, orderId, signature });
      setPaying("success");
      setTimeout(() => {
        setPayOpen(false);
        setPaying("idle");
        setCheckoutReady(false);
        setPlacedOrder(order);
        feedback.success("Order placed successfully!", {
          description: `Confirmation email sent · #${order.id}`,
        });
      }, 700);
    } catch (e) {
      setPaying("idle");
      setPayOpen(false);
      setCheckoutReady(false);
      feedback.error("Checkout", { description: e.message });
    }
  }

  function onRazorpayResult(result) {
    if (!result || paying === "processing" || paying === "success") return;
    if (result.type === "success") {
      finishSuccess({
        paymentId: result.razorpay_payment_id,
        orderId: result.razorpay_order_id || rzpOrder?.id,
        signature: result.razorpay_signature,
      });
      return;
    }
    if (result.type === "dismiss") {
      setPayOpen(false);
      setCheckoutReady(false);
      setPaying("idle");
      return;
    }
    if (result.type === "failed") {
      setPaying("idle");
      setPayOpen(false);
      setCheckoutReady(false);
      feedback.error("Payment failed", {
        description: result.description || "No money was deducted. Please try again.",
      });
    }
  }

  function payDemo(outcome) {
    if (!addressId) return;
    setPaying("processing");
    setTimeout(async () => {
      if (outcome === "failed") {
        setPaying("idle");
        setPayOpen(false);
        feedback.error("Payment failed", { description: "No money was deducted. Please try again." });
        return;
      }
      try {
        const paymentId = `pay_test_${Math.random().toString(36).slice(2, 12)}`;
        const orderId = rzpOrder?.id || `order_test_${Date.now()}`;
        await finishSuccess({ paymentId, orderId, signature: "test" });
      } catch (e) {
        setPaying("idle");
        setPayOpen(false);
        feedback.error("Checkout", { description: e.message });
      }
    }, 500);
  }

  if (placedOrder) {
    return (
      <View style={[styles.page, { paddingTop: 8, backgroundColor: c.bg }]}>
        <SuccessBanner
          title="Order placed successfully!"
          subtitle={`Payment ref ${placedOrder.paymentRef} · #${placedOrder.id}`}
        />
        <View style={[styles.mailCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="mail-outline" size={20} color={c.ocean} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.mailTitle, { color: c.text }]}>Email notification sent</Text>
            <Text style={[styles.mailBody, { color: c.muted }]}>We've emailed your order confirmation and tracking updates.</Text>
          </View>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.itemName, { color: c.text }]}>#{placedOrder.id}</Text>
          <Text style={[styles.payable, { color: c.text }]}>{formatINR(placedOrder.total)}</Text>
          <Text style={[styles.addrLine, { color: c.muted }]}>
            {placedOrder.items?.length || 0} item(s) · {placedOrder.paymentMethod}
          </Text>
        </View>
        <View style={styles.placedActions}>
          <Pressable
            style={[styles.payBtn, { backgroundColor: c.ocean }]}
            onPress={() => navigation.replace("OrderDetail", { id: placedOrder.id, placed: true })}
          >
            <Text style={styles.payBtnText}>View order</Text>
          </Pressable>
          <Pressable style={[styles.outlineBtn, { borderColor: c.ocean }]} onPress={() => navigation.getParent()?.navigate("ShopTab")}>
            <Text style={[styles.outlineText, { color: c.ocean }]}>Continue shopping</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!cart) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={c.ocean} />;
  }

  const items = cart.items || [];
  if (items.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg }]}>
        <Text style={[styles.emptyTitle, { color: c.text }]}>Your cart is empty</Text>
        <Pressable onPress={() => navigation.getParent()?.navigate("ShopTab")}>
          <Text style={[styles.link, { color: c.ocean }]}>Go shopping</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: c.text, marginHorizontal: 0 }]}>Delivery address</Text>
          <Pressable style={styles.addLink} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={14} color={c.ocean} />
            <Text style={[styles.addLinkText, { color: c.ocean }]}>Add new</Text>
          </Pressable>
        </View>

        {addresses.length === 0 ? (
          <Pressable style={[styles.dashed, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => setAddOpen(true)}>
            <Ionicons name="location-outline" size={20} color={c.ocean} />
            <Text style={[styles.dashedText, { color: c.text }]}>Add a delivery address</Text>
          </Pressable>
        ) : (
          <View style={styles.block}>
            {addresses.map((a) => {
              const on = addressId === a.id;
              return (
                <Pressable
                  key={a.id}
                  style={[styles.addrCard, { backgroundColor: c.card, borderColor: c.border }, on && { borderColor: c.ocean, borderWidth: 1.5 }]}
                  onPress={() => setAddressId(a.id)}
                >
                  <View style={[styles.radio, { borderColor: c.border }, on && { borderColor: c.ocean }]}>
                    {on && <View style={[styles.radioDot, { backgroundColor: c.ocean }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.itemName, { color: c.text }]}>{a.name}</Text>
                      <View style={[styles.labelPill, { backgroundColor: c.secondary }]}>
                        <Text style={[styles.labelPillText, { color: c.oceanDeep }]}>{(a.label || "Home").toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={[styles.addrLine, { color: c.muted }]}>
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}
                    </Text>
                    {!!a.phone && <Text style={[styles.addrLine, { color: c.muted }]}>{a.phone}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.section, { marginTop: 18, color: c.text }]}>Order summary ({cart.itemCount})</Text>
        <View style={styles.block}>
          {items.map((line) => (
            <View key={line.productId} style={styles.lineRow}>
              <Image source={productImage(line.product)} style={[styles.thumb, { backgroundColor: c.chip }]} />
              <Text numberOfLines={1} style={[styles.lineName, { color: c.text }]}>
                {line.product.name}
              </Text>
              <Text style={[styles.qty, { color: c.muted }]}>×{line.qty}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.section, { marginTop: 18, color: c.text }]}>Payment method</Text>
        <View style={styles.block}>
          {METHODS.map((m) => {
            const on = method === m.id;
            return (
              <Pressable
                key={m.id}
                style={[styles.methodCard, { backgroundColor: c.card, borderColor: c.border }, on && { borderColor: c.ocean, borderWidth: 1.5 }]}
                onPress={() => setMethod(m.id)}
              >
                <Ionicons name={m.icon} size={20} color={c.ocean} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, { color: c.text }]}>{m.label}</Text>
                  <Text style={[styles.addrLine, { color: c.muted }]}>{m.sub}</Text>
                </View>
                <View style={[styles.radio, { borderColor: c.border }, on && { borderColor: c.ocean }]}>
                  {on && <View style={[styles.radioDot, { backgroundColor: c.ocean }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.amountBox, { backgroundColor: c.amountBox }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: c.muted }]}>Items</Text>
            <Text style={[styles.rowValue, { color: c.text }]}>{formatINR(cart.subtotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: c.muted }]}>Delivery</Text>
            <Text style={[styles.rowValue, { color: c.text }, cart.delivery === 0 && { color: c.success }]}>
              {cart.delivery === 0 ? "FREE" : formatINR(cart.delivery)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.payableLabel, { color: c.text }]}>Amount payable</Text>
            <Text style={[styles.payable, { color: c.text }]}>{formatINR(cart.total)}</Text>
          </View>
        </View>
        <View style={styles.secure}>
          <Ionicons name="shield-checkmark" size={14} color={c.success} />
          <Text style={[styles.secureText, { color: c.muted }]}>Secured by Razorpay</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.card, borderTopColor: c.border }]}>
        <Pressable
          style={[styles.payBtn, { backgroundColor: c.ocean }, !addressId && { opacity: 0.55 }]}
          disabled={!addressId}
          onPress={openPaySheet}
        >
          <Text style={styles.payBtnText}>{addressId ? `Pay ${formatINR(cart.total)}` : "Add an address to continue"}</Text>
        </Pressable>
      </View>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: c.sheet }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.text }]}>New address</Text>
              <Pressable onPress={() => setAddOpen(false)}>
                <Ionicons name="close" size={20} color={c.muted} />
              </Pressable>
            </View>
            {[
              ["name", "Full name"],
              ["phone", "Phone"],
              ["line1", "Address line 1"],
              ["line2", "Address line 2 (optional)"],
              ["city", "City"],
              ["state", "State"],
              ["pincode", "PIN code"],
            ].map(([k, label]) => (
              <TextInput
                key={k}
                placeholder={label}
                value={form[k]}
                onChangeText={set(k)}
                style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
                placeholderTextColor={c.muted}
                keyboardType={k === "phone" || k === "pincode" ? "number-pad" : "default"}
              />
            ))}
            <Pressable style={[styles.payBtn, { backgroundColor: c.ocean }]} onPress={saveAddress}>
              <Text style={styles.payBtnText}>Save address</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={payOpen}
        animationType="slide"
        onRequestClose={() => paying === "idle" && setPayOpen(false)}
      >
        <View style={[styles.checkoutPage, { paddingTop: insets.top, backgroundColor: c.sheet }]}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Razorpay Checkout</Text>
            {paying === "idle" && (
              <Pressable
                onPress={() => {
                  setPayOpen(false);
                  setCheckoutReady(false);
                }}
              >
                <Ionicons name="close" size={22} color={c.muted} />
              </Pressable>
            )}
          </View>

          <View style={[styles.testPill, { backgroundColor: payMode === "live" ? c.successBg : c.warning + "33", alignSelf: "flex-start" }]}>
            <Text style={[styles.testPillText, { color: payMode === "live" ? c.success : c.warning }]}>
              {payMode === "live" ? "LIVE" : payMode === "test" ? "RAZORPAY TEST" : "DEMO MODE"}
            </Text>
          </View>
          <Text style={[styles.paySub, { color: c.muted, marginTop: 8 }]}>
            AquaNest · {methodLabel} · {formatINR(rzpOrder?.amountInr ?? cart.total)}
          </Text>

          {paying === "processing" && (
            <View style={styles.payStatus}>
              <ActivityIndicator color={c.ocean} />
              <Text style={[styles.payStatusText, { color: c.muted }]}>Confirming payment…</Text>
            </View>
          )}
          {paying === "success" && (
            <View style={styles.payStatus}>
              <Ionicons name="checkmark-circle" size={28} color={c.success} />
              <Text style={[styles.payStatusText, { color: c.success, fontWeight: "700" }]}>Payment successful</Text>
            </View>
          )}

          {paying === "idle" && checkoutReady && useRealCheckout && (
            <View style={styles.webviewWrap}>
              <RazorpayCheckout order={rzpOrder} methodLabel={methodLabel} onResult={onRazorpayResult} />
            </View>
          )}

          {paying === "idle" && !checkoutReady && (
            <View style={styles.payCenter}>
              {!rzpOrder ? (
                <ActivityIndicator color={c.ocean} />
              ) : (
                <>
                  <Text style={[styles.payAmount, { color: c.text }]}>{formatINR(rzpOrder?.amountInr ?? cart.total)}</Text>
                  <Pressable style={[styles.payBtn, { backgroundColor: c.ocean, width: "100%" }]} onPress={() => payDemo("success")}>
                    <Text style={styles.payBtnText}>Pay now (demo)</Text>
                  </Pressable>
                  <Pressable style={[styles.outlineBtn, { borderColor: c.ocean }]} onPress={() => payDemo("failed")}>
                    <Text style={[styles.outlineText, { color: c.ocean }]}>Simulate failed payment</Text>
                  </Pressable>
                  <Text style={[styles.testNote, { color: c.muted }]}>
                    Add matching RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in backend/.env to open real Razorpay Checkout.
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F9FA" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { fontWeight: "700", color: "#173042", fontSize: 16 },
  link: { marginTop: 10, color: "#1B7C98", fontWeight: "700" },
  sectionHead: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { marginHorizontal: 16, marginBottom: 10, fontSize: 15, fontWeight: "700", color: "#173042" },
  addLink: { flexDirection: "row", alignItems: "center", gap: 2 },
  addLinkText: { color: "#1B7C98", fontWeight: "700", fontSize: 12 },
  dashed: {
    marginHorizontal: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D5E1E6",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
  },
  dashedText: { fontSize: 14, fontWeight: "600", color: "#173042" },
  block: { paddingHorizontal: 16, gap: 8 },
  addrCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 12,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#C5D2D8",
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#1B7C98" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  itemName: { fontWeight: "700", color: "#173042", fontSize: 14 },
  labelPill: { backgroundColor: "#E7F3F7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  labelPillText: { fontSize: 10, fontWeight: "800", color: "#1A4E63" },
  addrLine: { marginTop: 3, color: colors.muted, fontSize: 12, lineHeight: 17 },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#EEF3F5" },
  lineName: { flex: 1, fontSize: 13, color: "#173042", fontWeight: "600" },
  qty: { color: colors.muted, fontSize: 13 },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 12,
  },
  amountBox: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: "#EEF3F5",
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: "#173042", fontWeight: "600", fontSize: 14 },
  payableLabel: { fontWeight: "800", color: "#173042", fontSize: 14 },
  payable: { fontWeight: "800", color: "#173042", fontSize: 16 },
  secure: { marginHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  secureText: { fontSize: 12, color: colors.muted },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: "#E6EEF1",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  payBtn: {
    backgroundColor: "#1B7C98",
    borderRadius: 24,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backdrop: { flex: 1, backgroundColor: "rgba(18,38,58,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: "88%",
  },
  checkoutPage: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },
  webviewWrap: { flex: 1, marginTop: 12, borderRadius: 16, overflow: "hidden" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: "#173042" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 46,
    paddingHorizontal: 12,
    marginBottom: 8,
    color: colors.text,
  },
  payCenter: { alignItems: "center", paddingBottom: 8, gap: 10, marginTop: 24 },
  testPill: { backgroundColor: "#F6E7C1", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  testPillText: { fontSize: 10, fontWeight: "800", color: "#8A6A16" },
  paySub: { fontSize: 12, color: colors.muted },
  payAmount: { fontSize: 32, fontWeight: "800", color: "#173042", marginBottom: 6 },
  payStatus: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 18 },
  payStatusText: { color: colors.muted, fontSize: 14 },
  outlineBtn: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1B7C98",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: "#1B7C98", fontWeight: "700" },
  testNote: { fontSize: 11, color: colors.muted, marginTop: 2, textAlign: "center" },
  mailCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  mailTitle: { fontWeight: "700", color: "#173042" },
  mailBody: { marginTop: 2, color: colors.muted, fontSize: 12 },
  summaryBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 14,
  },
  placedActions: { paddingHorizontal: 16, marginTop: 16, gap: 10 },
});
