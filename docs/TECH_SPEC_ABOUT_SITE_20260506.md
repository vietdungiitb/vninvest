# TECH SPEC — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Phạm vi**: `packages/opencore-site`  
**Mục tiêu**: public marketing site cho hệ sinh thái VNInvest, dùng `vnstockcharts` cho demo biểu đồ.

---

## 1. Tóm tắt kiến trúc

About site là một Next.js 15 App Router application, chạy độc lập ở subdomain `about.vninvest.edusuccess.vn`, nhưng vẫn dùng cùng hệ sinh thái hạ tầng với VNInvest. Site này không phải app nội bộ, không có session người dùng, không có ghi dữ liệu, và không cho phép chạy code phía server từ trình duyệt.

Kiến trúc mục tiêu:

```text
Browser
  └── https://about.vninvest.edusuccess.vn
        └── nginx-proxy
              └── vninvest-opencore-site:3000
                    ├── /            → landing page
                    ├── /chart      → VNStockCharts live demo
                    ├── /vnstock    → library overview
                    ├── /blog       → MDX articles
                    ├── /pricing    → plan page
                    └── /api/*      → route handlers / relay layer
                              ├── /api/bars/[symbol]
                              ├── /api/public/vnstock-data
                              └── /api/health

Client chart rendering uses `vnstockcharts` from the sibling repo `C:\Mujoco Projects\react-stockcharts-master` during development.
```

---

## 2. Cấu trúc package

```text
packages/opencore-site/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── chart/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── docs/page.tsx
│   │   │   │   └── embed/page.tsx
│   │   │   ├── vnstock/
│   │   │   │   ├── page.tsx
│   │   │   │   └── playground/page.tsx
│   │   │   ├── pricing/page.tsx
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   └── legal/page.tsx
│   │   ├── api/
│   │   │   ├── health/route.ts
│   │   │   ├── bars/[symbol]/route.ts
│   │   │   └── public/vnstock-data/route.ts
│   │   ├── globals.css
│   │   └── i18n.ts
│   ├── components/
│   │   ├── layout/
│   │   ├── sections/
│   │   └── ui/
│   ├── lib/
│   │   ├── adapters/
│   │   │   └── demoAdapter.ts
│   │   ├── api.ts
│   │   ├── pyodide.ts
│   │   ├── seo.ts
│   │   └── validation.ts
│   ├── content/
│   │   └── blog/*.mdx
│   └── messages/
│       ├── vi.json
│       └── en.json
├── public/
│   ├── favicon.ico
│   ├── logo.svg
│   ├── og-image.png
│   └── robots.txt
├── Dockerfile
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 3. Route matrix

| Route | Surface | Render mode | Primary data source | Notes |
|---|---|---:|---|---|
| `/` | Landing page | SSR + hydration | Static copy + locale messages | Hero, product cards, CTA |
| `/chart` | VNStockCharts live demo | SSR shell + client refresh | `/api/bars/[symbol]` proxy | Uses `vnstockcharts` |
| `/chart/docs` | Component docs | SSG | Static docs | Props, install, embed snippets |
| `/chart/embed` | Embed generator | CSR | Static + generated config | Copy-paste embed code |
| `/vnstock` | Library overview | SSG | Static copy + code samples | `pip install vnstock` |
| `/vnstock/playground` | Pyodide playground | SSR shell + client runtime | `/api/public/vnstock-data` relay | Browser-only execution |
| `/pricing` | Pricing page | SSG | Static plan table | CTAs to main SaaS |
| `/blog` | Article index | ISR | MDX content | Revalidate 24h |
| `/blog/[slug]` | Article page | ISR | MDX content | SEO metadata per slug |
| `/legal` | Terms/privacy | SSR or SSG | Existing legal payload | Mirrors backend legal pages |
| `/api/health` | Healthcheck | Route handler | None | Used by Docker/Portainer |
| `/api/bars/[symbol]` | Chart proxy | Route handler | Backend relay | Symbol whitelist + rate limit |
| `/api/public/vnstock-data` | Playground relay | Route handler | Backend relay | Symbol whitelist + rate limit |

---

## 4. Component contracts

### 4.1 `RootLayout`

Responsibilities:
- inject locale provider (`next-intl`)
- set `lang`/`dir`
- apply shared theme variables
- include top nav + footer on all public pages
- attach metadata defaults and site icons

Required fonts:
- headings: `Space Grotesk` or equivalent expressive sans
- body: `Manrope` or `IBM Plex Sans`

Visual direction:
- editorial, high-contrast, not generic SaaS boilerplate
- dark base with accent gradients in teal, amber, and slate
- no purple default bias

### 4.2 `TopNav` / `Footer` / `LangToggle`

Responsibilities:
- locale switch VI ↔ EN
- CTA button to main SaaS login/register
- footer with product links, legal links, GitHub link, and copyright
- mobile-first responsive nav with no hardcoded English strings

### 4.3 `ChartDemo`

Responsibilities:
- load `vnstockcharts` demo surface
- feed `VNStockChart` with data through a `DemoAdapter`
- choose symbol from whitelist only
- render whale bubbles overlay and session summary cards
- auto-refresh bars on interval; phase 1 does not require WebSocket wiring

Required library usage:
- `VNStockChart` from `vnstockcharts`
- `DjangoVnstockAdapter` or `DemoAdapter` subclass
- `WhaleBubbleOverlay` for whale events when available
- `MockAdapter` only for offline/storybook tests

Suggested data flow:
1. user selects symbol
2. component asks `DemoAdapter.fetchBars(symbol, timeframe, from, to)`
3. `DemoAdapter` calls same-origin route handler `/api/bars/[symbol]`
4. route handler proxies to backend relay endpoint
5. chart rerenders and preserves selected session truth

### 4.4 `PlaygroundPanel`

Responsibilities:
- lazy load Pyodide 0.26 in browser only
- render editor, run button, output console, preset examples
- expose no server-side code execution
- relay sample data through `/api/public/vnstock-data`

Hard rule:
- all execution stays inside browser sandbox
- do not expose backend secrets or internal URLs to user code
- allow `fetch` only to same-origin relay helpers, not directly to backend hosts

### 4.5 `Blog` pages

Responsibilities:
- render MDX content from `content/blog`
- support frontmatter: `title`, `summary`, `date`, `tags`, `locale`, `heroImage`, `canonicalPath`
- generate list page and article pages with ISR revalidate 24h
- preserve per-page metadata and OG tags

---

## 5. Data contracts

### 5.1 `GET /api/bars/[symbol]?tf=&from=&to=`

Purpose: proxy bars for `vnstockcharts`.

Input rules:
- `symbol` must match `^[A-Z0-9]{1,10}$`
- allowed symbols are the short public whitelist:
  `VNM, FPT, VHM, ACB, TCB, MBB, VCB, HPG, SSI, VND`
- `tf` uses the library timeframe contract, default `1d`
- `from` and `to` must be ISO dates

Response shape:

```json
[
  {
    "date": "2026-05-06T09:00:00.000Z",
    "open": 71500,
    "high": 72000,
    "low": 71200,
    "close": 71800,
    "volume": 1234567,
    "buyVolume": 650000,
    "sellVolume": 584567,
    "index": 0,
    "dataIndex": 0
  }
]
```

Required headers:
- `Cache-Control: public, max-age=300`
- `Content-Type: application/json; charset=utf-8`

### 5.2 `GET /api/public/vnstock-data?symbol=&data_type=&period=`

Purpose: browser-side examples for Pyodide.

Input rules:
- same symbol whitelist + regex validation
- `data_type` in `ohlcv|profile|listing|summary`
- `period` in `1D|1W|1M|3M|1Y`

Suggested response shape:

```json
{
  "symbol": "VNM",
  "data_type": "ohlcv",
  "period": "1M",
  "source": "vninvest-backend",
  "generated_at": "2026-05-06T10:00:00Z",
  "rows": []
}
```

### 5.3 `GET /api/health`

Purpose: container healthcheck.

Response:

```json
{ "status": "ok" }
```

---

## 6. Security spec

1. Không cho phép client code gọi trực tiếp backend host trong about site.
2. Symbol validation phải chạy ở route handler trước khi proxy.
3. Rate limit bắt buộc cho mọi route công khai có data relay.
4. Pyodide chỉ được phép chạy code trong browser sandbox, không dùng `eval` trên server.
5. CSP phải chặn script lạ; chỉ allow các nguồn đã pin rõ ràng.
6. Không log payload nhạy cảm, token, secret, hoặc code người dùng.
7. Không đưa `NEXT_PUBLIC_*` nào chứa nội bộ backend host hay key bí mật.

Recommended CSP baseline:
- `default-src 'self'`
- `script-src 'self' https://cdn.jsdelivr.net`
- `style-src 'self' 'unsafe-inline'`
- `img-src 'self' data: https:`
- `connect-src 'self' https://cdn.jsdelivr.net`
- `worker-src 'self' blob:`

---

## 7. i18n spec

Locale routing:
- default locale: `vi`
- supported locales: `vi`, `en`
- canonical routes live under `/{locale}/...`
- root `/` redirects to the default locale or locale-detected route

Message namespaces:
- `common.*`
- `home.*`
- `chart.*`
- `chartDocs.*`
- `chartEmbed.*`
- `vnstock.*`
- `playground.*`
- `pricing.*`
- `blog.*`
- `legal.*`
- `seo.*`
- `errors.*`

Text rules:
- mọi text hiển thị mới phải có bản tiếng Việt đầy đủ dấu
- bản English chỉ là bản song ngữ, không thay thế tiếng Việt
- không hardcode string trong JSX nếu string có khả năng hiển thị cho người dùng

---

## 8. SEO spec

Bắt buộc:
- `<title>` và description theo từng route
- canonical URL theo locale
- Open Graph image riêng cho site
- `robots.txt`
- `sitemap.xml`
- schema.org cho product, article, organization

Priority pages:
- `/`
- `/chart`
- `/vnstock`
- `/pricing`
- `/blog`

Suggested metadata rules:
- title tối đa 60 ký tự
- description tối đa 160 ký tự
- OG image 1200x630
- noindex chỉ dùng cho playground nếu cần, không mặc định

---

## 9. CI/CD and deploy spec

### 9.1 GitHub workflow

File: `.github/workflows/opencore-site.yml`

Triggers:
- push to `enterprise`
- push to `main`
- changes under `packages/opencore-site/**`

Steps:
1. checkout repo
2. setup Node 20
3. install deps
4. run `npm run lint`
5. run `npm run test` or focused smoke tests if available
6. build `packages/opencore-site`
7. build Docker image
8. push `ghcr.io/vietdungiitb/vninvest-opencore-site:latest`

### 9.2 Dockerfile

Constraints:
- base image: `node:20-alpine`
- output: standalone Next.js build
- expose port `3000`
- no runtime package install
- no source mount in production image

### 9.3 Portainer stack

Add service `opencore-site` to `portainer-stack-vninvest.yml` with:
- `VIRTUAL_HOST=about.vninvest.edusuccess.vn`
- `LETSENCRYPT_HOST=about.vninvest.edusuccess.vn`
- `NEXT_PUBLIC_SITE_URL=https://about.vninvest.edusuccess.vn`
- `VNINVEST_BACKEND_URL` or the chosen relay target
- `depends_on: core-api: service_started`

---

## 10. Non-goals

1. Không thay thế ứng dụng VNInvest SaaS chính.
2. Không tạo auth/session riêng cho about site.
3. Không làm server-side sandbox thực thi Python hoặc JavaScript từ người dùng.
4. Không viết lại chart engine gốc của `vnstockcharts` trong about site.
5. Không dùng CMS ngoài trong phase 1.
6. Không dùng KLineCharts hoặc other chart libs cho demo này.

---

## 11. Done criteria

- `about.vninvest.edusuccess.vn` trả 200 và hiển thị đúng locale mặc định.
- `/chart` render `vnstockcharts` demo chứ không phải KLineCharts.
- `/vnstock/playground` chạy Pyodide trong browser.
- `/blog` render MDX và có metadata hợp lệ.
- `curl /api/health` trả 200.
- `curl /api/bars/VNM?...` trả JSON hợp lệ và chặn symbol lạ.
- CI build được image `vninvest-opencore-site`.
- Portainer deploy thành công và container healthy.
