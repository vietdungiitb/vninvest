// W1-0: WCAG contrast ratios for the light palette (evidence).
function lum(h) {
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const x = lum(a), y = lum(b);
  return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2);
}
const pairs = [
  ['text-prim/dark-bg', 'f1f5f9', '0f172a'],
  ['text-prim/light-bg', '0f172a', 'ffffff'],
  ['muted/light-bg', '64748b', 'ffffff'],
  ['secondary/light-bg', '334155', 'ffffff'],
  ['emerald-deep/light-bg', '047857', 'ffffff'],
  ['cyan-deep/light-bg', '0e7490', 'ffffff'],
  ['rose-deep/light-bg', 'dc2626', 'ffffff'],
  ['amber-deep/light-bg', 'b45309', 'ffffff'],
  ['purple-deep/light-bg', '7e22ce', 'ffffff'],
  ['cyan-on-dark', '22d3ee', '0f172a'],
  ['emerald-on-dark', '34d399', '0f172a'],
];
for (const [n, a, b] of pairs) console.log(`${n}: ${ratio(a, b)}`);
