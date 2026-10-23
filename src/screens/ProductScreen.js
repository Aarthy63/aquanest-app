import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { aiPostImageUri } from "../aiPosts";
import { getProduct, products as catalogProducts } from "../catalog";
import { productImage } from "../images";
import { colors, discountPct, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../AuthContext";
import { useFeedback } from "../ui/Feedback";
import WishButton from "../ui/WishButton";

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;

/** Tap a spot on the image → zoom that part (transform origin). */
function ZoomViewer({ source, title, onClose, initialScale = 1, initialOrigin }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { c } = useTheme();
  const [scale, setScale] = useState(() => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, initialScale)));
  const [origin, setOrigin] = useState(initialOrigin || { x: 0.5, y: 0.5 });
  const base = width;
  const canZoomOut = scale > ZOOM_MIN;
  const canZoomIn = scale < ZOOM_MAX;

  function zoomBy(delta) {
    setScale((s) => {
      const next = Math.round((s + delta) * 10) / 10;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    });
  }

  function onImagePress(e) {
    const { locationX, locationY } = e.nativeEvent;
    const ox = Math.min(1, Math.max(0, locationX / base));
    const oy = Math.min(1, Math.max(0, locationY / base));
    setOrigin({ x: ox, y: oy });
    setScale((s) => (s > 1 ? 1 : 2.5));
  }

  // Pan so the tapped point stays centered when zoomed
  const translateX = (0.5 - origin.x) * base * (scale - 1);
  const translateY = (0.5 - origin.y) * base * (scale - 1);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[zoomStyles.root, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[zoomStyles.topBar, { borderBottomColor: c.border }]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text numberOfLines={1} style={[zoomStyles.title, { color: c.text }]}>
              {title}
            </Text>
            <Text style={[zoomStyles.hint, { color: c.muted }]}>
              {scale > 1 ? "Tap again to zoom out · + / − to adjust" : "Tap the part you want to zoom"}
            </Text>
          </View>
          <View style={[zoomStyles.controls, { backgroundColor: c.chip, borderColor: c.border }]}>
            <Pressable
              onPress={() => zoomBy(-ZOOM_STEP)}
              disabled={!canZoomOut}
              style={[zoomStyles.ctrlBtn, !canZoomOut && { opacity: 0.35 }]}
              hitSlop={6}
            >
              <Ionicons name="remove" size={22} color={c.text} />
            </Pressable>
            <Text style={[zoomStyles.pct, { color: c.text }]}>{Math.round(scale * 100)}%</Text>
            <Pressable
              onPress={() => zoomBy(ZOOM_STEP)}
              disabled={!canZoomIn}
              style={[zoomStyles.ctrlBtn, !canZoomIn && { opacity: 0.35 }]}
              hitSlop={6}
            >
              <Ionicons name="add" size={22} color={c.text} />
            </Pressable>
          </View>
          <Pressable onPress={onClose} style={[zoomStyles.close, { backgroundColor: c.chip }]} hitSlop={8}>
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>
        </View>

        <View style={[zoomStyles.stage, { height: Math.min(height - 160, width + 40) }]}>
          <Pressable onPress={onImagePress} style={{ width: base, height: base, overflow: "hidden", borderRadius: 12 }}>
            <Image
              source={source}
              style={{
                width: base,
                height: base,
                backgroundColor: c.chip,
                transform: [{ translateX }, { translateY }, { scale }],
              }}
              resizeMode="cover"
            />
          </Pressable>
        </View>

        <View style={[zoomStyles.bottomBar, { borderTopColor: c.border }]}>
          <Pressable
            style={[zoomStyles.action, { backgroundColor: c.card, borderColor: c.border }, !canZoomOut && { opacity: 0.4 }]}
            onPress={() => zoomBy(-ZOOM_STEP)}
            disabled={!canZoomOut}
          >
            <Ionicons name="remove-circle-outline" size={22} color={c.ocean} />
            <Text style={[zoomStyles.actionText, { color: c.text }]}>Zoom out</Text>
          </Pressable>
          <Pressable
            style={[zoomStyles.action, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => {
              setScale(1);
              setOrigin({ x: 0.5, y: 0.5 });
            }}
          >
            <Ionicons name="contract-outline" size={20} color={c.ocean} />
            <Text style={[zoomStyles.actionText, { color: c.text }]}>Reset</Text>
          </Pressable>
          <Pressable
            style={[zoomStyles.action, { backgroundColor: c.card, borderColor: c.border }, !canZoomIn && { opacity: 0.4 }]}
            onPress={() => zoomBy(ZOOM_STEP)}
            disabled={!canZoomIn}
          >
            <Ionicons name="add-circle-outline" size={22} color={c.ocean} />
            <Text style={[zoomStyles.actionText, { color: c.text }]}>Zoom in</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const zoomStyles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 11, marginTop: 2 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 4,
    height: 40,
  },
  ctrlBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  pct: { minWidth: 44, textAlign: "center", fontWeight: "800", fontSize: 12 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  bottomBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
  },
  actionText: { fontWeight: "700", fontSize: 12 },
});

export default function ProductScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const { user } = useAuth();
  const feedback = useFeedback();
  const { id } = route.params;
  const [product, setProduct] = useState(() => getProduct(id) ?? null);
  const [aiPosts, setAiPosts] = useState([]);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomStart, setZoomStart] = useState(1);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 0.5, y: 0.5 });

  function openZoom(start = 2, origin = { x: 0.5, y: 0.5 }) {
    setZoomStart(start);
    setZoomOrigin(origin);
    setZoomOpen(true);
  }

  function openZoomAt(e) {
    const { locationX, locationY } = e.nativeEvent;
    const ox = Math.min(1, Math.max(0, locationX / width));
    const oy = Math.min(1, Math.max(0, locationY / width));
    openZoom(2.5, { x: ox, y: oy });
  }

  useEffect(() => {
    const local = getProduct(id);
    if (local) {
      setProduct(local);
      setQty(1);
    }
    api(`/api/products/${id}`, { auth: false })
      .then((p) => {
        setProduct(p);
        setQty(1);
      })
      .catch(() => {
        if (!getProduct(id)) feedback.error("Product not found");
      });
    api(`/api/ai-posts?productId=${encodeURIComponent(id)}&limit=8`, { auth: false })
      .then((list) => setAiPosts(Array.isArray(list) ? list : []))
      .catch(() => setAiPosts([]));
  }, [id]);

  function openCart() {
    // Product is inside Home/Shop stack → parent is the tab navigator
    navigation.getParent()?.navigate("Cart");
  }

  function openLogin() {
    // Root stack has Login above the tabs
    navigation.getParent()?.getParent()?.navigate("Login") || navigation.navigate("Login");
  }

  async function add(goToCart) {
    if (!user) return openLogin();
    setBusy(true);
    try {
      await api("/api/cart/items", { method: "POST", body: { productId: id, qty } });
      if (goToCart) openCart();
      else {
        feedback.success("Added to cart", {
          description: `${qty} item${qty > 1 ? "s" : ""} added`,
          actionLabel: "View",
          onAction: openCart,
        });
      }
    } catch (e) {
      feedback.error("Could not add", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  if (!product) return <ActivityIndicator style={{ marginTop: 40 }} color={c.ocean} />;

  const out = product.stock <= 0;
  const off = discountPct(product);
  const similar = catalogProducts.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 6);
  const installLabel =
    product.category === "purifiers" || product.category === "dispensers" ? "Free\ninstallation" : "Easy\nfitting";

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { height: width }]}>
          <Pressable onPress={openZoomAt} style={StyleSheet.absoluteFill}>
            <Image source={productImage(product)} style={[styles.hero, { height: width, backgroundColor: c.chip }]} resizeMode="cover" />
          </Pressable>
          <WishButton productId={product.id} size={40} iconSize={20} style={{ right: 14, top: 14 }} />
          <Pressable
            style={[styles.zoomInBtn, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => openZoom(2.5)}
            hitSlop={8}
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={22} color={c.ocean} />
          </Pressable>
          <Pressable style={[styles.zoomBadge, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => openZoom(2.5)}>
            <Ionicons name="search" size={14} color={c.text} />
            <Text style={[styles.zoomBadgeText, { color: c.text }]}>Tap spot to zoom</Text>
          </Pressable>
        </View>

        {zoomOpen ? (
          <ZoomViewer
            key={`${product.id}-${zoomStart}-${zoomOrigin.x}-${zoomOrigin.y}`}
            source={productImage(product)}
            title={product.name}
            initialScale={zoomStart}
            initialOrigin={zoomOrigin}
            onClose={() => setZoomOpen(false)}
          />
        ) : null}

        <View style={styles.body}>
          <Text style={[styles.brandLine, { color: c.ocean }]}>
            {product.brand} · {product.category?.replace("-", " ")}
          </Text>
          <Text style={[styles.name, { color: c.text }]}>{product.name}</Text>
          <View style={styles.ratingRow}>
            <View style={[styles.ratingPill, { backgroundColor: c.success }]}>
              <Text style={styles.ratingText}>{product.rating} ★</Text>
            </View>
            <Text style={[styles.reviews, { color: c.muted }]}>{(product.reviews || 0).toLocaleString("en-IN")} ratings</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: c.text }]}>{formatINR(product.price)}</Text>
            <Text style={[styles.mrp, { color: c.muted }]}>{formatINR(product.mrp)}</Text>
            {off > 0 && <Text style={[styles.off, { color: c.offer }]}>{off}% off</Text>}
          </View>
          <Text style={[styles.tax, { color: c.muted }]}>Inclusive of all taxes</Text>

          <View style={[styles.stockRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.stockLeft}>
              <Ionicons
                name={out ? "alert-circle-outline" : product.stock < 15 ? "alert-circle-outline" : "checkmark-circle-outline"}
                size={18}
                color={out ? c.danger : product.stock < 15 ? c.warning : c.success}
              />
              <Text
                style={[
                  styles.stockText,
                  { color: out ? c.danger : product.stock < 15 ? c.text : c.success },
                ]}
              >
                {out ? "Out of stock" : product.stock < 15 ? `Only ${product.stock} left` : "In stock"}
              </Text>
            </View>
            {!out && (
              <View style={[styles.stepper, { borderColor: c.border }]}>
                <Pressable style={styles.step} onPress={() => setQty((q) => Math.max(1, q - 1))}>
                  <Text style={[styles.stepText, { color: c.text }]}>−</Text>
                </Pressable>
                <Text style={[styles.qty, { color: c.text }]}>{qty}</Text>
                <Pressable style={styles.step} onPress={() => setQty((q) => Math.min(product.stock, q + 1))}>
                  <Text style={[styles.stepText, { color: c.text }]}>+</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.perks}>
            {[
              { icon: "car-outline", t: "Free delivery\nover ₹999" },
              { icon: "construct-outline", t: installLabel },
              { icon: "shield-checkmark-outline", t: "Genuine\nwarranty" },
            ].map((p) => (
              <View key={p.t} style={[styles.perk, { backgroundColor: c.secondary }]}>
                <Ionicons name={p.icon} size={18} color={c.oceanDeep} />
                <Text style={[styles.perkText, { color: c.oceanDeep }]}>{p.t}</Text>
              </View>
            ))}
          </View>

          {aiPosts.length ? (
            <>
              <Text style={[styles.section, { color: c.text }]}>AI campaign for this product</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                {aiPosts.map((post) => {
                  const uri = aiPostImageUri(post);
                  return (
                    <View
                      key={post.id}
                      style={{
                        width: width - 48,
                        maxWidth: 320,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: c.border,
                        backgroundColor: c.card,
                        overflow: "hidden",
                      }}
                    >
                      {uri ? (
                        <Image source={{ uri }} style={{ width: "100%", height: 160, backgroundColor: c.chip }} resizeMode="cover" />
                      ) : null}
                      <View style={{ padding: 12 }}>
                        <Text style={{ color: c.text, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
                          {post.caption}
                        </Text>
                        <Text style={{ color: c.ocean, fontSize: 11, marginTop: 8 }}>
                          {(post.hashtags || []).join(" ")}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.section, { color: c.text }]}>About this product</Text>
          <Text style={[styles.desc, { color: c.muted }]}>{product.description}</Text>

          <Text style={[styles.section, { color: c.text }]}>Specifications</Text>
          <View style={[styles.specs, { borderColor: c.border, backgroundColor: c.card }]}>
            {Object.entries(product.specs || {}).map(([k, v], i) => (
              <View key={k} style={[styles.spec, i % 2 === 0 && { backgroundColor: c.chip }]}>
                <Text style={[styles.specK, { color: c.muted }]}>{k}</Text>
                <Text style={[styles.specV, { color: c.text }]}>{String(v)}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.section, { color: c.text }]}>Warranty</Text>
          <View style={[styles.warranty, { backgroundColor: c.mist }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={c.ocean} />
            <Text style={[styles.warrantyText, { color: c.text }]}>{product.warranty}</Text>
          </View>

          {similar.length > 0 && (
            <>
              <Text style={[styles.section, { color: c.text }]}>Similar products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
                {similar.map((p) => (
                  <Pressable
                    key={p.id}
                    style={[styles.similarCard, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => navigation.push("Product", { id: p.id })}
                  >
                    <View>
                      <Image source={productImage(p)} style={[styles.similarImg, { backgroundColor: c.chip }]} />
                      <WishButton productId={p.id} size={28} iconSize={14} style={{ right: 6, top: 6 }} />
                    </View>
                    <Text numberOfLines={2} style={[styles.similarName, { color: c.text }]}>
                      {p.name}
                    </Text>
                    <Text style={[styles.similarPrice, { color: c.text }]}>{formatINR(p.price)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: c.card, borderTopColor: c.border }]}>
        <View style={styles.footerPrice}>
          <Text style={[styles.footerKicker, { color: c.muted }]}>Price</Text>
          <Text style={[styles.footerTotal, { color: c.text }]}>{formatINR(product.price * qty)}</Text>
        </View>
        <Pressable
          style={[styles.addBtn, { borderColor: c.ocean, backgroundColor: c.card }, (busy || out) && { opacity: 0.55 }]}
          onPress={() => add(false)}
          disabled={busy || out}
        >
          <Text style={[styles.addBtnText, { color: c.ocean }]}>Add to cart</Text>
        </Pressable>
        <Pressable
          style={[styles.buyBtn, { backgroundColor: c.ocean }, (busy || out) && { opacity: 0.55 }]}
          onPress={() => add(true)}
          disabled={busy || out}
        >
          <Text style={styles.buyBtnText}>{out ? "Sold out" : "Buy now"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F9FA" },
  scroll: { flex: 1 },
  heroWrap: { width: "100%", position: "relative" },
  hero: { width: "100%", backgroundColor: "#d9e6ec" },
  zoomInBtn: {
    position: "absolute",
    left: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  zoomBadge: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 3,
  },
  zoomBadgeText: { fontSize: 11, fontWeight: "700" },
  body: { padding: 16 },
  brandLine: { fontSize: 11, fontWeight: "700", color: "#1B7C98", textTransform: "uppercase" },
  name: { fontSize: 20, fontWeight: "700", color: "#173042", marginTop: 6, lineHeight: 26 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  ratingPill: { backgroundColor: "#2D6A4F", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  ratingText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  reviews: { color: colors.muted, fontSize: 12 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 12 },
  price: { fontSize: 24, fontWeight: "800", color: "#173042" },
  mrp: { fontSize: 14, color: colors.muted, textDecorationLine: "line-through" },
  off: { fontSize: 14, fontWeight: "700", color: "#E36A1E" },
  tax: { fontSize: 11, color: colors.muted, marginTop: 2 },
  stockRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E6EEF1",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
  },
  stockLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  stockText: { fontWeight: "700", fontSize: 13 },
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
  qty: { minWidth: 22, textAlign: "center", fontWeight: "700", color: "#173042" },
  perks: { flexDirection: "row", gap: 8, marginTop: 14 },
  perk: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E7F3F7",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  perkText: { fontSize: 11, fontWeight: "600", color: "#1A4E63", textAlign: "center", lineHeight: 14 },
  section: { marginTop: 20, marginBottom: 8, fontSize: 15, fontWeight: "700", color: "#173042" },
  desc: { color: colors.muted, lineHeight: 21, fontSize: 14 },
  specs: { borderRadius: 14, borderWidth: 1, borderColor: "#E6EEF1", overflow: "hidden", backgroundColor: "#fff" },
  spec: { flexDirection: "row", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  specAlt: { backgroundColor: "#F3F6F8" },
  specK: { width: "40%", color: colors.muted, fontSize: 13 },
  specV: { flex: 1, fontWeight: "600", color: "#173042", fontSize: 13 },
  warranty: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: "#EAF6F8",
    borderRadius: 14,
    padding: 12,
  },
  warrantyText: { flex: 1, color: "#173042", fontSize: 13, lineHeight: 19 },
  similarRow: { gap: 12, paddingBottom: 8 },
  similarCard: {
    width: 148,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    overflow: "hidden",
  },
  similarImg: { width: 148, height: 120, backgroundColor: "#F3F6F8" },
  similarName: { marginHorizontal: 8, marginTop: 8, minHeight: 34, fontSize: 12, fontWeight: "700", color: "#173042" },
  similarPrice: { marginHorizontal: 8, marginBottom: 10, marginTop: 4, fontWeight: "800", color: "#173042" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E6EEF1",
  },
  footerPrice: { minWidth: 72 },
  footerKicker: { fontSize: 11, color: colors.muted },
  footerTotal: { fontSize: 16, fontWeight: "800", color: "#173042" },
  addBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1B7C98",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  addBtnText: { color: "#1B7C98", fontWeight: "700", fontSize: 13 },
  buyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B7C98",
  },
  buyBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
