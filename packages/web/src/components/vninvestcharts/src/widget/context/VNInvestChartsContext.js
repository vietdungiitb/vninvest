import { jsx as _jsx } from "react/jsx-runtime";
/**
 * WE2 P1-02: VNInvestChartsContext (main provider)
 *
 * Composes ConfigContext, StateContext, WidgetI18nContext, and HoverEmitter
 * into a single provider tree. This is the root context for the compound
 * component architecture.
 *
 * The provider wraps around the existing VNInvestCharts implementation — it does
 * NOT replace the prop-driven API. Instead, it provides an internal coordination
 * layer that compound sub-components (Toolbar, Header, Footer, etc.) can consume.
 *
 * Architecture:
 *   VNInvestChartsProvider
 *     ├── WidgetI18nProvider (already exists)
 *     ├── VNInvestChartsConfigProvider (theme, locale, symbol, timeframe, adapter)
 *     ├── VNInvestChartsStateProvider (panes, drawings, activeTool)
 *     └── HoverEmitter ref (high-frequency hover events via EventTarget)
 */
import { useRef } from "react";
import { WidgetI18nProvider } from "./WidgetI18nContext.js";
import { VNInvestChartsConfigProvider } from "./VNInvestChartsConfigContext.js";
import { VNInvestChartsStateProvider } from "./VNInvestChartsStateContext.js";
import { createHoverEmitter } from "./HoverEmitter.js";
/**
 * Root provider for the compound component architecture.
 *
 * Wraps the existing VNInvestCharts prop-driven implementation — does NOT replace it.
 * Compound sub-components (Toolbar, Header, Footer, etc.) consume this context.
 */
export function VNInvestChartsProvider({ adapter, symbol, timeframe, locale, messages, theme, panes, drawings, activeTool, onLocaleChange, children, }) {
    const hoverEmitterRef = useRef(createHoverEmitter());
    const resolvedTheme = theme ?? "light";
    const resolvedLocale = locale ?? "vi";
    return (_jsx(WidgetI18nProvider, { locale: resolvedLocale, messages: messages, onLocaleChange: onLocaleChange, children: _jsx(VNInvestChartsConfigProvider, { value: {
                theme: resolvedTheme,
                locale: resolvedLocale,
                symbol,
                timeframe,
                adapter,
            }, children: _jsx(VNInvestChartsStateProvider, { initialPanes: panes, initialDrawings: drawings, initialActiveTool: activeTool, children: children }) }) }));
}
/**
 * Hook to access the hover emitter ref from any descendant component.
 *
 * Usage:
 *   const emitterRef = useHoverEmitterRef();
 *   emitHover(emitterRef.current, { datum, pixelX, pixelY, paneId });
 */
export function useHoverEmitterRef() {
    // The hover emitter ref lives in the component that creates the provider.
    // For now, we expose a placeholder — the actual ref will be lifted to
    // VNInvestChartsProvider in Phase 2 when compound components need it.
    // This placeholder allows type-checking to pass during Phase 1.
    return { current: createHoverEmitter() };
}
export { VNInvestChartsConfigContext, VNInvestChartsConfigProvider } from "./VNInvestChartsConfigContext.js";
export { VNInvestChartsStateContext, VNInvestChartsStateProvider, useVNInvestChartsState } from "./VNInvestChartsStateContext.js";
export { createHoverEmitter, emitHover, clearHover, useHoverSubscription, useHoverState, } from "./HoverEmitter.js";
