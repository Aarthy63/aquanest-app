import { getFocusedRouteNameFromRoute, NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthProvider } from "./src/AuthContext";
import { NotificationProvider, useNotifications } from "./src/NotificationCenter";
import { ThemeProvider, useTheme } from "./src/ThemeContext";
import { FeedbackProvider } from "./src/ui/Feedback";
import HomeScreen from "./src/screens/HomeScreen";
import ShopScreen from "./src/screens/ShopScreen";
import ProductScreen from "./src/screens/ProductScreen";
import CartScreen from "./src/screens/CartScreen";
import CheckoutScreen from "./src/screens/CheckoutScreen";
import WishlistScreen from "./src/screens/WishlistScreen";
import AddressesScreen from "./src/screens/AddressesScreen";
import { LoginScreen, RegisterScreen } from "./src/screens/AuthScreens";
import {
  DealerScreen,
  NotificationsScreen,
  ProfileScreen,
  ServiceScreen,
} from "./src/screens/MoreScreens";
import { OrderDetailScreen, OrdersScreen } from "./src/screens/OrdersScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const Root = createNativeStackNavigator();

const HIDE_TAB_ROUTES = new Set(["Product", "Checkout"]);

function tabBarStyleFor(route, insets, c) {
  const focused = getFocusedRouteNameFromRoute(route);
  if (focused && HIDE_TAB_ROUTES.has(focused)) {
    return { display: "none" };
  }
  return {
    backgroundColor: c.card,
    borderTopColor: c.border,
    height: 58 + insets.bottom,
    paddingBottom: Math.max(insets.bottom, 6),
    paddingTop: 6,
  };
}

function ShopStack() {
  const { c } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: c.ocean, headerStyle: { backgroundColor: c.card }, headerTitleStyle: { color: c.text } }}>
      <Stack.Screen name="ShopHome" component={ShopScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: "Product" }} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  const { c } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: c.ocean, headerStyle: { backgroundColor: c.card }, headerTitleStyle: { color: c.text } }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: "Product" }} />
      <Stack.Screen name="Shop" component={ShopScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function CartStack() {
  const { c } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: c.ocean, headerStyle: { backgroundColor: c.card }, headerTitleStyle: { color: c.text } }}>
      <Stack.Screen name="CartMain" component={CartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: "Checkout" }} />
      <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "Order history" }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order details" }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  const { c } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerTintColor: c.ocean, headerStyle: { backgroundColor: c.card }, headerTitleStyle: { color: c.text } }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: "Order history" }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: "Order details" }} />
      <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ title: "Wishlist" }} />
      <Stack.Screen name="Addresses" component={AddressesScreen} options={{ title: "Saved addresses" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="Dealer" component={DealerScreen} options={{ title: "Dealer program" }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function TabIcon({ name, focused, badge = 0 }) {
  const { c } = useTheme();
  return (
    <View style={[styles.tabIcon, focused && { backgroundColor: c.tabOn }]}>
      <Ionicons name={name} size={18} color={focused ? c.ocean : c.muted} />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: c.danger || "#b42318" }]}>
          <View style={styles.badgeDot} />
        </View>
      ) : null}
    </View>
  );
}

function Tabs() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { unread } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ocean,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          height: 58 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={({ route }) => ({
          tabBarStyle: tabBarStyleFor(route, insets, c),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "home" : "home-outline"} focused={focused} />,
        })}
      />
      <Tab.Screen
        name="ShopTab"
        component={ShopStack}
        options={({ route }) => ({
          title: "Shop",
          tabBarStyle: tabBarStyleFor(route, insets, c),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} />,
        })}
      />
      <Tab.Screen
        name="Service"
        component={ServiceScreen}
        options={{
          headerShown: false,
          tabBarStyle: tabBarStyleFor({ name: "Service" }, insets, c),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "construct" : "construct-outline"} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartStack}
        options={({ route }) => ({
          tabBarStyle: tabBarStyleFor(route, insets, c),
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? "cart" : "cart-outline"} focused={focused} />,
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={({ route }) => ({
          title: "Account",
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarStyle: tabBarStyleFor(route, insets, c),
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} focused={focused} badge={unread} />
          ),
        })}
      />
    </Tab.Navigator>
  );
}

function RootNav() {
  const { c, dark } = useTheme();
  const navTheme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
      primary: c.ocean,
    },
  };
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Root.Navigator screenOptions={{ headerTintColor: c.ocean, headerStyle: { backgroundColor: c.card }, contentStyle: { backgroundColor: c.bg } }}>
        <Root.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
        <Root.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Root.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: { width: 48, height: 28, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 2,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <FeedbackProvider>
            <NotificationProvider>
              <RootNav />
            </NotificationProvider>
          </FeedbackProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
