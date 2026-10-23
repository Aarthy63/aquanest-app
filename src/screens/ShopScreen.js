import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { brands, queryCatalog } from "../catalog";
import { productImage } from "../images";
import { colors, discountPct, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import AnimatedBackground from "../ui/AnimatedBackground";
import WishButton from "../ui/WishButton";

const CATEGORIES = [
  { id: "purifiers", short: "Purifiers" },
  { id: "dispensers", short: "Dispensers" },
  { id: "pumps", short: "Pumps" },
  { id: "filters", short: "Filters" },
  { id: "membranes", short: "Membranes" },
  { id: "spare-parts", short: "Spares" },
];

const SORTS = [
  { id: "popular", label: "Popular" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Top rated" },
  { id: "newest", label: "Newest" },
];

const PAGE_SIZE = 10;

function Chip({ active, label, onPress, c }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: c.border, backgroundColor: c.card },
        active && { backgroundColor: c.ocean, borderColor: c.ocean },
      ]}
    >
      <Text style={[styles.chipText, { color: c.text }, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export default function ShopScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const gap = 12;
  const cardW = Math.floor((width - 32 - gap) / 2);
  const [text, setText] = useState(route.params?.q ?? "");
  const [q, setQ] = useState(route.params?.q ?? "");
  const [category, setCategory] = useState(route.params?.category);
  const [sort, setSort] = useState("popular");
  const [brand, setBrand] = useState();
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const items = useMemo(
    () => queryCatalog({ q, category, sort, brand, inStock }),
    [q, category, sort, brand, inStock],
  );
  const visible = items.slice(0, page * PAGE_SIZE);
  const sortLabel = SORTS.find((s) => s.id === sort)?.label ?? "Popular";
  const activeFilters = (brand ? 1 : 0) + (inStock ? 1 : 0);

  useEffect(() => {
    const nextQ = route.params?.q ?? "";
    setText(nextQ);
    setQ(nextQ);
    setCategory(route.params?.category);
    setPage(1);
  }, [route.params?.q, route.params?.category]);

  function applySearch() {
    setPage(1);
    setQ(text.trim());
  }

  function clearAll() {
    setText("");
    setQ("");
    setCategory(undefined);
    setBrand(undefined);
    setInStock(false);
    setSort("popular");
    setPage(1);
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <AnimatedBackground intensity={0.85} />
      <View style={[styles.header, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        <View style={styles.searchRow}>
          <View style={[styles.search, { borderColor: c.border, backgroundColor: c.input }]}>
            <Ionicons name="search" size={16} color={c.muted} />
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={applySearch}
              placeholder="Search products"
              placeholderTextColor={c.muted}
              style={[styles.searchInput, { color: c.text }]}
              returnKeyType="search"
            />
            {!!text && (
              <Pressable
                onPress={() => {
                  setText("");
                  setQ("");
                  setPage(1);
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={16} color={c.muted} />
              </Pressable>
            )}
          </View>
          <Pressable style={[styles.filterBtn, { borderColor: c.border, backgroundColor: c.card }]} onPress={() => setFiltersOpen(true)}>
            <Ionicons name="options-outline" size={18} color={c.text} />
            {activeFilters > 0 && (
              <View style={[styles.badge, { backgroundColor: c.ocean }]}>
                <Text style={styles.badgeText}>{activeFilters}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
          <Chip
            c={c}
            label="All"
            active={!category}
            onPress={() => {
              setCategory(undefined);
              setPage(1);
            }}
          />
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              c={c}
              label={cat.short}
              active={category === cat.id}
              onPress={() => {
                setCategory(cat.id);
                setPage(1);
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.count, { color: c.muted }]}>{items.length} products</Text>
        <Pressable style={[styles.sortBtn, { borderColor: c.border, backgroundColor: c.card }]} onPress={() => setSortOpen(true)}>
          <Text style={[styles.sortText, { color: c.text }]}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={c.text} />
        </Pressable>
      </View>

      <ScrollView style={[styles.list, { backgroundColor: "transparent" }]} contentContainerStyle={styles.gridWrap} showsVerticalScrollIndicator={false}>
        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="search" size={28} color={c.muted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>No products found</Text>
            <Text style={[styles.empty, { color: c.muted }]}>Try a different search or clear your filters.</Text>
            <Pressable style={[styles.load, { borderColor: c.ocean }]} onPress={clearAll}>
              <Text style={[styles.loadText, { color: c.ocean }]}>Clear all</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.grid}>
          {visible.map((item, index) => {
            const off = discountPct(item);
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.card,
                  {
                    width: cardW,
                    marginRight: index % 2 === 0 ? gap : 0,
                    backgroundColor: c.card,
                    borderColor: c.border,
                  },
                ]}
                onPress={() => navigation.navigate("Product", { id: item.id })}
              >
                <View style={[styles.imgWrap, { height: cardW, backgroundColor: c.chip }]}>
                  <Image source={productImage(item)} style={styles.img} resizeMode="cover" />
                  {off > 0 && (
                    <View style={[styles.off, { backgroundColor: c.offer }]}>
                      <Text style={styles.offText}>{off}% OFF</Text>
                    </View>
                  )}
                  <WishButton productId={item.id} />
                  {item.stock <= 0 && (
                    <View style={styles.oos}>
                      <Text style={styles.oosText}>Out of stock</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.brand, { color: c.muted }]}>{item.brand}</Text>
                <Text numberOfLines={2} style={[styles.name, { color: c.text }]}>
                  {item.name}
                </Text>
                <Text style={[styles.rating, { color: c.warning }]}>
                  ★ {item.rating} <Text style={[styles.reviews, { color: c.muted }]}>({item.reviews})</Text>
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: c.text }]}>{formatINR(item.price)}</Text>
                  <Text style={[styles.mrp, { color: c.muted }]}>{formatINR(item.mrp)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {visible.length > 0 && (
          <View style={styles.more}>
            <Text style={[styles.count, { color: c.muted }]}>
              Showing {visible.length} of {items.length}
            </Text>
            {visible.length < items.length && (
              <Pressable style={[styles.load, { borderColor: c.ocean }]} onPress={() => setPage((p) => p + 1)}>
                <Text style={[styles.loadText, { color: c.ocean }]}>Load more</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: c.sheet }]}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Sort products</Text>
            {SORTS.map((s) => (
              <Pressable
                key={s.id}
                style={[styles.sortRow, { borderBottomColor: c.border }]}
                onPress={() => {
                  setSort(s.id);
                  setPage(1);
                  setSortOpen(false);
                }}
              >
                <Text style={[styles.sortText, { color: c.text }, sort === s.id && { color: c.ocean }]}>{s.label}</Text>
                {sort === s.id && <Ionicons name="checkmark" size={16} color={c.ocean} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFiltersOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.sheet }]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: c.text }]}>Filters</Text>
            <Text style={[styles.filterLabel, { color: c.text }]}>Brand</Text>
            <View style={styles.brandWrap}>
              <Chip
                c={c}
                label="Any"
                active={!brand}
                onPress={() => {
                  setBrand(undefined);
                  setPage(1);
                }}
              />
              {brands.map((b) => (
                <Chip
                  key={b}
                  c={c}
                  label={b}
                  active={brand === b}
                  onPress={() => {
                    setBrand(b);
                    setPage(1);
                  }}
                />
              ))}
            </View>
            <View style={styles.stockRow}>
              <Text style={[styles.filterLabel, { color: c.text }]}>In stock only</Text>
              <Switch
                value={inStock}
                onValueChange={(v) => {
                  setInStock(v);
                  setPage(1);
                }}
                trackColor={{ true: c.ocean }}
              />
            </View>
            <View style={styles.filterActions}>
              <Pressable
                style={[styles.load, { flex: 1, alignItems: "center", borderColor: c.ocean }]}
                onPress={() => {
                  setBrand(undefined);
                  setInStock(false);
                  setPage(1);
                }}
              >
                <Text style={[styles.loadText, { color: c.ocean }]}>Reset</Text>
              </Pressable>
              <Pressable style={[styles.showBtn, { flex: 1, backgroundColor: c.ocean }]} onPress={() => setFiltersOpen(false)}>
                <Text style={styles.showBtnText}>Show {items.length} results</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7F9FA" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF1",
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8EC",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, height: 44, color: colors.text, fontSize: 14 },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8EC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1B7C98",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  chipScroll: { height: 46, marginTop: 10 },
  chips: { alignItems: "center", gap: 8, paddingRight: 8 },
  chip: { borderRadius: 20, borderWidth: 1, borderColor: "#E2E8EC", paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff" },
  chipOn: { backgroundColor: "#1B7C98", borderColor: "#1B7C98" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#173042" },
  chipTextOn: { color: "#fff" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8 },
  count: { fontSize: 12, color: colors.muted },
  sortBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "#E2E8EC",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortText: { fontSize: 12, fontWeight: "700", color: colors.text },
  list: { flex: 1 },
  gridWrap: { paddingHorizontal: 16, paddingBottom: 28 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E6EEF1", overflow: "hidden", marginBottom: 12 },
  imgWrap: { backgroundColor: "#F3F6F8" },
  img: { width: "100%", height: "100%" },
  off: { position: "absolute", left: 8, top: 8, backgroundColor: "#E36A1E", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  offText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  oos: { position: "absolute", left: 8, right: 8, bottom: 8, backgroundColor: "rgba(18,38,58,0.8)", borderRadius: 8, paddingVertical: 4 },
  oosText: { color: "#fff", textAlign: "center", fontSize: 11, fontWeight: "700" },
  brand: { marginTop: 8, marginHorizontal: 8, fontSize: 10, fontWeight: "700", color: colors.muted, textTransform: "uppercase" },
  name: { marginHorizontal: 8, marginTop: 2, fontSize: 13, fontWeight: "700", color: "#173042", minHeight: 34 },
  rating: { marginHorizontal: 8, marginTop: 2, fontSize: 11, color: "#C99212", fontWeight: "700" },
  reviews: { color: colors.muted, fontWeight: "600" },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginHorizontal: 8, marginTop: 4, marginBottom: 10 },
  price: { fontWeight: "800", color: "#173042", fontSize: 14 },
  mrp: { fontSize: 11, color: colors.muted, textDecorationLine: "line-through" },
  emptyBox: { alignItems: "center", marginTop: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#173042" },
  empty: { textAlign: "center", color: colors.muted, marginBottom: 8 },
  more: { alignItems: "center", marginTop: 4, gap: 8 },
  load: { borderWidth: 1, borderColor: "#1B7C98", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  loadText: { color: "#1B7C98", fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxHeight: "80%" },
  sheetTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8, color: "#173042" },
  sortRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F3F5" },
  filterLabel: { fontSize: 14, fontWeight: "700", color: "#173042", marginTop: 8, marginBottom: 8 },
  brandWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stockRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  filterActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  showBtn: { backgroundColor: "#1B7C98", borderRadius: 20, alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  showBtnText: { color: "#fff", fontWeight: "700" },
});
