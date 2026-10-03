# GATE — uiux-verify (Stage 2 audit `/dashboard` + Wave 0.7a)

**Agent:** `uiux-verify` · **Branch:** `feat/uiux-verify` · **Base:** `dev @ 94f1d5c5`
**Worktree:** `C:\Mujoco Projects\agent-uiux-verify`
**Ngày:** 2026-09-27 · **Phạm vi:** doc-only + xoá 2 file trùng tên

> Nguyên tắc áp dụng: `CHƯA CHẠY` là kết quả hợp lệ. Không gate nào dưới đây được coi là PASS nếu chưa chạy thật.

---

## 1. Thay đổi trong PR này

| Loại | File | Dòng |
|---|---|---|
| new | `docs/AUDIT_UIUX_DASHBOARD_20260926.md` | 539 |
| new | `docs/AUDIT_UIUX_VERIFY_20260926.md` | 194 |
| new | `docs/evidence/uiux-dashboard/gates.md` | file này |
| new | `docs/CLAIMS.md` | +1 dòng claim (commit riêng `13c778ce`) |
| **delete** | `packages/web/src/components/dashboard/PortfolioHeatmap (1).js` | −255 |
| **delete** | `packages/web/src/components/dashboard/SmartStatsHeader (1).js` | −172 |

**Không sửa 1 dòng code sống.** Không đụng `AGENTS.md`, `CODE_CHANGE_AUDIT_LEDGER.md`, `package.json`, `pyproject.toml`, `requirements.txt`, `package-lock.json`, `docker-compose*.yml`, `.env*` (deny-list §2).

## 2. Vì sao xoá được — bằng chứng, không phải suy luận

Bản gốc của report ghi *"xoá 852 dòng / 3 file"*. **Sai** — đó là lỗi nguy hiểm nhất tìm được, vì nó nằm ở Wave 0 với gate là `tsc`.

| File | Dòng | Importer | Kết luận |
|---|---|---|---|
| `PortfolioHeatmap (1).js` | 255 | 0 | ✅ chết thật |
| `SmartStatsHeader (1).js` | 172 | 0 | ✅ chết thật |
| `FactsFirstModularPositionDeck.jsx` | 490 | **`FactsFirstModularPositionDeck.js:5`** + `components/dashboard/index.js:2` | 🔴 **KHÔNG chết** — đã tách sang Wave 4.x |

Phạm vi grep: `packages/web/src`, `packages/web/tests`, `packages/web/scripts`, `packages/web/e2e`, `docs`.
Bản sống được xác nhận còn nguyên và đúng là thứ `DashboardPage.tsx:7,8` import: `SmartStatsHeader.js` (185 dòng) · `PortfolioHeatmap.js` (627 dòng).

## 3. Gate — tất cả chạy thật trên worktree này

| Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` (packages/web) | **0** | 0 lỗi |
| Lint | `npx eslint src/components/dashboard src/pages/DashboardPage.tsx` | **0** | 0 error (warning pre-existing) |
| Shell gate | `npm run check:shell` | **0** | PASS 7/7 sub-gate |
| Multi-agent | `node packages/web/scripts/check-multi-agent.mjs` | **0** | 0 lỗi, 0 trùng số migration |
| Test | `npx vitest run src/components/dashboard src/pages/DashboardPage.breadth-dedup.component.test.ts` | **0** | **4 file / 30 test PASS** |

**Migration:** không tạo. `makemigrations` không liên quan (không đụng model).

### Gate nào KHÔNG chạy

| Gate | Lý do |
|---|---|
| `npm run build` | **CHƯA CHẠY** — PR này chỉ xoá 2 file không ai import; `tsc` đã phủ phần type. Cần chạy nếu reviewer muốn byte-level evidence |
| `vitest` toàn bộ suite | **CHƯA CHẠY** — chỉ chạy scope dashboard. Suite đầy còn nhiều test ngoài phạm vi |
| `jest` | **CHƯA CHẠY** — không có test jest nào chạm 2 file đã xoá (grep 0 hit) |
| BE test | **CHƯA CHẠY** — không đụng BE. Cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1` |
| Visual QA (screenshot) | **CHƯA CHẠY** — Wave 0.7a không đổi render; nhưng roadmap còn lại **bắt buộc** chụp 3 viewport |

## 4. Bug quy trình phát hiện trong lúc làm

**`docs/CLAIMS.md:198` trên `dev` bị hỏng do union-merge.** Dòng prose `` `vninvest_core`'s ~50 URL-routing failures. `` bị nối thẳng vào claim row của `tw-wire`, tạo ra một dòng 2.9 KB lộn xộn. Đây là hậu quả của `merge=union`: nó giữ được cả 2 nội dung nhưng **không giữ được ranh giới dòng**.

Agent này **không tự sửa** (shared file, ngoài phạm vi) — báo coordinator. Chi tiết: `docs/AUDIT_UIUX_VERIFY_20260926.md` phụ lục.

## 5. Còn lại sau PR này (có chủ đích)

Wave 0.1–0.6 và 0.8–0.9 của roadmap **chưa làm** — chúng đổi layout, cần visual QA 3 viewport và là PR riêng. PR này chỉ nhằm gom **tài liệu + phần xoá file chết an toàn** thành một đơn vị review được.

Xem `docs/AUDIT_UIUX_DASHBOARD_20260926.md` §6 (roadmap 7 wave) và §8 (12 câu cần owner quyết trước khi code Wave 0.1+).
