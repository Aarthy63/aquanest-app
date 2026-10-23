import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { useTheme } from "../ThemeContext";
import { useFeedback } from "../ui/Feedback";

const EMPTY = { name: "", phone: "", line1: "", line2: "", city: "", state: "", pincode: "", label: "Home" };

export default function AddressesScreen() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const feedback = useFeedback();
  const [addresses, setAddresses] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const load = useCallback(() => {
    api("/api/addresses")
      .then(setAddresses)
      .catch((e) => feedback.error("Addresses", { description: e.message }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openNew() {
    setForm(EMPTY);
    setEditing({});
  }

  function openEdit(a) {
    setForm({
      name: a.name || "",
      phone: a.phone || "",
      line1: a.line1 || "",
      line2: a.line2 || "",
      city: a.city || "",
      state: a.state || "",
      pincode: a.pincode || "",
      label: a.label || "Home",
    });
    setEditing(a);
  }

  async function save() {
    try {
      const list = await api("/api/addresses", { method: "POST", body: { ...form, label: form.label || "Home" } });
      setAddresses(list);
      setEditing(null);
      feedback.success("Address saved");
    } catch (e) {
      feedback.error("Address", { description: e.message });
    }
  }

  function remove(a) {
    feedback.confirm({
      title: "Delete address?",
      message: "This address will be removed from your account.",
      confirmText: "Delete",
      cancelText: "Keep",
      destructive: true,
      onConfirm: () =>
        api(`/api/addresses/${a.id}`, { method: "DELETE" })
          .then((list) => {
            setAddresses(list);
            feedback.info("Address deleted");
          })
          .catch((e) => feedback.error("Address", { description: e.message })),
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {addresses.length === 0 ? (
          <View style={styles.prompt}>
            <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
              <Ionicons name="location-outline" size={32} color={c.ocean} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No saved addresses</Text>
            <Text style={[styles.emptyBody, { color: c.muted }]}>Add an address for faster checkout and service booking.</Text>
          </View>
        ) : (
          addresses.map((a) => (
            <View key={a.id} style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Ionicons name="location-outline" size={18} color={c.ocean} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Text style={{ fontWeight: "700", color: c.text }}>{a.name}</Text>
                    <View style={[styles.pill, { backgroundColor: c.secondary }]}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: c.oceanDeep }}>{(a.label || "Home").toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={{ marginTop: 4, color: c.muted, fontSize: 13, lineHeight: 18 }}>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} – {a.pincode}
                  </Text>
                  {!!a.phone && <Text style={{ marginTop: 2, color: c.muted, fontSize: 13 }}>{a.phone}</Text>}
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <Pressable style={styles.ghost} onPress={() => openEdit(a)}>
                  <Ionicons name="pencil-outline" size={14} color={c.ocean} />
                  <Text style={{ color: c.ocean, fontWeight: "700", fontSize: 13 }}>Edit</Text>
                </Pressable>
                <Pressable style={styles.ghost} onPress={() => remove(a)}>
                  <Ionicons name="trash-outline" size={14} color={c.danger} />
                  <Text style={{ color: c.danger, fontWeight: "700", fontSize: 13 }}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={[styles.addBtn, { borderColor: c.border, backgroundColor: c.card }]}
          onPress={openNew}
        >
          <Ionicons name="add" size={18} color={c.ocean} />
          <Text style={{ color: c.ocean, fontWeight: "700" }}>Add new address</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.card, paddingBottom: Math.max(insets.bottom, 16) }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: c.text }}>{editing?.id ? "Edit address" : "New address"}</Text>
              <Pressable onPress={() => setEditing(null)}>
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
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: c.input,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  minHeight: 46,
                  paddingHorizontal: 12,
                  marginBottom: 8,
                  color: c.text,
                }}
              />
            ))}
            <Pressable style={{ backgroundColor: c.ocean, borderRadius: 24, height: 48, alignItems: "center", justifyContent: "center", marginTop: 4 }} onPress={save}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Save address</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 16 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyBody: { marginTop: 6, textAlign: "center", fontSize: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  pill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ghost: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6 },
  addBtn: {
    marginTop: 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 16,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(18,38,58,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 14, maxHeight: "88%" },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
});
