# TASKBOARD — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: chia việc thành task nhỏ, mỗi task có DoD, file scope và command kiểm tra rõ ràng.

**Legend**: `[ ]` = Not started | `[~]` = In progress | `[x]` = Done | `[!]` = Blocked

---

## Phase 1 — Foundation

- [ ] `SITE-1.1` **Scaffold `packages/opencore-site`**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: package tồn tại, Next.js 15 chạy được, healthcheck 200  
  Files: `packages/opencore-site/**`  
  Validation: `npm run build`

- [ ] `SITE-1.2` **Add package deps and scripts**  
  Owner: Frontend Lead  
  Estimate: 1h  
  DoD: `next-intl`, MDX, Pyodide loader, `vnbrokercharts` dependency được khai báo  
  Files: `packages/opencore-site/package.json`  
  Validation: `npm install` / lockfile update

- [ ] `SITE-1.3` **Create Dockerfile and health route**  
  Owner: DevOps  
  Estimate: 1h  
  DoD: Docker build standalone, `GET /api/health` trả `{status:"ok"}`  
  Files: `packages/opencore-site/Dockerfile`, `src/app/api/health/route.ts`  
  Validation: `docker build` + curl health

- [ ] `SITE-1.4` **Add CI workflow**  
  Owner: DevOps  
  Estimate: 45m  
  DoD: workflow build image và push GHCR trên branch target  
  Files: `.github/workflows/opencore-site.yml`  
  Validation: workflow syntax check

---

## Phase 2 — Shell and i18n

- [ ] `SITE-2.1` **Build locale layout**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: `/vi` và `/en` render được, default VI  
  Files: `src/app/[locale]/layout.tsx`, `src/app/i18n.ts`  
  Validation: browser smoke on both locales

- [ ] `SITE-2.2` **Create nav, footer, language toggle**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: nav responsive, toggle locale đổi route đúng  
  Files: `src/components/layout/*`  
  Validation: screenshot mobile + desktop

- [ ] `SITE-2.3` **Seed VI/EN message catalogs**  
  Owner: Frontend Lead  
  Estimate: 1h  
  DoD: mọi text shell đi qua i18n key  
  Files: `src/messages/vi.json`, `src/messages/en.json`  
  Validation: grep không còn string hardcode trong shell

- [ ] `SITE-2.4` **Apply site theme tokens**  
  Owner: Frontend Lead  
  Estimate: 1h  
  DoD: font, color, spacing tokens đủ cho marketing UI  
  Files: `src/app/globals.css`  
  Validation: visual smoke

---

## Phase 3 — Landing and marketing pages

- [ ] `SITE-3.1` **Implement homepage hero**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: hero có tagline, CTA, value prop rõ ràng  
  Files: `src/app/[locale]/page.tsx`, `src/components/sections/HeroSection.tsx`  
  Validation: home page screenshot

- [ ] `SITE-3.2` **Add product cards and feature grid**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: 3 sản phẩm hiển thị rõ, copy song ngữ  
  Files: `src/components/sections/ProductCards.tsx`, `FeatureGrid.tsx`  
  Validation: browser check product links

- [ ] `SITE-3.3` **Implement pricing page**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: plan table, CTA, no missing i18n text  
  Files: `src/app/[locale]/pricing/page.tsx`, `PricingTable.tsx`  
  Validation: click-through test

- [ ] `SITE-3.4` **Implement legal page shell**  
  Owner: Frontend Lead  
  Estimate: 1h  
  DoD: legal content visible, route stable  
  Files: `src/app/[locale]/legal/page.tsx`  
  Validation: render smoke

---

## Phase 4 — Data relay layer

- [ ] `SITE-4.1` **Create symbol validation helper**  
  Owner: Frontend Lead  
  Estimate: 45m  
  DoD: regex + allowlist shared by chart and playground  
  Files: `src/lib/validation.ts`  
  Validation: unit test for valid/invalid symbols

- [ ] `SITE-4.2` **Create chart proxy route**  
  Owner: Backend/Frontend Lead  
  Estimate: 2h  
  DoD: `/api/bars/[symbol]` proxy về backend relay, có cache header  
  Files: `src/app/api/bars/[symbol]/route.ts`  
  Validation: curl VNM/invalid symbol

- [ ] `SITE-4.3` **Create vnbroker-data relay route**  
  Owner: Backend/Frontend Lead  
  Estimate: 2h  
  DoD: `/api/public/vnbroker-data` trả JSON cho Pyodide  
  Files: `src/app/api/public/vnbroker-data/route.ts`  
  Validation: curl sample payload

- [ ] `SITE-4.4` **Add rate limiting helper**  
  Owner: Backend/DevOps Lead  
  Estimate: 2h  
  DoD: public routes bị chặn khi vượt ngưỡng  
  Files: `src/lib/api.ts` hoặc rate-limit middleware/helper  
  Validation: 429 smoke test

---

## Phase 5 — Chart demo

- [ ] `SITE-5.1` **Implement DemoAdapter wrapper**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: adapter fetchBars trỏ về local route handlers  
  Files: `src/lib/adapters/demoAdapter.ts`  
  Validation: fetch smoke

- [ ] `SITE-5.2` **Build `/chart` surface**  
  Owner: Frontend Lead  
  Estimate: 3h  
  DoD: demo hiển thị `VNBrokerChart` từ `vnbrokercharts`  
  Files: `src/app/[locale]/chart/page.tsx`, `src/components/sections/ChartDemo.tsx`  
  Validation: screenshot chart

- [ ] `SITE-5.3` **Hook symbol selector and refresh**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: đổi mã chứng khoán và refresh đúng dữ liệu  
  Files: `ChartDemo.tsx`  
  Validation: switch symbol smoke

- [ ] `SITE-5.4` **Wire whale overlay/session summary**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: bubble overlay và session card khớp selected symbol  
  Files: `ChartDemo.tsx` and related helpers  
  Validation: screenshot with whale layer

---

## Phase 6 — Chart docs and embed

- [ ] `SITE-6.1` **Create chart docs page**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: props/API docs khớp `VNBrokerChart` thật  
  Files: `src/app/[locale]/chart/docs/page.tsx`  
  Validation: docs page render smoke

- [ ] `SITE-6.2` **Create embed generator**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: preview và code snippet copy được  
  Files: `src/app/[locale]/chart/embed/page.tsx`  
  Validation: copy snippet check

---

## Phase 7 — vnbroker and playground

- [ ] `SITE-7.1` **Implement vnbroker overview page**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: giới thiệu library, quickstart, links đúng  
  Files: `src/app/[locale]/vnbroker/page.tsx`  
  Validation: browser smoke

- [ ] `SITE-7.2` **Implement Pyodide loader**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: lazy load Pyodide trong browser, có fallback state  
  Files: `src/lib/pyodide.ts`  
  Validation: no server-side execution in build logs

- [ ] `SITE-7.3` **Implement playground UI**  
  Owner: Frontend Lead  
  Estimate: 3h  
  DoD: editor, run button, output, examples hoạt động  
  Files: `src/app/[locale]/vnbroker/playground/page.tsx`, `PlaygroundPanel.tsx`  
  Validation: execute sample script

- [ ] `SITE-7.4` **Wire relay fetch examples**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: sample code fetch qua `/api/public/vnbroker-data`  
  Files: `PlaygroundPanel.tsx`, `api.ts`  
  Validation: payload screenshot

---

## Phase 8 — Blog system

- [ ] `SITE-8.1` **Create MDX content loader**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: MDX render được với frontmatter  
  Files: `content/blog/*.mdx`, MDX config  
  Validation: build pass with sample posts

- [ ] `SITE-8.2` **Implement blog index and article pages**  
  Owner: Frontend Lead  
  Estimate: 2.5h  
  DoD: list page + slug page + metadata per post  
  Files: `src/app/[locale]/blog/page.tsx`, `src/app/[locale]/blog/[slug]/page.tsx`  
  Validation: render 3 seeded posts

- [ ] `SITE-8.3` **Add ISR revalidation rules**  
  Owner: Frontend Lead  
  Estimate: 1h  
  DoD: 24h revalidate on blog routes  
  Files: blog pages / build config  
  Validation: config review

---

## Phase 9 — SEO and hardening

- [ ] `SITE-9.1` **Add metadata, OG, schema**  
  Owner: Frontend Lead  
  Estimate: 2h  
  DoD: title/description/canonical/OG per route  
  Files: `seo.ts`, route metadata  
  Validation: page source inspection

- [ ] `SITE-9.2` **Create robots and sitemap**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: robots.txt + sitemap.xml accessible  
  Files: `public/robots.txt`, sitemap route  
  Validation: curl endpoints

- [ ] `SITE-9.3` **Add CSP and security headers**  
  Owner: DevOps  
  Estimate: 1.5h  
  DoD: CSP enforced, no unsafe external sources beyond spec  
  Files: `next.config.ts` or middleware  
  Validation: browser console clean

- [ ] `SITE-9.4` **Harden error and empty states**  
  Owner: Frontend Lead  
  Estimate: 1.5h  
  DoD: 404, error, empty states all localized  
  Files: error boundary / fallback components  
  Validation: route error smoke

---

## Phase 10 — Deploy and sign off

- [ ] `SITE-10.1` **Update Portainer stack**  
  Owner: DevOps  
  Estimate: 1h  
  DoD: `opencore-site` service added, env vars correct  
  Files: `portainer-stack-vninvest.yml`  
  Validation: stack diff review

- [ ] `SITE-10.2` **Deploy image and verify domain**  
  Owner: DevOps  
  Estimate: 1h  
  DoD: GHCR image pulls, domain trả 200  
  Files: deployment config only  
  Validation: curl production domain

- [ ] `SITE-10.3` **Capture evidence pack**  
  Owner: Frontend + DevOps  
  Estimate: 1h  
  DoD: screenshot, payload, validation logs, residual risk note  
  Files: evidence template, audit ledger, progress dashboard  
  Validation: all artifacts present

---

## Completion gate

The whole taskboard is complete only when:
- all phase 1 to 10 tasks are `[x]`
- local build passes
- production smoke passes
- audit ledger and progress dashboard are updated
- no open question remains on chart engine, relay routes, or i18n coverage
