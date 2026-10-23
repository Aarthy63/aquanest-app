import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CommonActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext";
import { useTheme } from "../ThemeContext";
import { useFeedback } from "../ui/Feedback";
import { Rise } from "../ui/Motion";

function Field({ label, error, c, style, ...props }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: c.input,
            borderColor: error ? c.danger : c.border,
            color: c.text,
          },
        ]}
        placeholderTextColor={c.muted}
        underlineColorAndroid="transparent"
        {...props}
      />
      {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

function PasswordField({ label, error, c, value, onChangeText, show, onToggle }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View
        style={[
          styles.passwordWrap,
          {
            backgroundColor: c.input,
            borderColor: error ? c.danger : c.border,
          },
        ]}
      >
        <TextInput
          style={[styles.passwordInput, { color: c.text }]}
          secureTextEntry={!show}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={c.muted}
          underlineColorAndroid="transparent"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onToggle} hitSlop={8} style={styles.eyeBtn}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color={c.muted} />
        </Pressable>
      </View>
      {!!error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

function FormSheet({ c, children, topPad = 20 }) {
  return (
    <ScrollView
      style={[styles.sheet, { backgroundColor: c.card }]}
      contentContainerStyle={[styles.sheetContent, { paddingTop: topPad, paddingBottom: 40 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/** After login/register with YOUR account — always open Home (never stuck on demo/Account). */
function navigateToHome(navigation) {
  let root = navigation;
  while (root?.getParent?.()) root = root.getParent();

  root.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [
        {
          name: "Main",
          state: {
            index: 0,
            routes: [{ name: "Home" }],
          },
        },
      ],
    }),
  );
}

export function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { login } = useAuth();
  const feedback = useFeedback();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  async function onSubmit() {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email";
    if (password.length < 6) next.password = "Password must be at least 6 characters";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const signedInEmail = email.trim().toLowerCase();
      await login(signedInEmail, password);
      feedback.success("Welcome back!", {
        description: `Signed in as ${signedInEmail}`,
        duration: 2800,
      });
      navigateToHome(navigation);
    } catch (e) {
      feedback.error("Sign in failed", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  function fillDemo() {
    setEmail("demo@aquanest.in");
    setPassword("password123");
  }

  return (
    <View style={[styles.root, { backgroundColor: c.card }]}>
      <Rise distance={12}>
        <LinearGradient
          colors={c.oceanGrad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 24 }]}
        >
          <View style={styles.brandRow}>
            <Ionicons name="water" size={22} color="#fff" />
            <Text style={styles.brand}>AquaNest</Text>
          </View>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in with your email to continue.</Text>
        </LinearGradient>
      </Rise>

      <FormSheet c={c}>
        <Rise delay={80} distance={16}>
          <View style={[styles.fieldsBlock, { backgroundColor: c.card }]}>
            <Field
              label="Email"
              c={c}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              autoCorrect={false}
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              style={styles.fieldTight}
            />
            <PasswordField
              label="Password"
              c={c}
              error={errors.password}
              value={password}
              onChangeText={setPassword}
              show={show}
              onToggle={() => setShow((s) => !s)}
            />
          </View>

          <Text style={[styles.forgot, { color: c.ocean }]}>Forgot password?</Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: c.ocean, opacity: busy ? 0.7 : 1 }]}
            onPress={onSubmit}
            disabled={busy}
          >
            <Text style={styles.primaryBtnText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={[styles.linkLine, { color: c.muted }]}>
              New here? <Text style={{ color: c.ocean, fontWeight: "700" }}>Create account</Text>
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate("Register", { type: "dealer" })}>
            <Text style={[styles.linkLineSmall, { color: c.muted }]}>
              Business owner? <Text style={{ color: c.ocean, fontWeight: "700" }}>Register as dealer</Text>
            </Text>
          </Pressable>
          <Pressable onPress={fillDemo} style={{ marginTop: 16 }}>
            <Text style={[styles.demo, { color: c.muted }]}>Use demo account (optional)</Text>
          </Pressable>
        </Rise>
      </FormSheet>
    </View>
  );
}

export function RegisterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { register } = useAuth();
  const feedback = useFeedback();
  const [isDealer, setIsDealer] = useState(route.params?.type === "dealer");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    businessName: "",
    gstin: "",
    city: "",
    businessType: "Retail shop",
  });
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  async function onSubmit() {
    const phoneDigits = String(form.phone || "").replace(/\D/g, "").slice(-10);
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) next.phone = "Enter a valid 10-digit mobile number";
    if (form.password.length < 6) next.password = "Use at least 6 characters";
    if (isDealer) {
      if (form.businessName.trim().length < 2) next.businessName = "Enter business name";
      if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/i.test(form.gstin.trim())) next.gstin = "Enter a valid 15-character GSTIN";
      if (form.city.trim().length < 2) next.city = "Enter city";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: phoneDigits,
        password: form.password,
        role: isDealer ? "dealer" : "customer",
        dealer: isDealer
          ? {
              businessName: form.businessName.trim(),
              gstin: form.gstin.trim().toUpperCase(),
              city: form.city.trim(),
              businessType: form.businessType,
            }
          : undefined,
      });
      feedback.success(isDealer ? "Application submitted" : "Account created", {
        description: `Signed in as ${form.email.trim().toLowerCase()}`,
      });
      navigateToHome(navigation);
    } catch (e) {
      feedback.error("Could not register", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.card }]}>
      <LinearGradient
        colors={c.oceanGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.brandRow}>
          <Ionicons name="water" size={22} color="#fff" />
          <Text style={styles.brand}>AquaNest</Text>
        </View>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>
          {isDealer ? "Apply for wholesale prices and bulk orders." : "Pure water, delivered and installed."}
        </Text>
      </LinearGradient>

      <FormSheet c={c}>
        <View style={[styles.toggle, { backgroundColor: c.chip }]}>
          {[
            { id: false, label: "Customer", icon: "person-outline" },
            { id: true, label: "Dealer", icon: "storefront-outline" },
          ].map((t) => (
            <Pressable
              key={String(t.id)}
              onPress={() => setIsDealer(t.id)}
              style={[
                styles.toggleItem,
                { backgroundColor: isDealer === t.id ? c.card : "transparent" },
              ]}
            >
              <Ionicons name={t.icon} size={16} color={isDealer === t.id ? c.text : c.muted} />
              <Text style={{ fontWeight: "700", fontSize: 13, color: isDealer === t.id ? c.text : c.muted }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.fieldsBlock, { backgroundColor: c.card }]}>
          <Field label="Full name" c={c} error={errors.name} value={form.name} onChangeText={set("name")} style={styles.fieldTight} />
          <Field
            label="Email"
            c={c}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            value={form.email}
            onChangeText={set("email")}
            style={styles.fieldTight}
          />
          <Field
            label="Mobile number"
            c={c}
            error={errors.phone}
            keyboardType="number-pad"
            maxLength={10}
            value={form.phone}
            onChangeText={set("phone")}
            style={styles.fieldTight}
          />
          <PasswordField
            label="Password"
            c={c}
            error={errors.password}
            value={form.password}
            onChangeText={set("password")}
            show={show}
            onToggle={() => setShow((s) => !s)}
          />
        </View>

        {isDealer && (
          <View style={[styles.dealerBox, { backgroundColor: c.mist, borderColor: c.border }]}>
            <Text style={[styles.dealerTitle, { color: c.text }]}>Business details</Text>
            <Field label="Business name" c={c} error={errors.businessName} value={form.businessName} onChangeText={set("businessName")} style={styles.fieldTight} />
            <Field
              label="GSTIN"
              c={c}
              error={errors.gstin}
              autoCapitalize="characters"
              maxLength={15}
              placeholder="22AAAAA0000A1Z5"
              value={form.gstin}
              onChangeText={set("gstin")}
              style={styles.fieldTight}
            />
            <Field label="City" c={c} error={errors.city} value={form.city} onChangeText={set("city")} style={styles.fieldTight} />
            <Text style={[styles.label, { color: c.muted }]}>Business type</Text>
            <View style={styles.typeWrap}>
              {["Retail shop", "Distributor", "Service centre", "Plumbing contractor"].map((kind) => (
                <Pressable
                  key={kind}
                  onPress={() => set("businessType")(kind)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: form.businessType === kind ? c.ocean : c.border,
                      backgroundColor: form.businessType === kind ? c.secondary : c.card,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: form.businessType === kind ? c.oceanDeep : c.text }}>{kind}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: c.ocean, marginTop: 8, opacity: busy ? 0.7 : 1 }]}
          onPress={onSubmit}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>{busy ? "Creating…" : isDealer ? "Submit application" : "Create account"}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={[styles.linkLine, { color: c.muted }]}>
            Already have an account? <Text style={{ color: c.ocean, fontWeight: "700" }}>Sign in</Text>
          </Text>
        </Pressable>
      </FormSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "700" },
  title: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 24 },
  sub: { color: "rgba(255,255,255,0.88)", marginTop: 6, fontSize: 14 },
  sheet: {
    flex: 1,
    marginTop: -18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    paddingHorizontal: 20,
    flexGrow: 1,
  },
  fieldsBlock: {
    borderRadius: 16,
    paddingTop: 2,
  },
  field: { marginBottom: 14 },
  fieldTight: { marginBottom: 10 },
  label: { fontSize: 13, marginBottom: 6, fontWeight: "600" },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  passwordWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  eyeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  error: { fontSize: 12, marginTop: 4 },
  forgot: { textAlign: "right", fontWeight: "700", fontSize: 12, marginBottom: 14, marginTop: 2 },
  primaryBtn: {
    height: 50,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  linkLine: { textAlign: "center", marginTop: 16, fontSize: 14 },
  linkLineSmall: { textAlign: "center", marginTop: 10, fontSize: 14 },
  demo: { textAlign: "center", marginTop: 14, fontSize: 12 },
  toggle: { flexDirection: "row", borderRadius: 16, padding: 4, marginBottom: 14 },
  toggleItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
  },
  dealerBox: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 8, marginTop: 4 },
  dealerTitle: { fontWeight: "700", marginBottom: 10 },
  typeWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
});
