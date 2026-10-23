import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../api";
import { getProduct } from "../catalog";
import { productImage } from "../images";
import { useAuth } from "../AuthContext";
import { useNotifications } from "../NotificationCenter";
import { colors, formatINR } from "../theme";
import { useTheme } from "../ThemeContext";
import AnimatedBackground from "../ui/AnimatedBackground";
import { useFeedback } from "../ui/Feedback";

const SETTINGS_KEY = "aquanest_settings";
const DEFAULT_SETTINGS = {
  theme: "light",
  pushOrders: true,
  pushService: true,
  pushOffers: true,
  email: true,
  sms: false,
};

const SERVICE_TYPES = [
  { id: "installation", label: "Installation", sub: "New purifier setup", icon: "settings-outline", price: "Free*" },
  { id: "maintenance", label: "Maintenance", sub: "Cleaning & check-up", icon: "water-outline", price: "₹399" },
  { id: "repair", label: "Repair", sub: "Leak, noise, no water", icon: "hammer-outline", price: "₹299 visit" },
  { id: "filter-replacement", label: "Filter change", sub: "Replace cartridges", icon: "construct-outline", price: "₹199 + parts" },
];

const SLOTS = ["9 AM – 12 PM", "12 PM – 3 PM", "3 PM – 6 PM", "6 PM – 8 PM"];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function upcomingDays() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

function formatVisit(d) {
  return `${WEEK[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

function StatusPill({ status }) {
  const { c } = useTheme();
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

function goAuth(navigation, screen) {
  const names = navigation.getState?.()?.routeNames;
  if (Array.isArray(names) && names.includes(screen)) {
    navigation.navigate(screen);
    return;
  }
  const parent = navigation.getParent?.();
  const parentNames = parent?.getState?.()?.routeNames;
  if (Array.isArray(parentNames) && parentNames.includes(screen)) {
    parent.navigate(screen);
    return;
  }
  const root = parent?.getParent?.() || parent;
  root?.navigate?.(screen);
}

function SignInPrompt({ navigation, title, body }) {
  const { c } = useTheme();
  return (
    <View style={[styles.prompt, { backgroundColor: c.bg }]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
        <Ionicons name="log-in-outline" size={32} color={c.ocean} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: c.muted }]}>{body}</Text>
      <View style={styles.promptCol}>
        <Pressable style={[styles.primaryBtn, styles.authBtnWide, { backgroundColor: c.ocean }]} onPress={() => goAuth(navigation, "Login")}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>
        <Pressable style={[styles.outlineBtn, styles.authBtnWide, { borderColor: c.ocean }]} onPress={() => goAuth(navigation, "Register")}>
          <Text style={[styles.outlineBtnText, { color: c.ocean }]}>Create account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PageTitle({ title, top }) {
  const { c } = useTheme();
  return (
    <View style={[styles.pageHeader, { paddingTop: top, height: 56 + top, backgroundColor: c.card, borderBottomColor: c.border }]}>
      <Text style={[styles.pageHeaderTitle, { color: c.text }]}>{title}</Text>
    </View>
  );
}

export function ServiceScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c } = useTheme();
  const { user } = useAuth();
  const feedback = useFeedback();
  const gap = 8;
  const typeW = Math.floor((width - 32 - gap) / 2);
  const days = upcomingDays();
  const [tab, setTab] = useState("book");
  const [type, setType] = useState("installation");
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [product, setProduct] = useState("");
  const [address, setAddress] = useState("");
  const [issue, setIssue] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [bookings, setBookings] = useState([]);

  const load = useCallback(() => {
    if (!user) return;
    api("/api/bookings")
      .then(setBookings)
      .catch(() => {});
    api("/api/addresses")
      .then((list) => {
        if (list[0]) setAddress((current) => current || `${list[0].line1}, ${list[0].city} – ${list[0].pincode}`);
      })
      .catch(() => {});
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeCount = bookings.filter((b) => b.status !== "cancelled" && b.status !== "completed").length;

  async function confirm() {
    const next = {};
    if (address.trim().length < 10) next.address = "Enter full address with PIN code";
    if (issue.trim().length < 5) next.issue = "Briefly describe what you need";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const b = await api("/api/bookings", {
        method: "POST",
        body: {
          type,
          date: formatVisit(days[day]),
          slot,
          address: address.trim(),
          issue: issue.trim(),
          product: product.trim(),
        },
      });
      setBookings((list) => [b, ...list]);
      setIssue("");
      feedback.success("Service booked", {
        description: "A technician will be assigned shortly. Email confirmation sent.",
      });
      setTab("mine");
    } catch (e) {
      feedback.error("Service", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  function cancelBooking(b) {
    feedback.confirm({
      title: "Cancel this booking?",
      message: `Your ${b.date} visit will be cancelled.`,
      confirmText: "Cancel booking",
      cancelText: "Keep",
      destructive: true,
      onConfirm: () =>
        api(`/api/bookings/${b.id}/cancel`, { method: "POST" })
          .then((updated) => {
            setBookings((list) => list.map((item) => (item.id === updated.id ? updated : item)));
            feedback.info("Booking cancelled");
          })
          .catch((e) => feedback.error("Service", { description: e.message })),
    });
  }

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <AnimatedBackground intensity={0.8} />
      <PageTitle title="Service" top={insets.top} />
      <View style={[styles.tabs, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {[
          ["book", "Book a visit"],
          ["mine", `My bookings${activeCount ? ` (${activeCount})` : ""}`],
        ].map(([id, label]) => (
          <Pressable key={id} style={[styles.tab, tab === id && { backgroundColor: c.secondary }]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, { color: c.muted }, tab === id && { color: c.oceanDeep }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {!user ? (
        <SignInPrompt
          navigation={navigation}
          title="Sign in to book a service"
          body="Track orders, save addresses and book service visits."
        />
      ) : tab === "book" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.section, { color: c.text }]}>Service type</Text>
          <View style={[styles.typeGrid, { gap }]}>
            {SERVICE_TYPES.map((item) => {
              const on = type === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.typeCard,
                    { width: typeW, backgroundColor: c.card, borderColor: c.border },
                    on && { borderColor: c.ocean, borderWidth: 1.5 },
                  ]}
                  onPress={() => setType(item.id)}
                >
                  <Ionicons name={item.icon} size={20} color={on ? c.ocean : c.muted} />
                  <Text style={[styles.typeLabel, { color: c.text }]}>{item.label}</Text>
                  <Text style={[styles.typeSub, { color: c.muted }]}>{item.sub}</Text>
                  <Text style={[styles.typePrice, { color: c.ocean }]}>{item.price}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.section, { color: c.text }]}>Pick a date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.days}>
            {days.map((d, i) => (
              <Pressable
                key={i}
                style={[
                  styles.day,
                  { backgroundColor: c.card, borderColor: c.border },
                  day === i && { backgroundColor: c.ocean, borderColor: c.ocean },
                ]}
                onPress={() => setDay(i)}
              >
                <Text style={[styles.dayTop, { color: c.muted }, day === i && styles.dayOnText]}>{WEEK[d.getDay()].toUpperCase()}</Text>
                <Text style={[styles.dayNum, { color: c.text }, day === i && styles.dayOnText]}>{d.getDate()}</Text>
                <Text style={[styles.dayTop, { color: c.muted }, day === i && styles.dayOnText]}>{MONTH[d.getMonth()]}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.typeGrid, { paddingHorizontal: 16, gap }]}>
            {SLOTS.map((s) => (
              <Pressable
                key={s}
                style={[
                  styles.slot,
                  { width: typeW, backgroundColor: c.card, borderColor: c.border },
                  slot === s && { borderColor: c.ocean, backgroundColor: c.secondary },
                ]}
                onPress={() => setSlot(s)}
              >
                <Text style={[styles.slotText, { color: c.text }, slot === s && { color: c.oceanDeep }]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { color: c.text }]}>Details</Text>
          <View style={styles.fields}>
            <Text style={[styles.fieldLabel, { color: c.text }]}>Product / model (optional)</Text>
            <TextInput
              value={product}
              onChangeText={setProduct}
              placeholder="e.g. AquaNest Crystal RO"
              placeholderTextColor={c.muted}
              style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            />
            <Text style={[styles.fieldLabel, { color: c.text }]}>Visit address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              multiline
              placeholder="House, street, city, PIN"
              placeholderTextColor={c.muted}
              style={[styles.input, styles.area, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            />
            {!!errors.address && <Text style={[styles.error, { color: c.danger }]}>{errors.address}</Text>}
            <Text style={[styles.fieldLabel, { color: c.text }]}>Describe the issue</Text>
            <TextInput
              value={issue}
              onChangeText={setIssue}
              multiline
              placeholder="e.g. water leaking from the tap"
              placeholderTextColor={c.muted}
              style={[styles.input, styles.area, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            />
            {!!errors.issue && <Text style={[styles.error, { color: c.danger }]}>{errors.issue}</Text>}
            <Pressable style={[styles.confirm, { backgroundColor: c.ocean }, busy && { opacity: 0.7 }]} onPress={confirm} disabled={busy}>
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.confirmText}>{busy ? "Booking…" : "Confirm booking"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.wrap, { backgroundColor: c.bg }]}>
          {bookings.length === 0 ? (
            <View style={[styles.prompt, { backgroundColor: c.bg }]}>
              <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
                <Ionicons name="calendar-outline" size={32} color={c.ocean} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>No bookings yet</Text>
              <Text style={[styles.emptyBody, { color: c.muted }]}>Book a technician for installation, repair or filter change.</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={[styles.orderCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.bold, { color: c.text }]}>{String(b.type).replace(/-/g, " ")}</Text>
                  <StatusPill status={b.status} />
                </View>
                <Text style={[styles.when, { color: c.ocean }]}>
                  {b.date} · {b.slot}
                </Text>
                {!!b.issue && <Text style={[styles.muted, { color: c.muted }]}>{b.issue}</Text>}
                {!!b.address && <Text style={[styles.meta, { color: c.muted }]}>{b.address}</Text>}
                <Text style={[styles.meta, { color: c.muted }]}>
                  {b.status === "requested" ? "A technician will be assigned and you'll be notified." : ""}
                </Text>
                {b.status === "requested" && (
                  <Pressable onPress={() => cancelBooking(b)}>
                    <Text style={[styles.cancel, { color: c.danger }]}>Cancel booking</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

export function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { c, dark, setDark } = useTheme();
  const { user, logout, refresh } = useAuth();
  const { unread, refresh: refreshNotifications } = useNotifications();
  const feedback = useFeedback();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      else setSettings(DEFAULT_SETTINGS);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshNotifications();
      AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      });
    }, [refresh, refreshNotifications]),
  );

  function updateSetting(patch) {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
    if (Object.prototype.hasOwnProperty.call(patch, "email")) {
      feedback.info(patch.email ? "Email notifications on" : "Email notifications off", {
        description: patch.email
          ? `Updates will be sent to ${user?.email || "your email"}.`
          : "You won't receive order emails.",
      });
    }
    if (Object.prototype.hasOwnProperty.call(patch, "pushOrders") || Object.prototype.hasOwnProperty.call(patch, "pushService") || Object.prototype.hasOwnProperty.call(patch, "pushOffers")) {
      feedback.info("In-app alerts updated", {
        description: "New order/service updates will pop up while the app is open.",
      });
    }
  }

  function signOut() {
    feedback.confirm({
      title: "Sign out?",
      message: "You'll need to sign in again to place orders.",
      confirmText: "Sign out",
      cancelText: "Stay",
      destructive: true,
      onConfirm: () => {
        logout();
        feedback.info("Signed out");
        // Clear stack so Register isn't left on top — Login shows first
        navigation.reset({
          index: 1,
          routes: [{ name: "ProfileMain" }, { name: "Login" }],
        });
      },
    });
  }

  const links = [
    { icon: "cube-outline", label: "Order history", meta: user?.orders?.length || "", screen: "Orders" },
    { icon: "heart-outline", label: "Wishlist", meta: user?.wishlist?.length || "", screen: "Wishlist" },
    { icon: "location-outline", label: "Saved addresses", meta: user?.addresses?.length || "", screen: "Addresses" },
    { icon: "construct-outline", label: "Service bookings", meta: "", tab: "Service" },
    {
      icon: "notifications-outline",
      label: "Notifications",
      meta: unread > 0 ? String(unread) : "",
      screen: "Notifications",
    },
  ];

  const toggles = [
    { key: "pushOrders", label: "Order alerts", hint: "Status & payment updates", icon: "cube-outline" },
    { key: "pushService", label: "Service alerts", hint: "Booking & technician updates", icon: "construct-outline" },
    { key: "pushOffers", label: "Offers & deals", hint: "Sales and promotions", icon: "pricetag-outline" },
    { key: "email", label: "Email notifications", hint: "Send to your registered email", icon: "mail-outline" },
    { key: "sms", label: "SMS notifications", hint: "Text messages (preview)", icon: "chatbubble-outline" },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <AnimatedBackground intensity={0.9} />
      <PageTitle title="Account" top={insets.top} />
      {!user ? (
        <SignInPrompt
          navigation={navigation}
          title="Sign in to your account"
          body="Track orders, save addresses and book service visits."
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={c.oceanGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.heroName}>
                {user.name}
              </Text>
              <Text numberOfLines={1} style={styles.heroEmail}>
                {user.email}
              </Text>
              <View style={styles.role}>
                <Text style={styles.roleText}>{String(user.role || "customer").toUpperCase()}</Text>
              </View>
            </View>
          </LinearGradient>

          <Pressable style={[styles.dealerRow, { backgroundColor: c.mist, borderColor: c.border }]} onPress={() => navigation.navigate("Dealer")}>
            <Ionicons name="storefront-outline" size={20} color={c.ocean} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bold, { color: c.text }]}>Dealer program</Text>
              <Text style={[styles.meta, { color: c.muted }]}>
                {user.dealer?.status && user.dealer.status !== "none"
                  ? "View your dealer status"
                  : "Apply for wholesale pricing"}
              </Text>
            </View>
            {user.dealer?.status && user.dealer.status !== "none" ? <StatusPill status={user.dealer.status} /> : null}
            <Ionicons name="chevron-forward" size={16} color={c.muted} />
          </Pressable>

          <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
            {links.map((item) => (
              <Pressable
                key={item.label}
                style={[styles.linkRow, { borderBottomColor: c.border }]}
                onPress={() => (item.tab ? navigation.getParent()?.navigate(item.tab) : navigation.navigate(item.screen))}
              >
                <Ionicons name={item.icon} size={18} color={c.ocean} />
                <Text style={[styles.linkLabel, { color: c.text }]}>{item.label}</Text>
                {item.meta !== "" && <Text style={[styles.meta, { color: c.muted }]}>{item.meta}</Text>}
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.section, { color: c.text }]}>Notification settings</Text>
          <Text style={[styles.settingsHint, { color: c.muted }]}>
            Turn alerts on or off. In-app toasts appear while AquaNest is open.
          </Text>
          <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
            {toggles.map((item) => {
              const on = !!settings[item.key];
              return (
                <View key={item.key} style={[styles.notifyRow, { borderBottomColor: c.border }]}>
                  <View style={[styles.notifyIcon, { backgroundColor: c.secondary || c.chip }]}>
                    <Ionicons name={item.icon} size={18} color={c.ocean} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.linkLabel, { color: c.text }]}>{item.label}</Text>
                    <Text style={[styles.meta, { color: c.muted }]}>{item.hint}</Text>
                  </View>
                  <Text style={[styles.onOff, { color: on ? c.ocean : c.muted }]}>{on ? "On" : "Off"}</Text>
                  <Switch
                    value={on}
                    onValueChange={(v) => updateSetting({ [item.key]: v })}
                    trackColor={{ false: c.border, true: c.ocean }}
                    thumbColor="#fff"
                  />
                </View>
              );
            })}
          </View>

          <Text style={[styles.section, { color: c.text }]}>Appearance</Text>
          <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border, padding: 12 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Ionicons name="moon-outline" size={18} color={c.ocean} />
              <Text style={[styles.linkLabel, { color: c.text }]}>Theme</Text>
            </View>
            <View style={{ flexDirection: "row", backgroundColor: c.chip, borderRadius: 14, padding: 4, gap: 4 }}>
              {[
                { on: false, label: "Light", icon: "sunny-outline" },
                { on: true, label: "Dark", icon: "moon" },
              ].map((opt) => {
                const active = dark === opt.on;
                return (
                  <Pressable
                    key={opt.label}
                    onPress={() => {
                      setDark(opt.on);
                      updateSetting({ theme: opt.on ? "dark" : "light" });
                      feedback.info(opt.on ? "Dark mode on" : "Light mode on");
                    }}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderRadius: 12,
                      paddingVertical: 11,
                      backgroundColor: active ? c.card : "transparent",
                      borderWidth: active ? 1 : 0,
                      borderColor: c.border,
                    }}
                  >
                    <Ionicons name={opt.icon} size={16} color={active ? c.ocean : c.muted} />
                    <Text style={{ fontWeight: "700", fontSize: 13, color: active ? c.text : c.muted }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable style={[styles.signOut, { borderColor: dark ? "#5A3035" : "#F3C5CA" }]} onPress={signOut}>
            <Ionicons name="log-out-outline" size={16} color={c.danger} />
            <Text style={[styles.signOutText, { color: c.danger }]}>Sign out</Text>
          </Pressable>
          <Text style={[styles.version, { color: c.muted }]}>AquaNest v1.0 · Preview build</Text>
        </ScrollView>
      )}
    </View>
  );
}

export function NotificationsScreen() {
  const { c } = useTheme();
  const feedback = useFeedback();
  const { refresh: refreshPush, markAllRead } = useNotifications();
  const [items, setItems] = useState([]);
  const [logins, setLogins] = useState([]);

  useFocusEffect(
    useCallback(() => {
      Promise.all([api("/api/notifications"), api("/api/auth/login-history")])
        .then(async ([list, history]) => {
          setItems(Array.isArray(list) ? list : []);
          setLogins(Array.isArray(history) ? history : []);
          await markAllRead();
          refreshPush();
        })
        .catch((e) => feedback.error("Notifications", { description: e.message }));
    }, [markAllRead, refreshPush]),
  );

  const iconFor = {
    order: "cube-outline",
    service: "construct-outline",
    dealer: "storefront-outline",
    offer: "pricetag-outline",
    login: "log-in-outline",
  };

  const alerts = items.filter((n) => n.kind !== "login");
  const loginNotes = items.filter((n) => n.kind === "login");

  if (!items.length && !logins.length) {
    return (
      <View style={[styles.prompt, { backgroundColor: c.bg }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.secondary }]}>
          <Ionicons name="notifications-outline" size={32} color={c.ocean} />
        </View>
        <Text style={[styles.emptyTitle, { color: c.text }]}>You're all caught up</Text>
        <Text style={[styles.emptyBody, { color: c.muted }]}>
          Order updates and sign-in history will show up here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 28 }}>
      <Text style={[styles.section, { color: c.text, marginTop: 12 }]}>Login history</Text>
      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
        {(logins.length ? logins : loginNotes.map((n) => ({ id: n.id, at: n.createdAt, device: "AquaNest app" }))).length ===
        0 ? (
          <View style={[styles.linkRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.meta, { color: c.muted, marginTop: 0 }]}>No sign-ins recorded yet.</Text>
          </View>
        ) : (
          (logins.length
            ? logins
            : loginNotes.map((n) => ({ id: n.id, at: n.createdAt, device: "AquaNest app" }))
          ).map((row, idx, arr) => (
            <View
              key={row.id}
              style={[
                styles.note,
                {
                  backgroundColor: c.card,
                  borderBottomColor: c.border,
                  borderBottomWidth: idx === arr.length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={[styles.noteIcon, { backgroundColor: c.secondary || c.chip, borderColor: c.border }]}>
                <Ionicons name="log-in-outline" size={16} color={c.ocean} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bold, { color: c.text }]}>Signed in</Text>
                <Text style={[styles.muted, { color: c.muted }]}>
                  {row.device || "AquaNest app"}
                  {" · "}
                  {row.at ? new Date(row.at).toLocaleString() : "—"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.section, { color: c.text }]}>Alerts</Text>
      {alerts.length === 0 ? (
        <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border, padding: 14 }]}>
          <Text style={[styles.meta, { color: c.muted, marginTop: 0 }]}>No order or service alerts yet.</Text>
        </View>
      ) : (
        <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>
          {alerts.map((n, idx) => (
            <View
              key={n.id}
              style={[
                styles.note,
                {
                  backgroundColor: !n.read ? c.mist : c.card,
                  borderBottomColor: c.border,
                  borderBottomWidth: idx === alerts.length - 1 ? 0 : 1,
                },
              ]}
            >
              <View style={[styles.noteIcon, { backgroundColor: c.secondary || c.chip, borderColor: c.border }]}>
                <Ionicons name={iconFor[n.kind] || "notifications-outline"} size={16} color={c.ocean} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bold, { color: c.text }]}>{n.title}</Text>
                <Text style={[styles.muted, { color: c.muted }]}>{n.body}</Text>
                {!!n.createdAt && (
                  <Text style={[styles.muted, { color: c.muted, marginTop: 2, fontSize: 11 }]}>
                    {new Date(n.createdAt).toLocaleString()}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export function DealerScreen() {
  const { c } = useTheme();
  const { user, refresh } = useAuth();
  const feedback = useFeedback();
  const [form, setForm] = useState({
    businessName: "",
    gstin: "",
    city: "",
    businessType: "Retail shop",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));
  const status = user?.dealer?.status || "none";

  async function submit() {
    setBusy(true);
    try {
      await api("/api/dealer", { method: "POST", body: form });
      await refresh();
      feedback.success("Application submitted", {
        description: "We'll email you when your dealer status is reviewed.",
      });
    } catch (e) {
      feedback.error("Dealer", { description: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: 28 }}>
      <LinearGradient colors={c.oceanGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dealerHero}>
        <Ionicons name="storefront-outline" size={28} color="#fff" />
        <Text style={styles.dealerTitle}>Grow with AquaNest</Text>
        <Text style={styles.dealerLine}>• Up to 28% lower wholesale prices</Text>
        <Text style={styles.dealerLine}>• Bulk ordering with minimum quantities</Text>
        <Text style={styles.dealerLine}>• Priority dispatch & dedicated support</Text>
      </LinearGradient>
      {status !== "none" && status !== "rejected" ? (
        <View style={[styles.orderCard, { margin: 16, backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.bold, { color: c.text }]}>{user.dealer.businessName || "Dealer application"}</Text>
          <Text style={[styles.muted, { color: c.muted }]}>{user.dealer.city}</Text>
          <View style={{ marginTop: 8 }}>
            <StatusPill status={status} />
          </View>
        </View>
      ) : (
        <View style={styles.fields}>
          {status === "rejected" && (
            <Text style={[styles.error, { color: c.danger }]}>Your previous application was not approved. You can apply again.</Text>
          )}
          <Text style={[styles.fieldLabel, { color: c.text }]}>Business name</Text>
          <TextInput
            value={form.businessName}
            onChangeText={set("businessName")}
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            placeholderTextColor={c.muted}
          />
          <Text style={[styles.fieldLabel, { color: c.text }]}>GSTIN</Text>
          <TextInput
            value={form.gstin}
            onChangeText={set("gstin")}
            autoCapitalize="characters"
            maxLength={15}
            placeholder="22AAAAA0000A1Z5"
            placeholderTextColor={c.muted}
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
          />
          <Text style={[styles.fieldLabel, { color: c.text }]}>City</Text>
          <TextInput
            value={form.city}
            onChangeText={set("city")}
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            placeholderTextColor={c.muted}
          />
          <Text style={[styles.fieldLabel, { color: c.text }]}>Business type</Text>
          <View style={styles.typeGrid}>
            {["Retail shop", "Distributor", "Online seller"].map((kind) => (
              <Pressable
                key={kind}
                style={[
                  styles.slot,
                  { backgroundColor: c.card, borderColor: c.border },
                  form.businessType === kind && { borderColor: c.ocean, backgroundColor: c.secondary },
                ]}
                onPress={() => set("businessType")(kind)}
              >
                <Text style={[styles.slotText, { color: c.text }, form.businessType === kind && { color: c.oceanDeep }]}>{kind}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[styles.confirm, { backgroundColor: c.ocean }, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
            <Text style={styles.confirmText}>{busy ? "Submitting…" : "Submit application"}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, backgroundColor: colors.bg, flexGrow: 1 },
  screen: { flex: 1, backgroundColor: "#F7F9FA" },
  pageHeader: {
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF1",
  },
  pageHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#173042" },
  h: { fontSize: 18, fontWeight: "800", color: colors.text, marginVertical: 10 },
  section: { fontSize: 15, fontWeight: "700", color: "#173042", marginHorizontal: 16, marginTop: 16, marginBottom: 10 },
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardOn: { borderColor: colors.ocean, borderWidth: 2 },
  bold: { fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  muted: { color: colors.muted, marginTop: 4, fontSize: 13 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  price: { marginTop: 4, fontWeight: "800", color: "#173042" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: colors.text,
  },
  area: { minHeight: 72, textAlignVertical: "top" },
  btn: {
    backgroundColor: colors.ocean,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontWeight: "700" },
  secondary: { height: 46, alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryText: { color: colors.ocean, fontWeight: "700" },
  placedCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  outlineWide: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#1B7C98",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineWideText: { color: "#1B7C98", fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    gap: 6,
    padding: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E6EEF1",
  },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  tabOn: { backgroundColor: "#E7F3F7" },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  tabTextOn: { color: "#1A4E63" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16 },
  typeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 12,
    marginBottom: 8,
  },
  typeCardOn: { borderColor: "#1B7C98", borderWidth: 1.5 },
  typeLabel: { marginTop: 8, fontSize: 14, fontWeight: "700", color: "#173042" },
  typeSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  typePrice: { marginTop: 6, fontSize: 11, fontWeight: "700", color: "#1B7C98" },
  dayScroll: { height: 84 },
  days: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  day: {
    width: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 8,
  },
  dayOn: { backgroundColor: "#1B7C98", borderColor: "#1B7C98" },
  dayTop: { fontSize: 10, color: colors.muted, textTransform: "uppercase" },
  dayNum: { fontSize: 18, fontWeight: "700", color: "#173042" },
  dayOnText: { color: "#fff" },
  slot: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  slotOn: { borderColor: "#1B7C98", backgroundColor: "#E7F3F7" },
  slotText: { fontSize: 12, fontWeight: "700", color: "#173042" },
  slotTextOn: { color: "#1A4E63" },
  fields: { paddingHorizontal: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#173042", marginBottom: 6, marginTop: 4 },
  error: { color: "#C1121F", fontSize: 12, marginTop: -4, marginBottom: 8 },
  confirm: {
    marginTop: 8,
    backgroundColor: "#1B7C98",
    borderRadius: 24,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  confirmText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  prompt: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingVertical: 40 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E7F3F7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#173042", textAlign: "center" },
  emptyBody: { marginTop: 6, textAlign: "center", color: colors.muted, fontSize: 14 },
  promptRow: { flexDirection: "row", gap: 8, marginTop: 18 },
  promptCol: { width: "100%", gap: 10, marginTop: 18, paddingHorizontal: 8 },
  authBtnWide: { alignItems: "center", justifyContent: "center", minHeight: 48 },
  primaryBtn: { backgroundColor: "#1B7C98", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  outlineBtn: { borderRadius: 24, borderWidth: 1, borderColor: "#1B7C98", paddingHorizontal: 18, paddingVertical: 12 },
  outlineBtnText: { color: "#1B7C98", fontWeight: "700" },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 14,
    marginBottom: 12,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
  when: { marginTop: 8, color: "#1B7C98", fontWeight: "600", fontSize: 13 },
  cancel: { marginTop: 8, color: "#C1121F", fontWeight: "700", fontSize: 13 },
  heroCard: { margin: 16, borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  heroName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  heroEmail: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 2 },
  role: {
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dealerRow: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EAF6F8",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    padding: 14,
  },
  group: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F5",
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F5",
  },
  notifyIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  onOff: { fontSize: 12, fontWeight: "800", minWidth: 28, textAlign: "right" },
  settingsHint: { marginHorizontal: 16, marginTop: -4, marginBottom: 10, fontSize: 12, lineHeight: 17 },
  linkLabel: { flex: 1, fontWeight: "600", color: "#173042", fontSize: 14 },
  signOut: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F3C5CA",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: { color: "#C1121F", fontWeight: "700" },
  version: { textAlign: "center", color: colors.muted, fontSize: 11, marginTop: 14 },
  wishGrid: { flexDirection: "row", flexWrap: "wrap" },
  wishCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E6EEF1",
    overflow: "hidden",
    marginBottom: 12,
  },
  brand: {
    marginTop: 8,
    marginHorizontal: 8,
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
  },
  wishName: { marginHorizontal: 8, marginTop: 2, minHeight: 34, fontWeight: "700", color: "#173042" },
  note: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F3F5",
    backgroundColor: "#fff",
  },
  noteUnread: { backgroundColor: "#F3FAFC" },
  noteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E6EEF1",
  },
  dealerHero: { margin: 16, borderRadius: 18, padding: 18 },
  dealerTitle: { color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 8, marginBottom: 8 },
  dealerLine: { color: "rgba(255,255,255,0.92)", fontSize: 14, marginTop: 4 },
});
