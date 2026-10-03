# W1-0 — Light palette decision (thay designer sign-off, số liệu đính kèm)

## Nguyên tắc
- Accent hues giữ nguyên trên dark; bản "deep" cho light (text/status trên nền sáng).
- Decorative (gradient glow, borders mờ) được đổi giá trị nhưng không yêu cầu contrast text.
- Type scale + spacing + radius KHÔNG đổi theo theme.

## Contrast đo thật (`contrast-calc.mjs`, WCAG AA ≥4.5)
- text-prim/dark-bg 16.30 · text-prim/light-bg 17.85 · secondary/light 10.35 · muted/light 4.76 · emerald-deep 5.48 · cyan-deep 5.36 · rose-deep 4.83 · amber-deep 5.02 · purple-deep 6.98 · cyan-on-dark 9.88 · emerald-on-dark 9.29. **Tất cả PASS.**

## Mapping light
- Nền tối → bề mặt sáng: `0b0f19/111827/070a13/040b23/030712/020b23/081734/0f172a/0b1528` → `#ffffff/#f8fafc/#f1f5f9` (mức độ theo alpha gốc).
- Chữ sáng → chữ tối: `#fff/f1f5f9` → `#0f172a`; `#cbd5e1` → `#475569`; muted giữ `#64748b/#94a3b8`.
- Accent text/status → bản deep: cyan `#0e7490`, emerald `#047857`, rose `#dc2626`, amber `#b45309`, purple `#7e22ce` (+rgb triplets tương ứng).
- Border/shadow mờ tối → `rgba(15,23,42,…)` cùng alpha.

## Quyết định C3 (alias value-preserving)
Giữ cấu trúc alias, override giá trị dưới `[data-theme="light"]` — diff nhỏ, dark pixel-identical, TSX dùng `var(--soc-c-*)` tự adapt. Semantic rename toàn diện hoãn (follow-up, cần codemod + duyệt từng file).
