export const light = {
  mode: "light",
  bg: "#F3F6F8",
  card: "#FFFFFF",
  text: "#0E2133",
  muted: "#5C6B73",
  border: "#E2E8EC",
  ocean: "#165A78",
  oceanDeep: "#0F3F56",
  teal: "#2AA7C4",
  mist: "#E7F4F8",
  secondary: "#E7F3F7",
  tabOn: "#E7F3F7",
  offer: "#E85D04",
  gold: "#D4AF37",
  danger: "#C1121F",
  success: "#2D6A4F",
  warning: "#E9A825",
  input: "#FFFFFF",
  chip: "#EEF3F5",
  amountBox: "#EEF3F5",
  oceanGrad: ["#0B3A4F", "#165A78", "#2A8FA8"],
  successBg: "#E5F4EC",
  bannerSoon: "#E7F3F7",
  sheet: "#FFFFFF",
  statusBar: "dark",
};

export const dark = {
  mode: "dark",
  bg: "#0B1016",
  card: "#15202B",
  text: "#F2F6F8",
  muted: "#9AABB7",
  border: "rgba(255,255,255,0.14)",
  ocean: "#4DB8D0",
  oceanDeep: "#7ECFE0",
  teal: "#5BC0D6",
  mist: "#1A2C38",
  secondary: "#1E2F3C",
  tabOn: "#243746",
  offer: "#F08A3A",
  gold: "#E8C547",
  danger: "#E35A5A",
  success: "#4CAF7A",
  warning: "#E9A825",
  input: "#1A2633",
  chip: "#1A2633",
  amountBox: "#121C26",
  oceanGrad: ["#071820", "#0F3A4C", "#1A5A6E"],
  successBg: "#163528",
  bannerSoon: "#1E2F3C",
  sheet: "#15202B",
  statusBar: "light",
};

export const colors = light;

export function discountPct(product) {
  if (!product?.mrp) return 0;
  return Math.round(((product.mrp - product.price) / product.mrp) * 100);
}

export const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
