export const banner = require("../assets/catalog/banner-water.jpg");

export const categoryImages = {
  purifiers: require("../assets/catalog/p-ro-wall.jpg"),
  dispensers: require("../assets/catalog/p-dispenser-floor.jpg"),
  pumps: require("../assets/catalog/p-pump.jpg"),
  filters: require("../assets/catalog/p-filter-sediment.jpg"),
  membranes: require("../assets/catalog/p-membrane.jpg"),
  "spare-parts": require("../assets/catalog/p-spares.jpg"),
};

/**
 * Prefer each product's own image URL from the API/catalog.
 * Falls back to category asset only if no URL is present.
 */
export function productImage(product) {
  const url =
    (typeof product?.image === "string" && product.image) ||
    (Array.isArray(product?.images) && typeof product.images[0] === "string" && product.images[0]) ||
    null;

  if (url && /^https?:\/\//i.test(url)) {
    return { uri: url };
  }
  if (url && url.startsWith("//")) {
    return { uri: `https:${url}` };
  }

  return categoryImages[product?.category] || categoryImages.purifiers;
}
