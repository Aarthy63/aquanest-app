/**
 * Expo Go Android (SDK 53+) does not ship ExpoTopicSubscriptionModule.
 * Re-apply the JS stub after npm install.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-notifications",
  "build",
  "TopicSubscriptionModule.android.js",
);

const stub = `/**
 * Patched for Expo Go: native ExpoTopicSubscriptionModule is not shipped in SDK 53+.
 * Stub matches TopicSubscriptionModule.js so local notifications can load.
 */
const module = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};
export default module;
`;

if (!fs.existsSync(path.dirname(target))) {
  console.warn("[patch-expo-notifications] expo-notifications not installed; skip");
  process.exit(0);
}

fs.writeFileSync(target, stub, "utf8");
console.log("[patch-expo-notifications] TopicSubscriptionModule.android.js stubbed");
