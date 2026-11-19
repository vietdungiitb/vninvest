---
name: VNInvest Web — SOC Operations
description: Dark-first trading cockpit: glass panels, dense tabular data, Bloomberg-aligned gain/loss semantics.
colors:
  accent-cyan: "#06b6d4"
  accent-cyan-light: "#0e7490"
  surface-base: "#0b1424"
  surface-panel: "#0f172a"
  text-primary: "#f1f5f9"
  text-muted: "#94a3b8"
  text-muted-light: "#475569"
  gain: "#34d399"
  loss: "#f87171"
  glass-dark: "rgba(15, 23, 42, 0.72)"
  glass-light: "rgba(255, 255, 255, 0.88)"
typography:
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, Menlo, Consolas, monospace"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  page-chrome:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "1rem 1.5rem"
  metric-card:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
---

# Design System: VNInvest Web — SOC Operations

## Overview

**Creative North Star: "The Trading Cockpit"**

Một buồng lái giao dịch: nền tối, mật độ thông tin cao, panel kính mờ xếp lớp, và dữ liệu là nhân vật chính. Mọi quyết định thị giác phục vụ việc quét nhanh bảng số — trang trí chỉ xuất hiện khi nó mang nghĩa (badge trạng thái, đường viền phân vùng). Dark là mặc định; light là tuỳ chọn bị kiểm soát chặt (chỉ bật ở dev/staging để chụp ảnh QA).

**Key Characteristics:**
- Dark-first, glassmorphism có chủ đích (panel nổi dùng nền đục, thẻ dùng kính).
- Màu chỉ dùng cho trạng thái tài chính và trạng thái hệ thống.
- Tabular figures cho mọi cột số; mono cho ticker/mã.
- Light theme không được phép làm sai quy ước tăng/giảm.

## Colors

Bảng màu gồm một accent cyan duy nhất, hai sắc tăng/giảm cố định, và thang trung tính xám xanh.

### Primary
- **Accent Cyan** (`#06b6d4`; light `#0e7490`): tab active, link, focus ring, điều khiển có chủ đích.

### Neutral
- **Surface Base** (`#0b1424`): nền trang.
- **Surface Panel** (`#0f172a`): nền thẻ/khung.
- **Text Primary** (`#f1f5f9`) / **Text Muted** (`#94a3b8`; light `#475569`): nhãn và nội dung phụ.
- **Glass Dark** (`rgba(15,23,42,0.72)`) / **Glass Light** (`rgba(255,255,255,0.88)`): panel/header dùng chung.

### Named Rules
**The Bloomberg Rule.** Xanh (`--pf-gain` `#34d399`) = **tăng**, đỏ (`--pf-loss` `#f87171`) = **giảm** — chuẩn Việt Nam/Bloomberg. Không đổi chiều, không tuỳ market privacy (Owner chốt 2026-10-13, L-F08).

**The One Accent Rule.** Accent cyan chỉ chiếm ≤10% diện tích màn hình; phần còn lại là trung tính.

## Typography

**Display/Body Font:** Inter (fallback Segoe UI, system-ui). **Mono:** JetBrains Mono (fallback Menlo, Consolas).

**Character:** Sans trung tính cho câu chữ; mono/tabular cho số và mã để cột khớp nhau khi quét.

### Hierarchy
- **Title** (700, 1.5rem/1.2): tiêu đề trang do `ShellPageChrome` render (1 `<h1>`/route).
- **Body** (400, 0.875rem): nội dung, giá trị thẻ.
- **Label** (600, 0.68rem, letter-spacing 0.05em, uppercase): nhãn metric, tab.
- **Numeric** (tabular-nums): mọi bảng số, P&L, giá.

## Layout

Container content tối đa `--layout-content-max-width: 80rem`; padding dọc/ngang `--sp-6: 1.5rem`. Shell gồm 1 header (eyebrow → title → description → actions) + metrics + children. Dock phải là hub 1 tab chính với 6 sub-tab (13 tab riêng sẽ tràn thanh 32px desktop/44px mobile). Breakpoint: 1280px (metric 4 cột), 768px (2 cột), 480px (1 cột).

## Elevation & Depth

Hybrid: kính + viền 1px alpha thấp cho panel ở trạng thái nghỉ; shadow chỉ khi nổi (hover/drawer/modal). Bóng dùng `--shadow-sm` `0 2px 8px`, `--shadow-md` `0 8px 20px`. Modal/drawer phải **đục** (`--bg-panel-solid`), không dùng kính 40% — nếu không chữ trang phía sau lộ qua.

## Shapes

Bo góc có chủ đích: `--r-sm` 6px control nhỏ, `--r-md` 8px thẻ/metric, `--r-lg` 12px panel chính, `--r-pill` 999px badge/trạng thái. Viền mặc định `rgba(80,120,168,0.15)`; viền đậm `rgba(80,120,168,0.25)`.

## Components

### Page Chrome
`ShellPageChrome` là chrome duy nhất: hero kính, 1 `<h1>`, `actions` ở titleRow. Page không tự render heading.

### Metric Card
Nền kính `--bg-panel`, border alpha thấp, label 0.65rem uppercase, value 1.15rem tabular-nums. Hover nâng 1.5px đổi border — không đổi màu chữ.

### Buttons / Focus
Primary dùng accent; ghost dùng border trung tính. `focus:outline-none` **luôn** đi kèm ring thay thế (`focus-visible:ring-2 ring-cyan-400`). Reduced-motion được tôn trọng toàn cục tại `src/index.css`.

### Freshness Badge
Pill với `data-state` = `fresh|delayed|stale|empty` và `data-note` giải thích lý do. Không bao giờ dùng màu một mình để biểu thị trạng thái.

## Do's and Don'ts

### Do:
- **Do** dùng token (`soc.tokens.css`, `theme/tokens.css`) — mọi giá trị mới phải đi qua owner và allowlist `check-tokens.mjs`.
- **Do** deep-link filter/sort/page qua `useUrlState`.
- **Do** gắn `data-reason`/`data-note` khi dữ liệu thiếu hoặc trễ.

### Don't:
- **Don't** đổi màu tăng/giảm (L-F08), kể cả khi "chuẩn khác" nói ngược lại.
- **Don't** dùng `soc.module.css` để chứa token/class — đó là barrel 3 dòng.
- **Don't** thêm token hex ngoài allowlist hoặc nâng baseline gate để làm xanh giả.
