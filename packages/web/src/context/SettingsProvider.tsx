import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

export type Density = "comfortable" | "compact";
const DENSITY_KEY = "vninvest-density";

type SettingsValue = {
  density: Density;
  setDensity: (value: Density) => void;
};

const SettingsContext = createContext<SettingsValue | null>(null);

function readInitialDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

/** Nguồn state density duy nhất — pattern theo LangContext, không localStorage rời rạc. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>(readInitialDensity);
  useEffect(() => {
    document.documentElement.setAttribute("data-density", density);
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* private mode — bỏ qua */
    }
  }, [density]);
  const value = useMemo(() => ({ density, setDensity }), [density]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings phải nằm trong SettingsProvider");
  return ctx;
}
