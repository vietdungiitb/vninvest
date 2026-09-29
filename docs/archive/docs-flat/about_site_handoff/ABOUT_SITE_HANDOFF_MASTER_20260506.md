# HANDOFF MASTER — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Phiên bản**: 1.0  
**Phạm vi**: `packages/opencore-site` — public marketing & documentation site cho VNInvest ecosystem

---

## 1. Bối cảnh và mục tiêu

VNInvest SaaS (`vninvest.edusuccess.vn`) hiện tại đi thẳng vào màn hình login — không có landing page. Người dùng mới tìm thấy **vnbroker** (Python library) trên Google/GitHub, muốn thử app, nhưng không biết SaaS tồn tại. **Conversion funnel đang bị bỏ ngỏ hoàn toàn**.

About Site là trang public giới thiệu 3 sản phẩm trong VNInvest ecosystem:
1. **VNInvest** — SaaS portfolio tracker & robo-advisor
2. **vnbroker** — Python library truy xuất dữ liệu thị trường Việt Nam
3. **VNBrokerCharts** — thư viện biểu đồ kỹ thuật tự phát triển (React 19 + D3 v7), whale bubbles, CVD, drawing tools

Domain: `about.vninvest.edusuccess.vn`  
Ngôn ngữ: Tiếng Việt + English (toggle, default VI)

---

## 2. Kiến trúc tổng thể

```
about.vninvest.edusuccess.vn
         │
   nginx-proxy (đã có trên server)
         │  VIRTUAL_HOST=about.vninvest.edusuccess.vn
         ▼
  vninvest-opencore-site:3000  (Docker container, GHCR image)
  packages/opencore-site  (Next.js 15, App Router)
         │
         ├── /api/public/chart-demo/     ─► backend (data thật cho chart demo)
         ├── /api/public/vnbroker-data/   ─► backend (proxy cho Pyodide playground)
         └── /api/public/legal-pages/   ─► backend (terms, privacy đã có)

  (tất cả /api/* calls đi qua nginx → core-api → legacy proxy → backend)
  (same origin với vninvest.edusuccess.vn về infra, khác subdomain)
```

---

## 3. Cấu trúc package

```
packages/opencore-site/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx          ← root layout (dark theme, i18n provider)
│   │   │   ├── page.tsx            ← / (Ecosystem landing)
│   │   │   ├── chart/
│   │   │   │   ├── page.tsx        ← /chart (VNBrokerCharts live demo)
│   │   │   │   ├── docs/page.tsx   ← /chart/docs (component API docs)
│   │   │   │   └── embed/page.tsx  ← /chart/embed (embed code generator)
│   │   │   ├── vnbroker/
│   │   │   │   ├── page.tsx        ← /vnbroker (library overview)
│   │   │   │   └── playground/page.tsx ← /vnbroker/playground (Pyodide)
│   │   │   ├── pricing/page.tsx    ← /pricing (SaaS plans + CTA)
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx        ← /blog (article list)
│   │   │   │   └── [slug]/page.tsx ← /blog/:slug (MDX article)
│   │   │   └── legal/page.tsx      ← /legal (terms, privacy)
│   │   ├── api/
│   │   │   └── health/route.ts     ← GET /api/health (healthcheck)
│   │   ├── globals.css
│   │   └── i18n.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopNav.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── LangToggle.tsx
│   │   ├── sections/
│   │   │   ├── HeroSection.tsx
│   │   │   ├── ProductCards.tsx
│   │   │   ├── FeatureGrid.tsx
│   │   │   ├── ChartDemo.tsx       ← dùng VNBrokerChart + DemoAdapter → Next.js proxy /api/bars/
│   │   │   ├── PricingTable.tsx
│   │   │   └── PlaygroundPanel.tsx ← Pyodide runner
│   │   └── ui/                     ← shadcn-style primitives
│   ├── lib/
│   │   ├── api.ts                  ← fetch wrapper cho /api/public/*
│   │   ├── pyodide.ts              ← Pyodide loader (lazy)
│   │   └── demoAdapter.ts          ← DemoAdapter extends DjangoVnbrokerAdapter, baseUrl='' (proxy local)
│   ├── messages/
│   │   ├── vi.json                 ← tất cả text VI
│   │   └── en.json                 ← tất cả text EN
│   └── content/
│       └── blog/                   ← MDX articles
│           ├── vninvest-intro.mdx
│           ├── vnbroker-quickstart.mdx
│           └── vnbrokerchart-whale.mdx
├── public/
│   ├── og-image.png
│   ├── logo.svg
│   └── favicon.ico
├── Dockerfile
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Stack kỹ thuật

| Layer | Technology | Lý do |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSG/ISR cho SEO, server components, i18n routing |
| Language | TypeScript | Consistency với packages/web |
| Styling | Tailwind CSS v4 | Shared config pattern với packages/web |
| i18n | next-intl 3.x | Dynamic locale routing `[locale]/` |
| Blog content | MDX + `@next/mdx` | Markdown với React components |
| Chart demo | `vnbrokercharts` (React 19 + D3 v7) | Thư viện tự phát triển tại `C:\Mujoco Projects\react-stockcharts-master`, package name `vnbrokercharts`, export chính `VNBrokerChart` + `WhaleBubbleOverlay` + `DjangoVnbrokerAdapter` |
| Python playground | Pyodide 0.26 | Client-side WASM, zero server cost, secure |
| Package manager | npm | Consistent với workspace |

---

## 5. Pages và nội dung

### 5.1 `/` — Ecosystem Landing
- Hero section: tagline "Hệ sinh thái dữ liệu chứng khoán Việt Nam"
- 3 product cards: VNInvest SaaS / vnbroker library / VNBrokerChart
- Feature highlights: whale analytics, real-time data, AI advisory
- Stats: số symbols, số người dùng, data latency
- CTA primary: "Dùng thử miễn phí" → `https://vninvest.edusuccess.vn/register`
- CTA secondary: "Xem bảng giá" → `/pricing`

### 5.2 `/chart` — VNBrokerCharts Live Demo
- Render `<VNBrokerChart>` component từ package `vnbrokercharts` (local workspace dep)
- Adapter: `DemoAdapter` (extends `DjangoVnbrokerAdapter`, baseUrl=`''`) gọi Next.js proxy routes `/api/bars/[symbol]/`
- Next.js proxy routes gọi lại backend VNInvest, áp dụng symbol whitelist + rate limit trước khi forward
- Whale events overlay: `<WhaleBubbleOverlay>` nhận data từ `GET /api/public/whale-events/?symbol=`
- Symbol selector: whitelist 10 symbols phổ biến `[VNM, FPT, VHM, ACB, TCB, MBB, VCB, HPG, SSI, VND]`
- Toggle panes: whale bubbles, CVD, volume — qua `panes` prop của `VNBrokerChart`
- "Nhúng vào dự án của bạn" → link tới `/chart/embed`

### 5.3 `/chart/docs` — Component API Documentation
- Props table thực tế từ `VNBrokerChartProps`:
  - `adapter: StockDataAdapter` — bắt buộc, implement `fetchBars`, `subscribeToBar`, `subscribeToTrades`
  - `symbol: string` — mã CK
  - `timeframe: Timeframe` — `'1m'|'5m'|'15m'|'1h'|'4h'|'1d'`
  - `theme: ChartTheme` — `'dark'|'light'`
  - `panes: PaneDescriptor[]` — cấu hình panels (price/volume/CVD/RSI...)
  - `locale: WidgetLocale` — `'vi'|'en'`
  - `onVisibleRangeChange`, `onClick`, `onError` callbacks
- Install guide: `npm install vnbrokercharts`
- Usage examples với `DjangoVnbrokerAdapter` và `MockAdapter`

### 5.4 `/chart/embed` — Embed Code Generator
- Live form: chọn symbol, height, theme
- Realtime preview iframe
- Copy-paste code snippet

### 5.5 `/vnbroker` — Library Overview
- Giới thiệu, install (`pip install vnbroker`)
- Quick examples (static code blocks)
- Link tới playground

### 5.6 `/vnbroker/playground` — Pyodide Playground
- Editor: textarea hoặc CodeMirror lite
- "Chạy" button → Pyodide execute trong browser
- Output panel
- Preset examples: fetch giá VNM, danh sách cổ phiếu top, historical data
- Dữ liệu thật từ `GET /api/public/vnbroker-data/` (Pyodide gọi via fetch)

### 5.7 `/pricing` — SaaS Plans
- Free / Pro / Enterprise cards
- Feature matrix
- CTA → `https://vninvest.edusuccess.vn/register`

### 5.8 `/blog` — Articles
- List page: cards với thumbnail, ngày, tóm tắt
- Article page: MDX render
- ISR: revalidate mỗi 24h
- 3 articles bootstrap: VNInvest intro, vnbroker quickstart, VNBrokerChart whale guide

### 5.9 `/legal` — Legal Pages
- Load từ `GET /api/public/legal-pages/` (endpoint đã có)

---

## 6. Backend additions bắt buộc

### 6.1 Next.js Proxy Routes (KHÔNG cần endpoint Django mới cho chart)

Chart demo dùng `DjangoVnbrokerAdapter` thông qua **Next.js Route Handlers** làm proxy, không gọi thẳng backend.

**File**: `packages/opencore-site/src/app/api/bars/[symbol]/route.ts`  
**Cách hoạt động**:
1. Client `VNBrokerChart` → `DemoAdapter.fetchBars(symbol, tf, from, to)`
2. `DemoAdapter` gọi `GET /api/bars/VNM/?tf=1d&from=...&to=...` (local Next.js)
3. Next.js route handler kiểm tra symbol whitelist → forward tới `${VNINVEST_BACKEND_URL}/api/bars/VNM/?...`
4. Response trả về client với header `Cache-Control: public, max-age=300`

**Symbol whitelist check** trong route handler (không phải Django):
```ts
const ALLOWED_SYMBOLS = new Set(['VNM','FPT','VHM','ACB','TCB','MBB','VCB','HPG','SSI','VND']);
if (!ALLOWED_SYMBOLS.has(params.symbol)) return NextResponse.json({ error: 'symbol not allowed' }, { status: 400 });
```
**Rate limit**: Next.js middleware hoặc Upstash Ratelimit (không cần Django ratelimit)

**File**: `packages/opencore-site/src/app/api/whale-events/route.ts`  
Proxy `GET /api/whale-events/?symbol=` → backend, cùng whitelist logic

### 6.2 `GET /api/public/vnbroker-data/`
**File**: `backend/portfolio/views.py`  
**Auth**: không cần  
**Query params**:
- `symbol` — bắt buộc, whitelist giống chart-demo
- `data_type` — `ohlcv|profile|listing`, default `ohlcv`
- `period` — `1D|1W|1M|3M`, default `1M`

**Response**: JSON tuỳ `data_type`  
**Rate limit**: 10 req/min per IP  
**Lưu ý bảo mật**: Input symbol phải regex match `^[A-Z0-9]{1,10}$` — OWASP A03 injection prevention

---

## 7. CI/CD

### Workflow: `.github/workflows/opencore-site.yml`
- Trigger: push to `enterprise`, `main`, paths `packages/opencore-site/**`
- Build: `npm run build` trong `packages/opencore-site`
- Docker: build image `ghcr.io/vietdungiitb/vninvest-opencore-site:latest`
- Push: chỉ trên `enterprise` và `main`

### Docker image
- Base: `node:20-alpine`
- Build: `next build` (output: `standalone`)
- Port: 3000

### Portainer stack
- Thêm service `opencore-site` vào `portainer-stack-vninvest.yml`
- `VIRTUAL_HOST: about.${DOMAIN}` (nginx-proxy auto-routing)
- `depends_on: core-api: service_started`

---

## 8. Hard constraints

1. **Không tạo auth** trên about site — chỉ public content, không cookie session
2. **Symbol whitelist bắt buộc** cho mọi public API endpoint — không để free-form query
3. **Rate limiting bắt buộc** trên `/api/public/*` — không bypass dù dev/staging
4. **Không expose internal API keys** trong client-side code — Pyodide gọi qua `/api/public/` relay, không gọi thẳng vnbroker data source
5. **Chart demo phải dùng `VNBrokerChart` từ package `vnbrokercharts`** (local workspace dep) — không tạo chart riêng, không dùng ECharts/Recharts/Chart.js
6. **Text mới phải qua i18n** (both `vi.json` và `en.json`) — không hardcode string
7. **Tất cả public API response phải có `Cache-Control: public, max-age=300`** để giảm tải
8. **CSP header** phải được set trên nginx config của opencore-site container
9. **Không commit `.env`** — dùng docker compose environment injection
10. **Blog content (MDX)** phải commit vào repo — không dùng external CMS ở phase này

---

## 9. Bộ tài liệu trong gói này

| # | File | Mục đích |
|---|---|---|
| 1 | `ABOUT_SITE_HANDOFF_MASTER_20260506.md` | File này — overview tổng thể |
| 2 | `TECH_SPEC_ABOUT_SITE_20260506.md` | Chi tiết kỹ thuật từng component |
| 3 | `IMPLEMENTATION_PLAN_ABOUT_SITE_20260506.md` | Lộ trình phase-by-phase |
| 4 | `TASKBOARD_ABOUT_SITE_20260506.md` | Task list với DoD từng task |
| 5 | `ABOUT_SITE_TRACEABILITY_MATRIX_20260506.md` | Traceability yêu cầu → code |
| 6 | `ABOUT_SITE_SELF_AUDIT_AND_TEST_PROTOCOL_20260506.md` | Giao thức kiểm thử |
| 7 | `ABOUT_SITE_EXECUTION_EVIDENCE_TEMPLATE_20260506.md` | Template bàn giao bằng chứng |
| 8 | `ABOUT_SITE_CODE_QUALITY_CONSTITUTION_20260506.md` | Quy chuẩn code |
| 9 | `ABOUT_SITE_CONFIG_OWNERSHIP_MATRIX_20260506.md` | Ai sở hữu config nào |
| 10 | `RUN_CODE_REVIEW_ABOUT_SITE_20260506.md` | Giao thức code review |
| 11 | `RUN_INTEGRATION_TESTS_ABOUT_SITE_20260506.md` | Giao thức integration test |
| 12 | `RUN_SPEC_AUDIT_ABOUT_SITE_20260506.md` | Giao thức spec audit |

---

## 10. Điều kiện DONE

- [ ] `about.vninvest.edusuccess.vn` trả 200, render đúng VI/EN toggle
- [ ] `/chart` hiển thị `VNBrokerChart` (vnbrokercharts) với data thật qua Next.js proxy, whale bubbles overlay
- [ ] `/vnbroker/playground` chạy Python code bằng Pyodide, fetch data qua relay
- [ ] `/pricing` có CTA link đúng đến `vninvest.edusuccess.vn/register`
- [ ] `/blog` render ít nhất 3 bài MDX
- [ ] CI build `opencore-site` image đẩy lên GHCR thành công
- [ ] Portainer stack deploy thành công, container healthy
- [ ] Lighthouse score ≥ 85 (Performance), ≥ 90 (Accessibility)
- [ ] Rate limit 429 trả đúng khi vượt ngưỡng
- [ ] Symbol injection attack bị chặn (reject `; DROP TABLE`)
