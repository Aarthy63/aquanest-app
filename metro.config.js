const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

/** Expo Go Android lacks ExpoTopicSubscriptionModule — always use the JS stub. */
const topicStub = path.resolve(
  __dirname,
  "node_modules/expo-notifications/build/TopicSubscriptionModule.js",
);

const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (typeof moduleName === "string" && moduleName.includes("TopicSubscriptionModule")) {
    return { type: "sourceFile", filePath: topicStub };
  }

  if (typeof upstreamResolve === "function") {
    return upstreamResolve(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
