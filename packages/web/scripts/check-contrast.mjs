#!/usr/bin/env node
// Gate — WCAG contrast for Admin Console tone pairs (Slice 1 F1 / C11).
// Every text/background pair used by adminTone.ts pills must reach >= 4.5:1
// (WCAG AA normal text) in BOTH modes. The pre-fix dark-only tones
// (e.g. emerald-200 on white ≈ 1.3:1) failed this gate.
import process from "node:process";

function luminance(hex) {
  const c = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => x - y);
  return (b + 0.05) / (a + 0.05);
}

const WHITE = "#ffffff";
const SLATE_900 = "#0f172a";
const SLATE_100 = "#f1f5f9";
const MIN = 4.5;

// [name, light-fg, light-bg, dark-fg, dark-bg] — mirrors adminTone.ts
const pairs = [
  ["emerald", "#047857", WHITE, "#a7f3d0", SLATE_900],
  ["amber", "#b45309", WHITE, "#fde68a", SLATE_900],
  ["rose", "#be123c", WHITE, "#fecdd3", SLATE_900],
  ["sky", "#0369a1", WHITE, "#bae6fd", SLATE_900],
  ["cyan", "#0e7490", WHITE, "#a5f3fc", SLATE_900],
  ["violet", "#6d28d9", WHITE, "#ddd6fe", SLATE_900],
  ["slate", "#334155", SLATE_100, "#e2e8f0", SLATE_900],
];

let failed = 0;
for (const [name, lfg, lbg, dfg, dbg] of pairs) {
  const light = ratio(lfg, lbg);
  const dark = ratio(dfg, dbg);
  const ok = light >= MIN && dark >= MIN;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "✓" : "✗"} ${name}: light ${light.toFixed(2)}:1, dark ${dark.toFixed(2)}:1 (min ${MIN}:1)`,
  );
}

if (failed > 0) {
  console.error(`✗ check:contrast — FAIL: ${failed} tone pair(s) below WCAG AA`);
  process.exit(1);
}
console.log(`✓ check:contrast — PASS (${pairs.length} tone pairs × 2 modes >= ${MIN}:1)`);
