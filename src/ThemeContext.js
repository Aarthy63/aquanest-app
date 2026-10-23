import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light } from "./theme";

const KEY = "aquanest_theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === "dark" || v === "light") setMode(v);
      setReady(true);
    });
  }, []);

  const setDark = useCallback((on) => {
    const next = on ? "dark" : "light";
    setMode(next);
    AsyncStorage.setItem(KEY, next);
  }, []);

  const toggle = useCallback(() => setDark(mode !== "dark"), [mode, setDark]);

  const value = useMemo(
    () => ({
      mode,
      dark: mode === "dark",
      c: mode === "dark" ? dark : light,
      setDark,
      toggle,
      ready,
    }),
    [mode, setDark, toggle, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme requires ThemeProvider");
  return ctx;
}
