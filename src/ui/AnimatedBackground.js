import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { nativeDriver } from "../nativeAnim";
import { useTheme } from "../ThemeContext";

function Orb({ size, color, start, end, duration, delay = 0 }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(t, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, t]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [start.x, end.x] });
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [start.y, end.y] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

/**
 * Soft ambient motion — OFF in light mode (static bg).
 * Dark mode keeps a gentle drifting wash + orbs.
 */
export default function AnimatedBackground({ intensity = 1 }) {
  const { c, dark } = useTheme();
  const { width, height } = useWindowDimensions();
  const wash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dark) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wash, {
          toValue: 1,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(wash, {
          toValue: 0,
          duration: 8000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dark, wash]);

  const orbs = useMemo(() => {
    if (!dark) return [];
    const a = Math.max(0.15, Math.min(intensity, 1) * 0.7);
    return [
      {
        size: width * 0.65,
        color: `rgba(77,184,208,${0.1 * a})`,
        start: { x: -width * 0.15, y: height * 0.08 },
        end: { x: width * 0.06, y: height * 0.16 },
        duration: 10000,
        delay: 0,
      },
      {
        size: width * 0.48,
        color: `rgba(232,197,71,${0.07 * a})`,
        start: { x: width * 0.5, y: height * 0.35 },
        end: { x: width * 0.28, y: height * 0.45 },
        duration: 12000,
        delay: 500,
      },
      {
        size: width * 0.55,
        color: `rgba(26,90,110,${0.16 * a})`,
        start: { x: width * 0.1, y: height * 0.62 },
        end: { x: -width * 0.05, y: height * 0.72 },
        duration: 11000,
        delay: 300,
      },
    ];
  }, [dark, height, intensity, width]);

  const washOpacity = wash.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.55],
  });

  // Light mode: no animated light — solid calm background
  if (!dark) {
    return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: washOpacity }]}>
        <LinearGradient
          colors={["#0B1016", "#102433", "#0B1016"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {orbs.map((orb, i) => (
        <Orb key={i} {...orb} />
      ))}
    </View>
  );
}

/** Soft white/gold light sweep across a surface (header/banner). */
export function LightSweep({ style }) {
  const { width } = useWindowDimensions();
  const { dark } = useTheme();
  const x = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    // Off in light mode — keep UI calm
    if (!dark) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: nativeDriver,
        }),
        Animated.delay(1800),
        Animated.timing(x, {
          toValue: -1,
          duration: 0,
          useNativeDriver: nativeDriver,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dark, x]);

  if (!dark) return null;

  const translateX = x.interpolate({
    inputRange: [-1, 1],
    outputRange: [-width * 0.4, width * 0.85],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { overflow: "hidden" },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: -20,
          bottom: -20,
          width: width * 0.35,
          transform: [{ translateX }, { rotate: "18deg" }],
          opacity: 0.22,
        }}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.55)", "rgba(232,197,71,0.25)", "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    left: 0,
    top: 0,
  },
});
