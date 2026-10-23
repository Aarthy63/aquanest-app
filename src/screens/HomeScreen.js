import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { aiPostImageUri } from "../aiPosts";
import { categories as localCategories, products as localProducts } from "../catalog";
import { banner, categoryImages, productImage } from "../images";
import { discountPct, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import { useAuth } from "../AuthContext";
import { useNotifications } from "../NotificationCenter";
import { nativeDriver } from "../nativeAnim";
import AnimatedBackground, { LightSweep } from "../ui/AnimatedBackground";
import { CrossFade, Rise } from "../ui/Motion";
import WishButton from "../ui/WishButton";

const slides = [
  { kicker: "MONSOON SALE", title: "Up to 35% off\nRO purifiers", cta: "Shop purifiers", category: "purifiers" },
  { kicker: "FREE INSTALLATION", title: "Book a technician\nin 60 seconds", cta: "Book service", category: null },
  { kicker: "FILTER CARE", title: "Annual filter kits\nfrom ₹1,899", cta: "Shop filters", category: "filters" },
];

function ProductCard({ product, navigation, style, c }) {
  const off = discountPct(product);
  return (
    <Pressable style={[styles.card, { backgroundColor: c.card, borderColor: c.border }, style]} onPress={() => navigation.navigate("Product", { id: product.id })}>
      <View style={[styles.cardImgWrap, { backgroundColor: c.chip }]}>
        <Image source={productImage(product)} style={styles.cardImg} />
        {off > 0 && (
          <View style={[styles.off, { backgroundColor: c.offer }]}>
            <Text style={styles.offText}>{off}% OFF</Text>
          </View>
        )}
        <WishButton productId={product.id} />
      </View>
      <Text style={[styles.brand, { color: c.muted }]}>{product.brand}</Text>
      <Text numberOfLines={2} style={[styles.cardName, { color: c.text }]}>
        {product.name}
      </Text>
      <Text style={[styles.rating, { color: c.gold }]}>★ {product.rating}</Text>
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: c.text }]}>{formatINR(product.price)}</Text>
        <Text style={[styles.mrp, { color: c.muted }]}>{formatINR(product.mrp)}</Text>
      </View>
    </Pressable>
  );
}

const FALLBACK_IDS = ["wp-001", "wp-003", "wp-004", "wp-007", "wp-015", "wp-017", "wp-023", "wp-039"];
const FALLBACK_PRODUCTS = FALLBACK_IDS.map((id) => localProducts.find((p) => p.id === id)).filter(Boolean);

const HOME_CATEGORIES = [
  { id: "purifiers", short: "Purifiers" },
  { id: "dispensers", short: "Dispensers" },
  { id: "pumps", short: "Pumps" },
  { id: "filters", short: "Filters" },
  { id: "membranes", short: "Membranes" },
  { id: "spare-parts", short: "Spares" },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c, dark } = useTheme();
  const pad = 16;
  const gap = 12;
  const catW = Math.floor((width - pad * 2 - gap * 2) / 3);
  const offerW = Math.floor((width - pad * 2 - gap) / 2);
  const bannerH = 176;
  const { user } = useAuth();
  const { unread, refresh: refreshNotifications } = useNotifications();
  const [categories, setCategories] = useState(localCategories);
  const [products, setProducts] = useState(localProducts);
  const [aiPosts, setAiPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const shimmer = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef(slides.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Promise.all([
      api("/api/categories", { auth: false }),
      api("/api/products", { auth: false }),
      api("/api/ai-posts?limit=12", { auth: false }).catch(() => []),
    ])
      .then(([cats, list, posts]) => {
        setCategories(cats);
        setProducts(list);
        setAiPosts(Array.isArray(posts) ? posts : []);
      })
      .catch(() => {
        setCategories(HOME_CATEGORIES);
        setProducts(FALLBACK_PRODUCTS);
      });
    if (user) refreshNotifications();
  }, [user, refreshNotifications]);

  function openNotifications() {
    if (!user) {
      navigation.navigate("Login");
      return;
    }
    navigation.navigate("Notifications");
  }

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % slides.length), 4500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Soft icon pulse only in dark mode — light mode stays still
    if (!dark) {
      shimmer.setValue(0.7);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
        Animated.timing(shimmer, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dark, shimmer]);

  useEffect(() => {
    slides.forEach((_, i) => {
      Animated.timing(dotAnims[i], {
        toValue: i === slide ? 1 : 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [slide, dotAnims]);

  const catalog = products.length ? products : FALLBACK_PRODUCTS;
  const featured = catalog.filter((p) => p.featured);
  const featuredList = featured.length ? featured : catalog.slice(0, 6);
  const offers = [...catalog].sort((a, b) => discountPct(b) - discountPct(a)).slice(0, 6);
  const current = slides[slide];
  const goldGlow = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] });

  function openSlide() {
    if (current.category) navigation.navigate("Shop", { category: current.category });
    else navigation.getParent()?.navigate("Service");
  }

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <AnimatedBackground intensity={1} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }} style={{ backgroundColor: "transparent" }}>
        <Rise delay={0} distance={10}>
          <LinearGradient colors={c.oceanGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 8, overflow: "hidden" }]}>
            <LightSweep />
            <View style={styles.headerRow}>
              <View>
                <View style={styles.deliverRow}>
                  <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.kicker}> Deliver to {user ? user.name.split(" ")[0] : "you"}</Text>
                </View>
                <View style={styles.brandRow}>
                  <Animated.View style={{ opacity: dark ? goldGlow : 1 }}>
                    <Ionicons name="water" size={20} color={dark ? c.gold : "#fff"} />
                  </Animated.View>
                  <Text style={styles.logo}> AquaNest</Text>
                </View>
              </View>
              <Pressable
                style={[styles.bell, { borderColor: dark ? "rgba(212,175,55,0.35)" : "rgba(255,255,255,0.25)" }]}
                onPress={openNotifications}
                hitSlop={8}
              >
                <Ionicons name={unread > 0 ? "notifications" : "notifications-outline"} size={20} color="#fff" />
                {unread > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
                  </View>
                ) : null}
              </Pressable>
            </View>
            <View style={[styles.search, { backgroundColor: c.card, borderColor: dark ? c.border : "transparent" }]}>
              <Ionicons name="search" size={16} color={c.muted} />
              <TextInput
                placeholder="Search purifiers, filters, pumps…"
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => navigation.navigate("Shop", { q: query })}
                style={[styles.searchInput, { color: c.text }]}
                returnKeyType="search"
              />
            </View>
          </LinearGradient>
        </Rise>

        <Rise delay={80} distance={18}>
          <View style={[styles.bannerWrap, { height: bannerH, borderColor: dark ? "rgba(212,175,55,0.28)" : "rgba(15,63,86,0.12)" }]}>
            <ImageBackground source={banner} style={styles.bannerBg} imageStyle={styles.bannerImg} resizeMode="cover">
              <LinearGradient
                colors={["rgba(11,40,58,0.88)", "rgba(11,40,58,0.42)", "transparent"]}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LightSweep />
              <CrossFade signal={slide} style={styles.bannerContent}>
                <View style={[styles.kickerPill, { backgroundColor: c.offer }]}>
                  <Text style={styles.kickerPillText}>{current.kicker}</Text>
                </View>
                <Text style={styles.bannerTitle}>{current.title}</Text>
                <Pressable style={[styles.cta, { backgroundColor: c.secondary, borderColor: c.gold }]} onPress={openSlide} hitSlop={6}>
                  <Text style={[styles.ctaText, { color: c.oceanDeep }]}>{current.cta}</Text>
                </Pressable>
              </CrossFade>
              <View style={styles.dots}>
                {slides.map((_, i) => {
                  const w = dotAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 18] });
                  const bg = dotAnims[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: ["rgba(255,255,255,0.45)", dark ? c.gold : "#FFFFFF"],
                  });
                  return (
                    <Pressable key={i} onPress={() => setSlide(i)} hitSlop={8}>
                      <Animated.View style={[styles.dot, { width: w, backgroundColor: bg }]} />
                    </Pressable>
                  );
                })}
              </View>
            </ImageBackground>
          </View>
        </Rise>

        <Rise delay={160}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {[
              { icon: "truck-outline", lib: "mci", t: " Free delivery ₹999+" },
              { icon: "construct-outline", lib: "ion", t: " Free installation" },
              { icon: "shield-checkmark-outline", lib: "ion", t: " Genuine warranty" },
            ].map((item) => (
              <View key={item.t} style={[styles.chip, { backgroundColor: c.secondary, borderColor: dark ? c.border : c.border }]}>
                {item.lib === "mci" ? (
                  <MaterialCommunityIcons name={item.icon} size={14} color={c.oceanDeep} />
                ) : (
                  <Ionicons name={item.icon} size={14} color={c.oceanDeep} />
                )}
                <Text style={[styles.chipText, { color: c.oceanDeep }]}>{item.t}</Text>
              </View>
            ))}
          </ScrollView>
        </Rise>

        <Rise delay={220}>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: c.text }]}>Shop by category</Text>
            <Pressable onPress={() => navigation.navigate("Shop", {})}>
              <Text style={[styles.link, { color: c.ocean }]}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.catGrid, { gap }]}>
            {(categories.length ? categories : HOME_CATEGORIES).map((cat, index) => (
              <Rise key={cat.id} delay={240 + index * 40} distance={12} style={{ width: catW }}>
                <Pressable style={{ alignItems: "center" }} onPress={() => navigation.navigate("Shop", { category: cat.id })}>
                  <View style={[styles.catFrame, { borderColor: dark ? "rgba(212,175,55,0.22)" : "rgba(15,63,86,0.08)" }]}>
                    <Image
                      source={categoryImages[cat.id] || categoryImages.purifiers}
                      style={{ width: catW - 6, height: catW - 6, borderRadius: 16, backgroundColor: c.chip }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={[styles.catName, { color: c.text }]}>{cat.short || cat.name}</Text>
                </Pressable>
              </Rise>
            ))}
          </View>
        </Rise>

        {aiPosts.length ? (
          <Rise delay={300}>
            <View style={styles.sectionHead}>
              <Text style={[styles.section, { color: c.text }]}>AI product highlights</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {aiPosts.map((post) => {
                const uri = aiPostImageUri(post);
                return (
                  <Pressable
                    key={post.id}
                    style={[styles.aiCard, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => {
                      if (post.product?.id) navigation.navigate("Product", { id: post.product.id });
                    }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={[styles.aiImg, { backgroundColor: c.chip }]} />
                    ) : (
                      <View style={[styles.aiImg, { backgroundColor: c.chip }]} />
                    )}
                    <Text style={[styles.brand, { color: c.ocean }]} numberOfLines={1}>
                      {post.product?.name || "AquaNest"}
                    </Text>
                    <Text numberOfLines={2} style={[styles.cardName, { color: c.text, minHeight: 36 }]}>
                      {post.caption?.split("\n").find((l) => l.trim()) || "Today’s pick"}
                    </Text>
                    <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
                      {(post.hashtags || []).slice(0, 3).join(" ")}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Rise>
        ) : null}

        <Rise delay={320}>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: c.text }]}>Featured purifiers</Text>
            <Pressable onPress={() => navigation.navigate("Shop", { category: "purifiers" })}>
              <Text style={[styles.link, { color: c.ocean }]}>View all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow} style={{ minHeight: 250 }}>
            {featuredList.map((p) => (
              <ProductCard key={p.id} product={p} navigation={navigation} style={{ width: 168 }} c={c} />
            ))}
          </ScrollView>
        </Rise>

        <Rise delay={380}>
          <Pressable style={[styles.service, { backgroundColor: c.mist, borderColor: c.border }]} onPress={() => navigation.getParent()?.navigate("Service")}>
            <View style={[styles.serviceIcon, { backgroundColor: c.ocean }]}>
              <Ionicons name="construct" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceTitle, { color: c.text }]}>Book a service visit</Text>
              <Text style={[styles.serviceSub, { color: c.muted }]}>Installation, repair, maintenance & filter change</Text>
            </View>
            <Text style={[styles.link, { color: c.ocean }]}>Book →</Text>
          </Pressable>
        </Rise>

        <Rise delay={420}>
          <View style={styles.sectionHead}>
            <Text style={[styles.section, { color: c.text }]}>Top offers</Text>
          </View>
          <View style={styles.offerGrid}>
            {offers.map((p) => (
              <ProductCard key={p.id} product={p} navigation={navigation} style={{ width: offerW }} c={c} />
            ))}
          </View>
        </Rise>

        <Rise delay={460}>
          <LinearGradient colors={c.oceanGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.dealer, { borderColor: "rgba(212,175,55,0.35)" }]}>
            <Ionicons name="storefront-outline" size={24} color={c.gold} />
            <Text style={styles.dealerTitle}>Are you a dealer?</Text>
            <Text style={styles.dealerSub}>Get wholesale prices and bulk ordering for your shop.</Text>
            <Pressable style={[styles.cta, { backgroundColor: "rgba(255,255,255,0.95)", marginTop: 14 }]} onPress={() => navigation.getParent()?.navigate("Profile")}>
              <Text style={[styles.ctaText, { color: c.oceanDeep }]}>Apply as dealer</Text>
            </Pressable>
          </LinearGradient>
        </Rise>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F7F9FA" },
  header: { paddingHorizontal: 16, paddingBottom: 18 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  deliverRow: { flexDirection: "row", alignItems: "center" },
  kicker: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  logo: { color: "#fff", fontSize: 22, fontWeight: "700", letterSpacing: 0.3 },
  bellBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E8B923",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  bellBadgeText: { color: "#173042", fontSize: 10, fontWeight: "800" },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    position: "relative",
  },
  search: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    shadowColor: "#0B3A4F",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  searchInput: { flex: 1, height: 44, fontSize: 14 },
  bannerWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 176,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0B2838",
    borderWidth: 1,
    shadowColor: "#0B3A4F",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 4,
  },
  bannerBg: { flex: 1, width: "100%", height: "100%" },
  bannerImg: { borderRadius: 18 },
  bannerContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingRight: 64,
  },
  kickerPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
  },
  kickerPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  cta: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  ctaText: { fontWeight: "700", fontSize: 13 },
  dots: { position: "absolute", right: 14, bottom: 12, flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  chips: { paddingHorizontal: 16, gap: 8, paddingTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F3F7",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "700", color: "#24566A" },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 18, marginBottom: 10 },
  section: { fontSize: 16, fontWeight: "700", color: "#173042" },
  link: { color: "#1B7C98", fontSize: 12, fontWeight: "700" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, justifyContent: "space-between" },
  catFrame: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  catName: { marginTop: 6, fontSize: 12, fontWeight: "700", color: "#173042" },
  hRow: { paddingHorizontal: 16, gap: 12 },
  aiCard: {
    width: 200,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    paddingBottom: 10,
  },
  aiImg: { width: "100%", height: 120, resizeMode: "cover" },
  offerGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, justifyContent: "space-between" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#0B3A4F",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardImgWrap: { height: 140, width: "100%", backgroundColor: "#F3F6F8" },
  cardImg: { width: "100%", height: "100%", resizeMode: "cover" },
  off: { position: "absolute", left: 8, top: 8, backgroundColor: "#E36A1E", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  offText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  brand: { marginTop: 8, marginHorizontal: 8, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  cardName: { marginHorizontal: 8, marginTop: 2, fontSize: 13, fontWeight: "700", minHeight: 34 },
  rating: { marginHorizontal: 8, marginTop: 2, fontSize: 11, fontWeight: "700" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginHorizontal: 8, marginTop: 4, marginBottom: 10 },
  price: { fontWeight: "800", fontSize: 14 },
  mrp: { fontSize: 11, textDecorationLine: "line-through" },
  service: { marginHorizontal: 16, marginTop: 8, flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1 },
  serviceIcon: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serviceTitle: { fontWeight: "700" },
  serviceSub: { fontSize: 12, marginTop: 2 },
  dealer: { margin: 16, borderRadius: 18, padding: 18, borderWidth: 1 },
  dealerTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 8 },
  dealerSub: { color: "rgba(255,255,255,0.9)", marginTop: 6, fontSize: 13 },
});
