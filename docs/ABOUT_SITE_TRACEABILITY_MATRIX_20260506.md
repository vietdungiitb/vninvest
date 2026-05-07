# TRACEABILITY MATRIX — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Scope**: `packages/opencore-site`  
**Mục tiêu**: map rõ yêu cầu → slice → file → test để team code và reviewer không phải đoán.

---

## 1. Requirements

| ID | Requirement | Priority | Owner outcome |
|---|---|---:|---|
| ABOUT-REQ-01 | About site phải chạy trên `about.vninvest.edusuccess.vn` qua nginx-proxy | P0 | public domain trả 200 |
| ABOUT-REQ-02 | Site phải có VI/EN toggle, default locale là VI | P0 | UX song ngữ chuẩn |
| ABOUT-REQ-03 | `/chart` phải dùng `vnstockcharts`, không dùng KLineCharts | P0 | đúng chart engine tự phát triển |
| ABOUT-REQ-04 | Chart demo phải đi qua same-origin relay `/api/bars/[symbol]` | P0 | không fetch trực tiếp backend từ browser |
| ABOUT-REQ-05 | `/vnstock/playground` phải chạy Python bằng Pyodide trong browser | P0 | không có server-side code execution |
| ABOUT-REQ-06 | Public routes phải chặn symbol lạ và có rate limit | P0 | chặn injection + abuse |
| ABOUT-REQ-07 | Blog phải render MDX và revalidate 24h | P1 | content SEO-friendly |
| ABOUT-REQ-08 | SEO metadata, sitemap, robots, OG phải hoạt động | P1 | indexable, shareable |
| ABOUT-REQ-09 | Legal page phải hiển thị content hợp lệ | P1 | terms/privacy public |
| ABOUT-REQ-10 | Tất cả text mới phải qua i18n tiếng Việt đầy đủ dấu | P0 | không hardcode string user-facing |
| ABOUT-REQ-11 | CSP và headers phải đủ chặt, không lộ secret | P0 | hardening public surface |
| ABOUT-REQ-12 | Stack phải build image, deploy Portainer, healthy | P0 | production-ready |

---

## 2. Requirement → Slice mapping

| Req ID | Slice(s) | Verification |
|---|---|---|
| ABOUT-REQ-01 | SITE-1, SITE-10 | curl production domain → 200 |
| ABOUT-REQ-02 | SITE-2, SITE-3, SITE-8, SITE-9 | browser locale toggle smoke |
| ABOUT-REQ-03 | SITE-5, SITE-6 | screenshot chart page + docs |
| ABOUT-REQ-04 | SITE-4, SITE-5 | curl `/api/bars/VNM` + browser network trace |
| ABOUT-REQ-05 | SITE-7 | run sample script in browser only |
| ABOUT-REQ-06 | SITE-4, SITE-9 | invalid symbol → 4xx, rate-limit → 429 |
| ABOUT-REQ-07 | SITE-8 | 3 MDX posts + ISR config check |
| ABOUT-REQ-08 | SITE-9 | metadata/robots/sitemap inspection |
| ABOUT-REQ-09 | SITE-3, SITE-4, SITE-9 | legal route renders and links correct |
| ABOUT-REQ-10 | SITE-2, SITE-3, SITE-5, SITE-7, SITE-8, SITE-9 | grep scan + UI review |
| ABOUT-REQ-11 | SITE-4, SITE-9 | headers review + browser console |
| ABOUT-REQ-12 | SITE-1, SITE-10 | build, push GHCR, Portainer deploy |

---

## 3. Slice → Files mapping

| Slice | Files |
|---|---|
| SITE-1 | `packages/opencore-site/**`, `.github/workflows/opencore-site.yml` |
| SITE-2 | `src/app/[locale]/layout.tsx`, `src/components/layout/*`, `src/messages/*`, `src/app/i18n.ts` |
| SITE-3 | `src/app/[locale]/page.tsx`, `src/components/sections/HeroSection.tsx`, `ProductCards.tsx`, `FeatureGrid.tsx` |
| SITE-4 | `src/app/api/bars/[symbol]/route.ts`, `src/app/api/public/vnstock-data/route.ts`, `src/lib/validation.ts`, `src/lib/api.ts` |
| SITE-5 | `src/app/[locale]/chart/page.tsx`, `src/components/sections/ChartDemo.tsx`, `src/lib/adapters/demoAdapter.ts` |
| SITE-6 | `src/app/[locale]/chart/docs/page.tsx`, `src/app/[locale]/chart/embed/page.tsx` |
| SITE-7 | `src/app/[locale]/vnstock/page.tsx`, `src/app/[locale]/vnstock/playground/page.tsx`, `src/lib/pyodide.ts` |
| SITE-8 | `src/app/[locale]/blog/page.tsx`, `src/app/[locale]/blog/[slug]/page.tsx`, `src/content/blog/*.mdx` |
| SITE-9 | `next.config.ts`, `src/lib/seo.ts`, `public/robots.txt`, sitemap route, error pages |
| SITE-10 | `portainer-stack-vninvest.yml`, release notes, evidence artifacts |

---

## 4. Test coverage matrix

| Domain | Unit test focus | Integration focus | Evidence |
|---|---|---|---|
| Routing and locale | locale redirect, missing locale fallback | browser smoke on `/vi` and `/en` | screenshots |
| Chart demo | symbol validation, adapter base URL, refresh timing | `/chart` screenshot and network trace | payload snapshot |
| Relay routes | allowlist, cache headers, 4xx on bad symbol | curl route handlers | terminal logs |
| Pyodide | loader state machine, example registry | run sample code in browser | output screenshot |
| Blog | frontmatter parse, slug lookup | render index and article page | page source |
| SEO | metadata generation | sitemap/robots/OG inspection | page source |
| Deploy | env var resolution | Portainer container health | deploy logs |

---

## 5. File-level trace notes

### 5.1 Immutable dependency
- `vnstockcharts` is the source of truth for chart rendering.
- About site may wrap it, but must not fork chart logic into a parallel rendering engine.

### 5.2 Relay boundary
- Browser code only talks to same-origin route handlers.
- Route handlers relay to backend and own rate limit + whitelist.

### 5.3 Content boundary
- Blog content lives in repo under `src/content/blog`.
- No CMS dependency in phase 1.

---

## 6. Audit pass/fail rules

A slice is **PASS** only if:
1. the mapped files exist,
2. the mapped validation command(s) pass,
3. UI changes have screenshot evidence,
4. route/data changes have payload evidence,
5. residual risk is explicitly written down.

A slice is **FAIL** if any of the following happen:
- chart demo uses the wrong chart engine,
- public pages contain hardcoded user-facing English text without i18n,
- client code fetches backend directly,
- rate limit or symbol whitelist is missing,
- deploy works locally but not in Portainer.
