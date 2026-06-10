/** All .vnsc- and .rsc- CSS content bundled as a single string. */
export const VNSC_CSS = `
.vnsc-root {
  --vnsc-bg-primary: #ffffff;
  --vnsc-bg-secondary: #f8fafc;
  --vnsc-surface: #ffffff;
  --vnsc-text: #1e293b;
  --vnsc-text-primary: #1e293b;
  --vnsc-text-secondary: #64748b;
  --vnsc-border: #e2e8f0;
  --vnsc-accent: #2962ff;
  --vnsc-up: #089981;
  --vnsc-down: #f23645;
  --vnsc-font-xs: 10px;
  --vnsc-font-sm: 11px;
  --vnsc-font-md: 12px;
  --vnsc-font-lg: 14px;
  --vnsc-radius-sm: 3px;
  --vnsc-radius-md: 4px;
  --vnsc-radius-lg: 6px;
  --vnsc-radius-xl: 8px;
  --vnsc-bg-tertiary: #f1f5f9;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;

  /* Bridge for legacy .rsc- indicators */
  --rsc-bg-primary: var(--vnsc-bg-primary);
  --rsc-bg-secondary: var(--vnsc-bg-secondary);
  --rsc-surface: var(--vnsc-surface);
  --rsc-text: var(--vnsc-text);
  --rsc-border: var(--vnsc-border);
  --rsc-accent: var(--vnsc-accent);
  --rsc-text-micro: var(--vnsc-text-secondary);
  --rsc-text-muted: var(--vnsc-text-secondary);
}
.vnsc-root[data-chart-theme="dark"] {
  --vnsc-bg-primary: #0a0e14;
  --vnsc-bg-secondary: #111820;
  --vnsc-bg-tertiary: #1e293b;
  --vnsc-surface: #0a0e14;
  --vnsc-text: #e0e0e0;
  --vnsc-text-primary: #e0e0e0;
  --vnsc-text-secondary: #a0a0a0;
  --vnsc-border: #2a2a2a;
}
.vnsc-drawing-toolbar { position: relative; height: 100%; width: 40px; min-width: 40px; flex-shrink: 0; z-index: 40; background: var(--vnsc-bg-secondary); border-right: 1px solid var(--vnsc-border); display: flex; flex-direction: column; align-items: center; padding: 4px 0; gap: 2px; overflow-x: hidden; overflow-y: auto; scrollbar-width: none; transition: width 0.2s ease, padding 0.2s ease, border-right-width 0.2s ease; }
.vnsc-drawing-toolbar-shell { position: absolute !important; left: 0 !important; top: 0 !important; bottom: 0 !important; width: 10px !important; pointer-events: none !important; z-index: 40 !important; transition: width 0.2s ease !important; }
.vnsc-drawing-toolbar-shell:hover, .vnsc-drawing-toolbar-shell:has(input:focus) { width: 40px !important; pointer-events: auto !important; }
.vnsc-drawing-toolbar { position: absolute !important; left: -40px !important; top: 0 !important; bottom: 0 !important; width: 40px !important; min-width: 40px !important; pointer-events: auto !important; z-index: 3 !important; transition: left 0.2s ease, box-shadow 0.2s ease, border-right-color 0.2s ease !important; border-right: 1px solid transparent !important; box-shadow: none !important; }
.vnsc-drawing-toolbar-shell:hover .vnsc-drawing-toolbar, .vnsc-drawing-toolbar:hover, .vnsc-drawing-toolbar-shell:has(input:focus .vnsc-drawing-toolbar), .vnsc-drawing-toolbar:has(input:focus) { left: 0 !important; box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15) !important; border-right-color: var(--vnsc-border) !important; }
.vnsc-drawing-toolbar-handle { display: flex; position: absolute; top: 50%; left: 0; width: 10px; height: 44px; transform: translateY(-50%); align-items: center; justify-content: center; border-radius: 0 var(--vnsc-radius-xl, 8px) var(--vnsc-radius-xl, 8px) 0; border: 1px solid var(--vnsc-border); border-left: none; background: linear-gradient(180deg, color-mix(in srgb, var(--vnsc-bg-primary) 92%, var(--vnsc-accent) 8%), color-mix(in srgb, var(--vnsc-bg-secondary) 88%, var(--vnsc-accent) 12%)); box-shadow: 6px 10px 22px rgba(15, 23, 42, 0.16); pointer-events: auto; opacity: 1; z-index: 2; transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; }
.vnsc-drawing-toolbar-handle::before { content: ""; width: 3px; height: 3px; border-radius: 999px; background: var(--vnsc-text-secondary); box-shadow: 0 -6px 0 var(--vnsc-text-secondary), 0 6px 0 var(--vnsc-text-secondary); }
.vnsc-drawing-toolbar-shell:hover .vnsc-drawing-toolbar-handle, .vnsc-drawing-toolbar-shell:focus-within .vnsc-drawing-toolbar-handle { box-shadow: 8px 12px 24px rgba(15, 23, 42, 0.2); }
.vnsc-ohlc-header { padding-left: 22px !important; transition: padding-left 0.2s ease !important; }
.vnsc-container:has(.vnsc-drawing-toolbar-shell:hover) .vnsc-ohlc-header, .vnsc-container:has(.vnsc-drawing-toolbar-shell:focus-within) .vnsc-ohlc-header { padding-left: 52px !important; }
.vnsc-container:has(.vnsc-drawing-toolbar-shell--collapsed) .vnsc-ohlc-header { padding-left: 12px !important; }
.vnsc-drawing-toolbar-shell--collapsed { width: 0 !important; pointer-events: none !important; }
.vnsc-drawing-toolbar-shell--collapsed .vnsc-drawing-toolbar-handle { display: none !important; }
.vnsc-drawing-toolbar--collapsed { width: 0 !important; min-width: 0 !important; padding: 0 !important; border-right: none !important; overflow: hidden !important; }
.vnsc-drawing-toolbar__expand-btn { transition: background-color var(--vnsc-transition-fast), color var(--vnsc-transition-fast), transform var(--vnsc-transition-fast); }
.vnsc-drawing-toolbar__expand-btn:hover { background-color: var(--vnsc-bg-tertiary, #f1f5f9) !important; color: var(--vnsc-text-primary) !important; transform: scale(1.05); }
.vnsc-drawing-toolbar::-webkit-scrollbar { display: none; }
.vnsc-drawing-toolbar__btn { display: flex; align-items: center; justify-content: center; gap: 3px; width: 32px; height: 26px; border: none; border-radius: 4px; background: transparent; color: var(--vnsc-text-secondary); cursor: pointer; transition: background 120ms ease, color 120ms ease; }
.vnsc-drawing-toolbar__btn:hover { background: var(--vnsc-bg-tertiary); color: var(--vnsc-text-primary); }
.vnsc-drawing-toolbar__btn svg { width: 15px; height: 15px; flex-shrink: 0; display: block; color: inherit; }
.vnsc-tools-chevron { font-size: 8px; color: var(--vnsc-text-secondary); opacity: 0.6; flex-shrink: 0; }
.vnsc-drawing-toolbar__btn--active { background: var(--vnsc-accent-bg, rgba(41, 98, 255, 0.12)); color: var(--vnsc-accent); }
.vnsc-drawing-toolbar__magnet { width: 32px; height: 26px; border: none; border-radius: 4px; background: transparent; color: var(--vnsc-text-secondary); cursor: pointer; font-size: 12px; font-weight: 700; transition: background 120ms ease, color 120ms ease; }
.vnsc-drawing-toolbar__magnet:hover { background: var(--vnsc-bg-tertiary); color: var(--vnsc-text-primary); }
.vnsc-splitter, .rsc-splitter { position: absolute; left: 0; right: 0; height: 24px; margin-top: -12px; cursor: row-resize; z-index: 12; pointer-events: auto; user-select: none; touch-action: none; display: flex; align-items: center; justify-content: center; }
.vnsc-splitter::after, .rsc-splitter::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: 2px; background: transparent; transition: background 0.15s, opacity 0.15s, height 0.1s; opacity: 0; }
.vnsc-splitter:hover::after, .vnsc-splitter--dragging::after, .rsc-splitter:hover::after, .rsc-splitter--dragging::after { background: var(--vnsc-accent, #2962ff); opacity: 1; height: 3px; }
.vnsc-splitter__handle, .rsc-splitter__handle { display: none !important; }
.vnsc-drawing-dock { position: absolute; right: 48px; top: 0; bottom: 0; width: 220px; z-index: 39; background: var(--vnsc-bg-secondary); border-right: 1px solid var(--vnsc-border); display: flex; flex-direction: column; font-size: 11px; color: var(--vnsc-text-primary); overflow: hidden; }
.vnsc-drawing-dock__header { display: flex; align-items: center; padding: 6px 8px; border-bottom: 1px solid var(--vnsc-border); gap: 4px; }
.vnsc-drawing-dock__title-block { display: flex; align-items: center; gap: 6px; flex: 1; }
.vnsc-drawing-dock__title-block strong { font-weight: 700; }
.vnsc-drawing-dock__title-block span { color: var(--vnsc-text-secondary); font-size: 10px; background: var(--vnsc-bg-tertiary); padding: 1px 4px; border-radius: 3px; }
.vnsc-drawing-dock__tabs { display: flex; gap: 2px; padding: 4px 8px; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-drawing-dock__tab { padding: 4px 8px; border: none; border-radius: 3px; background: transparent; color: var(--vnsc-text-secondary); cursor: pointer; font-size: 11px; font-weight: 600; }
.vnsc-drawing-dock__tab--active { background: var(--vnsc-accent); color: #fff; }
.vnsc-drawing-dock__body { flex: 1; overflow-y: auto; }
.vnsc-drawing-dock__empty { padding: 16px; text-align: center; color: var(--vnsc-text-muted); }
.vnsc-drawing-dock__icon { appearance: none; border: none; background: transparent; color: var(--vnsc-text-secondary); width: 24px; height: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; transition: color 120ms; }
.vnsc-drawing-dock__icon:hover { color: var(--vnsc-text-primary); }
.vnsc-drawing-dock__header-actions { display: flex; align-items: center; gap: 4px; }
.vnsc-ohlc-header { display: flex; align-items: center; gap: 12px; padding: 6px 12px; background: var(--vnsc-bg-secondary); border-bottom: 1px solid var(--vnsc-border); font-family: sans-serif; font-size: 12px; color: var(--vnsc-text-primary); }
.vnsc-timeframe-footer { display: flex; align-items: center; gap: 12px; padding: 4px 12px; background: var(--vnsc-bg-secondary); border-top: 1px solid var(--vnsc-border); flex-wrap: wrap; }
.vnsc-symbol-search { position: relative; }
.vnsc-symbol-search__input { padding: 6px 10px; border: 1px solid var(--vnsc-border); border-radius: 4px; background: var(--vnsc-bg-primary); color: var(--vnsc-text-primary); font-size: 12px; }
.vnsc-whale-panel { padding: 8px; font-size: 11px; color: var(--vnsc-text-primary); }
.vnsc-whale-panel__table { width: 100%; border-collapse: collapse; }
.vnsc-whale-panel__table th, .vnsc-whale-panel__table td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-whale-panel__buy { color: #089981; }
.vnsc-whale-panel__sell { color: #f23645; }
.vnsc-replay-bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--vnsc-bg-secondary); border-top: 1px solid var(--vnsc-border); z-index: 35; }
.vnsc-replay-bar__btn { background: transparent; color: var(--vnsc-text-secondary); border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 14px; }
.vnsc-replay-bar__btn:hover { background: var(--vnsc-bg-tertiary, #f1f5f9); color: var(--vnsc-text-primary); }
.vnsc-replay-bar__btn--primary { background: var(--vnsc-accent); color: #fff; font-weight: 700; }
.vnsc-replay-bar__sep { width: 1px; height: 16px; background: var(--vnsc-border); }
.vnsc-replay-bar__status { font-size: 11px; color: var(--vnsc-text-secondary); }
.vnsc-replay-bar__spacer { flex: 1; }
.vnsc-replay-bar__close { background: none; border: none; color: var(--vnsc-text-secondary); cursor: pointer; font-size: 16px; padding: 0 4px; }
.vnsc-replay-bar__label { font-size: 11px; color: var(--vnsc-text-secondary); }
.vnsc-replay-bar__select { background: transparent; color: var(--vnsc-text-primary); border: 1px solid var(--vnsc-border); border-radius: 3px; padding: 2px 4px; font-size: 11px; }
.vnsc-paper-trade-panel { position: relative; height: 100%; flex-shrink: 0; width: 280px; background: var(--vnsc-bg-primary); border-left: 1px solid var(--vnsc-border); z-index: 50; display: flex; flex-direction: column; font-size: 11px; color: var(--vnsc-text-primary); overflow: hidden; }
.vnsc-paper-trade-panel__header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-paper-trade-panel__title { font-size: 13px; font-weight: 700; }
.vnsc-paper-trade-panel__reset-btn { background: var(--vnsc-bg-tertiary); border: none; color: var(--vnsc-text-secondary); border-radius: 4px; cursor: pointer; padding: 4px 8px; font-size: 11px; font-weight: 600; transition: background var(--vnsc-transition-fast), color var(--vnsc-transition-fast); }
.vnsc-paper-trade-panel__reset-btn:hover { background: var(--vnsc-border); color: var(--vnsc-text-primary); }
.vnsc-paper-trade-panel__close-btn { appearance: none; border: none; background: transparent; color: var(--vnsc-text-secondary); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; padding: 0; transition: color 120ms; }
.vnsc-paper-trade-panel__close-btn:hover { color: var(--vnsc-text-primary); }
.vnsc-paper-trade-panel__stats { padding: 8px 12px; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-paper-trade-panel__stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.vnsc-paper-trade-panel__stat-label { font-size: 10px; color: var(--vnsc-text-secondary); }
.vnsc-paper-trade-panel__stat-value { font-weight: 700; font-size: 13px; }
.vnsc-paper-trade-panel__position { padding: 8px 12px; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-paper-trade-panel__position-title { font-weight: 700; margin-bottom: 4px; }
.vnsc-paper-trade-panel__position-side { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; }
.vnsc-paper-trade-panel__position-side--long { background: #089981; color: #fff; }
.vnsc-paper-trade-panel__position-side--short { background: #f23645; color: #fff; }
.vnsc-paper-trade-panel__position-entry { margin-top: 4px; color: var(--vnsc-text-secondary); }
.vnsc-paper-trade-panel__position-empty { color: var(--vnsc-text-secondary); }
.vnsc-paper-trade-panel__journal { flex: 1; overflow-y: auto; padding: 8px 12px; }
.vnsc-paper-trade-panel__journal-title { font-weight: 700; margin-bottom: 4px; }
.vnsc-paper-trade-panel__journal-empty { color: var(--vnsc-text-secondary); text-align: center; padding: 16px 0; }
.vnsc-paper-trade-panel__journal-item { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--vnsc-border); }
.vnsc-paper-trade-panel__journal-side { font-size: 10px; font-weight: 700; }
.vnsc-paper-trade-panel__journal-pnl { font-weight: 600; }
.vnsc-paper-trade-panel__journal-item--positive .vnsc-paper-trade-panel__journal-side { color: #089981; }
.vnsc-paper-trade-panel__journal-item--positive .vnsc-paper-trade-panel__journal-pnl { color: #089981; }
.vnsc-paper-trade-panel__journal-item--negative .vnsc-paper-trade-panel__journal-side { color: #f23645; }
.vnsc-paper-trade-panel__journal-item--negative .vnsc-paper-trade-panel__journal-pnl { color: #f23645; }

/* ─── Settings Modal Styling ─── */
.vnsc-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(2, 6, 23, 0.58);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.vnsc-settings-modal {
  width: min(980px, calc(100% - 32px));
  max-height: min(88vh, 860px);
  display: flex;
  flex-direction: column;
  background: var(--vnsc-bg-primary);
  border: 1px solid var(--vnsc-border);
  border-radius: 8px;
  box-shadow: 0 20px 52px rgba(2, 6, 23, 0.44);
  overflow: hidden;
  position: relative;
}
.vnsc-settings-modal__header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--vnsc-border);
  background: var(--vnsc-bg-secondary);
}
.vnsc-settings-modal__title {
  margin: 0;
  color: var(--vnsc-text-primary);
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
}
.vnsc-settings-modal__close {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  appearance: none;
  border: 1px solid var(--vnsc-border);
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: transparent;
  color: var(--vnsc-text-secondary);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  z-index: 10;
}
.vnsc-settings-modal__close:hover {
  background: var(--vnsc-bg-primary);
  border-color: var(--vnsc-border);
  color: var(--vnsc-text-primary);
}
.vnsc-settings-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--vnsc-border);
  background: var(--vnsc-bg-secondary);
}
.vnsc-settings-tab {
  appearance: none;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vnsc-text-secondary);
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.vnsc-settings-tab:hover {
  background: var(--vnsc-bg-primary);
  color: var(--vnsc-text-primary);
}
.vnsc-settings-tab--active {
  background: var(--vnsc-accent);
  color: #fff;
}
.vnsc-settings-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--vnsc-bg-primary);
}
.vnsc-settings-pane-list, .vnsc-settings-series-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.vnsc-settings-series {
  padding: 16px;
  background: var(--vnsc-bg-secondary, #111820);
  border: 1px solid var(--vnsc-border, #2a2a2a);
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.vnsc-settings-series__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.vnsc-settings-series__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--vnsc-text-primary);
}
.vnsc-settings-series__meta {
  font-size: 12px;
  color: var(--vnsc-text-secondary);
  margin-top: 4px;
}
.vnsc-settings-series__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.vnsc-settings-pane__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}
.vnsc-tag {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--vnsc-text-primary);
  background: var(--vnsc-bg-primary, #0a0e14);
  border: 1px solid var(--vnsc-border, #2a2a2a);
  border-radius: 6px;
  padding: 4px 10px;
  white-space: nowrap;
}
.gc-settings-slider-shell {
  width: 100%;
  margin: 8px 0;
}
.gc-settings-range {
  width: 100%;
  margin: 0;
  cursor: pointer;
}
.gc-settings-slider-steps {
  position: relative;
  width: 100%;
  height: 16px;
  margin-top: 4px;
}
.gc-settings-slider-steps__label {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--vnsc-text-secondary, #888);
  white-space: nowrap;
}
.gc-settings-slider-steps__label--active {
  color: var(--vnsc-accent, #2962ff);
  font-weight: bold;
}
.gc-settings-slider-steps__current {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: bold;
  color: var(--vnsc-accent, #2962ff);
  white-space: nowrap;
}
.gc-settings-slider-readout {
  position: relative;
  width: 100%;
  height: 16px;
  margin-top: 4px;
}
.gc-settings-slider-readout__edge {
  position: absolute;
  font-size: 10px;
  color: var(--vnsc-text-secondary, #888);
}
.gc-settings-slider-readout__edge:first-child {
  left: 0;
}
.gc-settings-slider-readout__edge:nth-child(2) {
  right: 0;
}
.gc-settings-slider-readout__current {
  position: absolute;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: bold;
  color: var(--vnsc-accent, #2962ff);
}


.vnsc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vnsc-border);
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  padding: 8px 16px;
  background: var(--vnsc-bg-secondary);
  color: var(--vnsc-text-primary);
  transition: background 120ms ease, border-color 120ms ease;
  white-space: nowrap;
}
.vnsc-btn:hover {
  background: var(--vnsc-bg-tertiary);
  border-color: var(--vnsc-text-secondary);
}
.vnsc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.vnsc-btn--accent {
  background: var(--vnsc-accent) !important;
  color: #fff !important;
  border: none !important;
}
.vnsc-btn--accent:hover {
  background: color-mix(in srgb, var(--vnsc-accent) 85%, #fff) !important;
}
.vnsc-btn--danger {
  background: #f44336 !important;
  color: #fff !important;
  border: none !important;
}
.vnsc-btn--danger:hover {
  background: #d32f2f !important;
}
.vnsc-chip { padding: 3px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
.vnsc-chip--active { background: var(--vnsc-accent); color: #fff; }
.vnsc-sep { width: 1px; height: 16px; background: var(--vnsc-border); }

/* ─── Pinned / Legacy Overlays ─── */
.vnsc-pane-header, .rsc-pane-header { position: absolute; top: 0; left: 11px; right: 8px; height: 24px; display: flex; align-items: center; justify-content: flex-start; gap: 4px; padding: 0; background: transparent; border-bottom: none; opacity: 0; pointer-events: none; transition: opacity 150ms ease; z-index: 50; min-width: 0; }
.vnsc-pane-wrap:hover .vnsc-pane-header, .vnsc-pane-wrap:focus-within .vnsc-pane-header, .vnsc-pane-wrap--active .vnsc-pane-header, .rsc-pane-wrap:hover .rsc-pane-header, .rsc-pane-wrap:focus-within .rsc-pane-header, .rsc-pane-wrap--active .rsc-pane-header { opacity: 1; pointer-events: auto; }
.vnsc-pane-header__label, .rsc-pane-header__label { display: inline-flex; align-items: center; min-height: 20px; padding: 0 8px; border-radius: 999px; background: color-mix(in srgb, var(--vnsc-surface, #ffffff) 86%, transparent); border: 1px solid color-mix(in srgb, var(--vnsc-border, rgba(148, 163, 184, 0.24)) 100%, transparent); box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); font-size: 10px; font-weight: 600; letter-spacing: 0.02em; color: var(--vnsc-text, #1e2a3b); flex-shrink: 0; }
.vnsc-pane-header__content, .rsc-pane-header__content { display: flex; align-items: center; min-width: 0; flex: 1 1 auto; overflow: hidden; }
.vnsc-pane-header__actions, .rsc-pane-header__actions { display: inline-flex; align-items: center; gap: 4px; min-height: 20px; padding: 0 5px; border-radius: 999px; background: color-mix(in srgb, var(--vnsc-surface, #ffffff) 86%, transparent); border: 1px solid color-mix(in srgb, var(--vnsc-border, rgba(148, 163, 184, 0.24)) 100%, transparent); box-shadow: 0 6px 18px rgba(15, 23, 42, 0.10); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); margin-left: auto; flex-shrink: 0; }

.vnsc-root, .vnsc-root input, .vnsc-root select, .vnsc-root textarea, .vnsc-root button { font-family: var(--gc-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif) !important; }
.vnsc-sidebar-splitter { position: relative; width: 4px; height: 100%; cursor: col-resize; z-index: 49; background: transparent; transition: background var(--vnsc-transition-fast); }
.vnsc-sidebar-splitter:hover { background: var(--vnsc-accent, #2962ff) !important; }
.vnsc-sidebar-right { display: flex; flex-direction: column; height: 100%; background: var(--vnsc-bg-secondary); border-left: 1px solid var(--vnsc-border); position: relative; z-index: 48; min-width: 150px; overflow-y: auto; }
.vnsc-sidebar-right .vnsc-drawing-dock, .vnsc-sidebar-right .vnsc-paper-trade-panel, .vnsc-sidebar-right .vnsc-advisory-panel, .vnsc-sidebar-right .vnsc-tape-panel { position: relative !important; top: auto !important; bottom: auto !important; right: auto !important; left: auto !important; width: 100% !important; height: auto !important; flex: 1 1 0% !important; min-height: 140px !important; border-left: none !important; border-right: none !important; z-index: auto !important; background: transparent !important; }
.vnsc-sidebar-right > div:not(:last-child) { border-bottom: 1px solid var(--vnsc-border) !important; }

/* ─── Legacy .rsc- indicator legend overlay styles ─── */
.rsc-indicator-legend {
  position: absolute;
  top: 24px;
  left: 60px;
  right: 68px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 150ms ease;
  z-index: 15;
}
.rsc-pane-header__legend {
  position: static;
  top: auto;
  left: auto;
  right: auto;
  flex: 1 1 auto;
  min-width: 0;
  align-items: center;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  gap: 3px;
  padding: 0;
  opacity: 1;
  pointer-events: auto;
  transition: none;
  z-index: auto;
  scrollbar-width: none;
}
.rsc-pane-header__legend::-webkit-scrollbar {
  display: none;
}
.rsc-pane-wrap:hover .rsc-indicator-legend,
.rsc-pane-wrap:focus-within .rsc-indicator-legend,
.rsc-pane-wrap--active .rsc-indicator-legend {
  opacity: 1;
  pointer-events: auto;
}
.rsc-indicator-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px 1px 4px;
  border-radius: 4px;
  background: var(--rsc-surface, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--rsc-border, rgba(148, 163, 184, 0.24));
  font-size: 9px;
  font-weight: 500;
  color: var(--rsc-text, #1e2a3b);
  cursor: default;
  user-select: none;
  white-space: nowrap;
}
.rsc-indicator-chip--hidden {
  opacity: 0.45;
}
.rsc-indicator-chip__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--chip-color, #2962ff);
  flex-shrink: 0;
}
.rsc-indicator-chip__name {
  white-space: nowrap;
}
.rsc-indicator-chip__btn {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0 1px;
  cursor: pointer;
  font-size: 10px;
  line-height: 1;
  border-radius: 2px;
  display: flex;
  align-items: center;
}
.rsc-indicator-chip__btn:hover {
  background: rgba(148, 163, 184, 0.18);
}
.rsc-indicator-chip__btn--remove {
  opacity: 0.5;
}
.rsc-indicator-chip__btn--remove:hover {
  opacity: 1;
  color: #f23645;
  background: rgba(242, 54, 69, 0.08);
}
.rsc-pane-label {
  position: absolute;
  left: 0;
  width: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--rsc-text-micro, #7c8798);
  pointer-events: none;
  user-select: none;
  z-index: 10;
}
.rsc-pane-btn {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 1px 3px;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
  line-height: 1;
}
.rsc-pane-btn:hover {
  background: rgba(148, 163, 184, 0.18);
}
.rsc-pane-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ─── Dark Flow Strength Badge ─── */
.gc-darkflow-badge {
  position: absolute;
  top: 8px;
  right: 76px; /* clear the y-axis */
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  pointer-events: auto;
  z-index: 55; /* higher than .vnsc-pane-header's 50 to prevent overlap bleed, but still neat */
  background: var(--vnsc-bg-secondary, #111820);
  color: var(--vnsc-text-primary, #e0e0e0);
  border: 1px solid var(--vnsc-border, #2a2a2a);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.gc-darkflow-badge__label {
  opacity: 0.7;
  font-weight: 500;
  text-transform: uppercase;
  font-size: 9px;
  letter-spacing: 0.05em;
}

.gc-darkflow-badge__strength {
  font-size: 12px;
  font-weight: 700;
}

.gc-darkflow-badge__tier {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  text-transform: uppercase;
}

.gc-darkflow-badge__sig {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  background: var(--vnsc-accent, #2962ff);
  color: #fff;
  text-transform: uppercase;
}

.gc-darkflow-badge--strong {
  border-color: rgba(242, 54, 69, 0.4);
}
.gc-darkflow-badge--strong .gc-darkflow-badge__tier {
  background: rgba(242, 54, 69, 0.15);
  color: #f23645;
}

.gc-darkflow-badge--mid {
  border-color: rgba(59, 130, 246, 0.4);
}
.gc-darkflow-badge--mid .gc-darkflow-badge__tier {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.gc-darkflow-badge--low {
  border-color: rgba(245, 158, 11, 0.35);
}
.gc-darkflow-badge--low .gc-darkflow-badge__tier {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.gc-darkflow-badge--none {
  border-color: var(--vnsc-border);
}
.gc-darkflow-badge--none .gc-darkflow-badge__tier {
  background: var(--vnsc-bg-tertiary);
  color: var(--vnsc-text-secondary);
}
`;

/** Inject widget CSS into <head> if not already present. */
export function injectVNInvestChartsCSS() {
    if (typeof document === "undefined")
        return;
    if (document.querySelector("[data-vnsc-css-injected]"))
        return;
    const style = document.createElement("style");
    style.setAttribute("data-vnsc-css-injected", "true");
    style.textContent = VNSC_CSS;
    document.head.appendChild(style);
}

// Auto-inject on module load
injectVNInvestChartsCSS();
