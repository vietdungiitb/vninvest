/**
 * useChartTheme
 * Light / dark theme switcher with localStorage persistence.
 *
 * Apply the returned `theme` value as a `data-chart-theme` attribute on any
 * ancestor element to activate the matching CSS custom-property block from
 * chart-theme.css.
 *
 * @example
 * import { useChartTheme } from "react-stockcharts";
 * import "react-stockcharts/styles/chart-theme.css";
 *
 * function MyChart() {
 *   const { theme, toggleTheme } = useChartTheme();
 *   return (
 *     <div data-chart-theme={theme}>
 *       <button onClick={toggleTheme}>Toggle theme</button>
 *       <ChartCanvas ... />
 *     </div>
 *   );
 * }
 */
import { useCallback, useState } from "react";
const STORAGE_KEY = "rsc-chart-theme";
export function useChartTheme(defaultTheme = "light") {
    const [theme, setThemeState] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored === "light" || stored === "dark")
                return stored;
        }
        catch {
            // ignore (SSR / restricted storage)
        }
        return defaultTheme;
    });
    const setTheme = useCallback((t) => {
        setThemeState(t);
        try {
            localStorage.setItem(STORAGE_KEY, t);
        }
        catch {
            // ignore
        }
    }, []);
    const toggleTheme = useCallback(() => {
        setTheme(theme === "light" ? "dark" : "light");
    }, [theme, setTheme]);
    return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
