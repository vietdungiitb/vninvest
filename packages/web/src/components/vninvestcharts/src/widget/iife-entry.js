/**
 * WP-10/11: IIFE entry point for <script> tag embedding.
 *
 * This is the standalone bundle that exposes `window.VNInvestCharts`.
 * It bundles React, ReactDOM, d3, and all widget components.
 * CSS is auto-injected into <head> on load.
 */
// Re-export everything from the main widget index
export * from "./index.js";
// Also re-export adapters for convenience
export * from "./adapters/index.js";

// ── Auto-inject CSS on load (WP-11) ──────────────────────────────────
import { injectVNInvestChartsCSS } from "./injectStyles.js";
injectVNInvestChartsCSS();
