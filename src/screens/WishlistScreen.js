import { useCallback } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../AuthContext";
import { getProduct } from "../catalog";
import { productImage } from "../images";
import { discountPct, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import WishButton from "../ui/WishButton";

export default function WishlistScreen({ navigation }) {
  const { c } = useTheme();
  const { user, refresh } = useAuth();
  const { width } = useWindowDimensions();
  const gap = 12;
  const cardW = Math.floor((width - 32 - gap) / 2);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, []),
  );

  const items = (user?.wishlist || []).map((id) => getProduct(id)).filter(Boolean);

  if (!items.length) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
          <Ionicons name="heart-outline" size={32} color={c.ocean} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>No saved items yet</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>Tap the heart on any product to save it here.</Text>
        <Pressable style={[styles.btn, { backgroundColor: c.ocean }]} onPress={() => navigation.getParent()?.navigate("ShopTab")}>
          <Text style={styles.btnText}>Browse products</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {items.map((item, index) => {
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
              onPress={() => navigation.getParent()?.navigate("ShopTab", { screen: "Product", params: { id: item.id } })}
            >
              <View style={{ height: cardW, backgroundColor: c.chip }}>
                <Image source={productImage(item)} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                {off > 0 && (
                  <View style={[styles.off, { backgroundColor: c.offer }]}>
                    <Text style={styles.offText}>{off}% OFF</Text>
                  </View>
                )}
                <WishButton productId={item.id} />
              </View>
              <Text style={[styles.brand, { color: c.muted }]}>{item.brand}</Text>
              <Text numberOfLines={2} style={[styles.name, { color: c.text }]}>
                {item.name}
              </Text>
              <Text style={{ marginHorizontal: 8, marginTop: 2, color: c.warning, fontWeight: "700", fontSize: 11 }}>★ {item.rating}</Text>
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: c.text }]}>{formatINR(item.price)}</Text>
                <Text style={[styles.mrp, { color: c.muted }]}>{formatINR(item.mrp)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  prompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  emptyBody: { marginTop: 6, textAlign: "center", fontSize: 14 },
  btn: { marginTop: 20, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden", marginBottom: 12 },
  off: { position: "absolute", left: 8, top: 8, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  offText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  brand: { marginTop: 8, marginHorizontal: 8, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  name: { marginHorizontal: 8, marginTop: 2, fontSize: 13, fontWeight: "700", minHeight: 34 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginHorizontal: 8, marginTop: 4, marginBottom: 10 },
  price: { fontWeight: "800", fontSize: 14 },
  mrp: { fontSize: 11, textDecorationLine: "line-through" },
});
