"use client";

import {
  parseUiStyle,
  UI_STYLE_DEFAULT,
  UI_STYLE_STORAGE_KEY,
  type UiStyle,
} from "@/lib/ui-style";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type UiStyleContextValue = {
  style: UiStyle;
  setStyle: (next: UiStyle) => void;
  toggleStyle: () => void;
};

const UiStyleContext = createContext<UiStyleContextValue | null>(null);

function applyDomStyle(style: UiStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ui-style", style);
}

export function UiStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<UiStyle>(UI_STYLE_DEFAULT);

  useEffect(() => {
    const stored = parseUiStyle(localStorage.getItem(UI_STYLE_STORAGE_KEY));
    setStyleState(stored);
    applyDomStyle(stored);
  }, []);

  const setStyle = useCallback((next: UiStyle) => {
    setStyleState(next);
    applyDomStyle(next);
    try {
      localStorage.setItem(UI_STYLE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleStyle = useCallback(() => {
    setStyle(style === "fresh" ? "classic" : "fresh");
  }, [setStyle, style]);

  const value = useMemo(
    () => ({ style, setStyle, toggleStyle }),
    [style, setStyle, toggleStyle]
  );

  return <UiStyleContext.Provider value={value}>{children}</UiStyleContext.Provider>;
}

export function useUiStyle(): UiStyleContextValue {
  const ctx = useContext(UiStyleContext);
  if (!ctx) {
    return {
      style: UI_STYLE_DEFAULT,
      setStyle: () => {},
      toggleStyle: () => {},
    };
  }
  return ctx;
}
