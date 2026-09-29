# MASTER HANDOFF: UI STANDARDIZATION & HIGH-DENSITY LAYOUT REFACTOR
**Date:** 2026-04-27
**Target:** Replace disparate page layouts with a unified `ModernTradingLayout` architecture.

## 1. Executive Summary
This document dictates the architectural transition from fragmented UI layouts across various pages to a unified, high-density Trading Layout system inspired by `ModernDashboard.jsx`. The goal is to maximize data visibility without scrolling, eliminate whitespace common in generic admin templates, and enforce strict TailwindCSS Design Tokens.

## 2. Core Architecture: `ModernTradingLayout`
The new root component for all authenticated views.
- **Header Slot:** Fixed top, ultra-compact (h-14 or smaller).
- **Main Content Slot (Left/Center):** Occupies flex-1 or 2/3 width on `xl` screens. Contains primary charts, data grids, and interactive elements.
- **Auxiliary Sidebar Slot (Right):** Occupies 1/3 width on `xl` screens. Contains AI Advisory, Alerts, News, or Contextual Filters. Can be toggled or hidden based on page needs.

## 3. Strict Design Tokens (Tailwind)

### 3.1. Backgrounds & Surfaces
- **App Background:** `bg-slate-950`
- **Panel/Card Surface:** `bg-slate-900/30` to `bg-slate-900/50` (Glassmorphism base)
- **Panel Borders:** `border border-slate-800/50`
- **Hover States:** `hover:border-slate-700/80 hover:bg-slate-800/40`

### 3.2. Spacing & Density
- **Global Padding:** Panels must use `p-3` or `p-4`. DO NOT use `p-6` or `p-8` to preserve high density.
- **Gap:** Grid gaps must be `gap-3` or `gap-4`.
- **Text Sizing:** 
  - Standard data: `text-[11px]` or `text-xs`
  - Headers: `text-sm font-bold uppercase tracking-wider`
  - Values: `text-sm` to `text-base font-medium` (No massive fonts).

### 3.3. Typography Colors
- **Primary Text:** `text-slate-200`
- **Secondary/Muted Text:** `text-slate-400`
- **Accent (Bullish):** `text-cyan-400` or `text-green-400`
- **Accent (Bearish):** `text-rose-400` or `text-red-400`
- **Borders/Dividers:** `border-slate-700/50`

## 4. Hard Constraints for Migration
1. **NO EXTERNAL TEMPLATES:** Do not install Bootstrap, StarAdmin, or Material-UI. Rely 100% on Tailwind.
2. **MAINTAIN IMMUTABILITY:** When migrating components (e.g., `WhaleBubbleChart`), do not alter their internal business logic. Only modify their container wrappers.
3. **RESPONSIVE DEGRADATION:** Right sidebars must collapse to the bottom or be hidden behind a drawer on mobile (`< lg` screens).
