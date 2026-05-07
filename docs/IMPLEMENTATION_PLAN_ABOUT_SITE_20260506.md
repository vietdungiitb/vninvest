# IMPLEMENTATION PLAN — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Cách làm**: slice nhỏ, mỗi slice tạo giá trị dùng được, mỗi slice có validation rõ ràng.

---

## 0. Nguyên tắc triển khai

1. Mỗi slice chỉ giải quyết một lớp ràng buộc rõ ràng.
2. Không code lan rộng sang các route hoặc package chưa nằm trong slice.
3. Sau mỗi slice phải cập nhật audit ledger và progress dashboard.
4. Mọi thay đổi runtime/UI phải rebuild stack bị ảnh hưởng trước khi chuyển slice.
5. Nếu slice chạm chart demo hoặc Pyodide thì phải có screenshot hoặc payload proof.

---

## 1. Sơ đồ ưu tiên

### Giai đoạn nền tảng
- SITE-1: scaffold package và pipeline
- SITE-2: shell layout + i18n + theme
- SITE-3: landing page + shared marketing sections
- SITE-4: route handlers + relay layer

### Giai đoạn sản phẩm
- SITE-5: `/chart` live demo bằng `vnstockcharts`
- SITE-6: `/chart/docs` và `/chart/embed`
- SITE-7: `/vnstock` và `/vnstock/playground`

### Giai đoạn hoàn thiện
- SITE-8: blog MDX + ISR
- SITE-9: SEO, legal, CSP, rate limit, quality hardening
- SITE-10: Portainer deploy, smoke test, evidence pack

---

## 2. Slice plan

### SITE-1 — Scaffold `packages/opencore-site`

**Mục tiêu**: có package Next.js 15 chạy được, healthcheck được, build được.

**Phạm vi**:
- tạo `packages/opencore-site`
- tạo `package.json`, `tsconfig.json`, `next.config.ts`, `Dockerfile`
- thêm `next-intl`, MDX, Pyodide loader, `vnstockcharts` dependency
- thêm workflow `.github/workflows/opencore-site.yml`

**Đầu ra**:
- `npm run build` pass trong package
- `GET /api/health` trả 200
- Docker image build được

**Validation**:
- `npm run build`
- `npm run lint`
- `curl /api/health`

**Files**:
- `packages/opencore-site/**`
- `.github/workflows/opencore-site.yml`

---

### SITE-2 — Root shell + locale system

**Mục tiêu**: có layout chung, menu, footer, locale toggle, theme tokens.

**Phạm vi**:
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/page.tsx` shell
- `src/components/layout/*`
- `src/messages/vi.json`, `src/messages/en.json`
- `src/app/i18n.ts`

**Đầu ra**:
- VI là default locale
- EN/VI toggle hoạt động
- page shell responsive trên mobile và desktop

**Validation**:
- `npm run build`
- screenshot home shell ở cả VI và EN

---

### SITE-3 — Landing page marketing

**Mục tiêu**: homepage hoàn chỉnh, giới thiệu 3 sản phẩm.

**Phạm vi**:
- Hero
- 3 product cards
- feature highlights
- CTA về SaaS và pricing

**Đầu ra**:
- `/` có hero rõ ràng, CTA hoạt động
- text mới đều đi qua i18n tiếng Việt đầy đủ dấu

**Validation**:
- browser smoke on `/vi` và `/en`
- kiểm CTA link đúng

---

### SITE-4 — Relay routes and data guardrails

**Mục tiêu**: tạo lớp proxy an toàn cho chart demo và playground.

**Phạm vi**:
- `/api/bars/[symbol]/route.ts`
- `/api/public/vnstock-data/route.ts`
- symbol whitelist
- rate limit middleware/helper
- cache headers

**Đầu ra**:
- symbol lạ bị chặn
- API response có `Cache-Control`
- client không gọi backend trực tiếp

**Validation**:
- curl success với VNM
- curl fail với symbol không hợp lệ
- rate limit smoke

---

### SITE-5 — `/chart` live demo

**Mục tiêu**: render VNStockCharts live demo bằng `vnstockcharts`.

**Phạm vi**:
- `ChartDemo.tsx`
- symbol picker
- `VNStockChart` integration
- whale bubble overlay nếu có dữ liệu
- polling refresh

**Đầu ra**:
- `/chart` hiển thị đúng chart engine của `vnstockcharts`
- không dùng KLineCharts, ECharts, Recharts hoặc Chart.js
- phù hợp viewport mobile/desktop

**Validation**:
- screenshot chart
- đổi symbol và xác nhận dữ liệu refresh

---

### SITE-6 — `/chart/docs` và `/chart/embed`

**Mục tiêu**: có tài liệu component và embed generator.

**Phạm vi**:
- props reference
- install guide
- code snippet samples
- embed form and preview

**Đầu ra**:
- trang docs có code sample chính xác theo API thật của `vnstockcharts`
- embed generator copy-paste được

**Validation**:
- build pass
- kiểm copy snippet không lỗi

---

### SITE-7 — `/vnstock` và Pyodide playground

**Mục tiêu**: giới thiệu vnstock library và playground chạy Python trên browser.

**Phạm vi**:
- library overview page
- quickstart
- playground with editor, sample snippets, output console
- lazy load Pyodide

**Đầu ra**:
- code chạy trong browser
- sample `fetch` dữ liệu qua relay helper
- không có server-side execution

**Validation**:
- run sample script
- check output panel
- check không có request direct đến backend host từ browser code

---

### SITE-8 — Blog MDX + ISR

**Mục tiêu**: có blog tĩnh / bán tĩnh để hỗ trợ SEO và giáo dục sản phẩm.

**Phạm vi**:
- MDX content loader
- blog index
- article pages
- frontmatter schema
- revalidate 24h

**Đầu ra**:
- ít nhất 3 bài bootstrap
- metadata per article
- canonical path hợp lệ

**Validation**:
- build pass
- inspect article page metadata

---

### SITE-9 — SEO, legal, CSP, reliability

**Mục tiêu**: hoàn thiện public surface để sẵn sàng production.

**Phạm vi**:
- sitemap
- robots
- OG image / metadata
- legal page mirroring
- CSP headers
- 404 and error states
- rate limit tuning

**Đầu ra**:
- search engines index được
- no unexpected inline script issues
- public routes không lộ secrets

**Validation**:
- curl sitemap and robots
- verify metadata in page source
- basic security smoke

---

### SITE-10 — Deploy and evidence

**Mục tiêu**: deploy container, verify production-ready surface, ghi bằng chứng.

**Phạm vi**:
- `portainer-stack-vninvest.yml`
- env vars
- GHCR image push
- production smoke
- evidence pack

**Đầu ra**:
- service `opencore-site` healthy
- domain trả 200
- chart page and playground load in production

**Validation**:
- Portainer stack deploy
- curl domain
- screenshot and payload snapshot

---

## 3. Dependency order

1. SITE-1 phải xong trước.
2. SITE-2 phụ thuộc SITE-1.
3. SITE-3 phụ thuộc SITE-2.
4. SITE-4 phải xong trước SITE-5 và SITE-7.
5. SITE-5 và SITE-7 có thể triển khai song song sau SITE-4.
6. SITE-8 phụ thuộc SITE-2.
7. SITE-9 phụ thuộc SITE-3, SITE-5, SITE-7, SITE-8.
8. SITE-10 chỉ làm sau khi SITE-1 đến SITE-9 qua smoke test.

---

## 4. Definition of done for the whole pack

- About site chạy được trên local và production domain.
- `/chart` dùng `vnstockcharts`.
- `/vnstock/playground` dùng Pyodide browser-only.
- Tất cả text mới có VI/EN.
- API guardrails chặn symbol lạ và rate limit đúng.
- Public pages có SEO, sitemap, robots, OG.
- Portainer deploy sạch và image GHCR có thể kéo về.
