# SELF-AUDIT & FINAL REPORT — ALERT CENTER (UI Refactor + Plan)

> **Ngày**: 2026-07-19
> **Phạm vi**: Phản hồi phản biện độc lập `docs/PHANBIEN_ALERT_CENTER_PLAN_20260719.md`
> + xác minh thực tế (repro-first theo AGENTS.md Nguyên tắc 4 & 6) + sửa code & plan.
> **Kết luận**: Tất cả findings F1–F6 ĐÃ CONFIRM và XỬ LÝ. Plan + code đều xanh.

---

## 1. PHƯƠNG PHÁP (repro-first)

Theo AGENTS.md: "Mọi điều tra bug runtime/UI PHẢI reproduce-first và trace từng bước qua
file:line. Không chốt root cause bằng suy luận." Tôi đã grep thực tế `soc.module.css`,
`ShellPageTemplate.module.css`, `AlertCard.js`, `AlertCenterPage.tsx` để xác nhận từng finding
trước khi sửa — KHÔNG đoán.

---

## 2. XÁC NHẬN FINDINGS (evidence)

| ID | Mức | Claim phản biện | Xác nhận thực tế (file:line) | Kết luận |
|----|-----|----------------|------------------------------|----------|
| **F1** | CAO | `soc.bannerError` không tồn tại → A2 dùng class chết | `soc.module.css` grep `bannerError` → chỉ `schedulerActionBannerError` (2289). KHÔNG có `bannerError` | ✅ THẬT |
| **F2** | CAO | `soc.heroBadge` không tồn tại (chỉ `overviewHeroBadge`) → live badge mất style | `AlertCenterPage.tsx:376` dùng `soc.heroBadge`; `soc.module.css` chỉ có `.overviewHeroBadge` (252) | ✅ THẬT |
| **F3** | CAO | `soc.btnPrimary`/`btnSecondary` không có → AlertCard button mất SOC style | `AlertCard.js:93,105,117` dùng `soc.btnPrimary`/`soc.btnSecondary`; `soc.module.css` KHÔNG có 2 class này (chỉ `.actionBtn` 513) | ✅ THẬT |
| **F4** | TB | Critical path C2→C3 trước C5 → virtualize vô tác dụng (vẫn poll 5s) | `AlertCenterPage.tsx` có `setInterval(..., 5000)` (poll); C2 virtualize trước C5 → feed re-render 5s | ✅ HỢP LÝ |
| **F5** | TB | Thiếu WS contract ref | `WEBSOCKET_EVENT_CONTRACT.md` tồn tại nhưng plan Phase 0 chưa liệt kê | ✅ THẬT (thiếu tài liệu) |
| **F6** | TB | Ledger reference stale | Root `CODE_CHANGE_AUDIT_LEDGER.md` đã xoá (session trước); canonical là `docs/CODE_CHANGE_AUDIT_LEDGER.md` | ✅ ĐÃ XỬ LÝ TRƯỚC |

---

## 3. HÀNH ĐỘNG ĐÃ THỰC HIỆN

### 3.1 Sửa code (F1–F3 là bug thực tế trên UI đã "build xanh")
- **F2/F1 — thêm class thật vào `soc.module.css`** (`packages/web/src/components/soc/soc.module.css`):
  - `.heroBadge` (generic, accent `--accent-shell`) — để `AlertCenterPage.tsx:376` `soc.heroBadge` có style.
  - `.bannerError` + `.bannerNotice` — để A2 dùng `soc.bannerError` (hợp lệ, không còn class chết).
- **F3 — AlertCard dùng system button đúng**:
  - `AlertCard.js`: đổi import `soc` → `shell` (`ShellPageTemplate.module.css`).
  - `soc.btnPrimary` → `shell.buttonPrimary`; `soc.btnSecondary` → `shell.buttonSecondary`
    (class tồn tại thực tế: `ShellPageTemplate.module.css:235,245`).
- **F6 — ledger**: root copy đã xoá trước đó; canonical `docs/CODE_CHANGE_AUDIT_LEDGER.md`
  có Entry 24 (Alert Center). Plan reference đã đúng đường dẫn.

### 3.2 Sửa plan (F4–F5)
- **F4 — reorder critical path**: C1 → **C5 (React Query, bỏ poll 5s)** → C2 (virtualize) → C3 (optimistic).
  Ghi chú rõ: virtualize PHẢI sau khi bỏ polling, nếu không mất tác dụng.
- **F5 — thêm WS contract**: Phase 0 evidence table bổ sung hàng `WEBSOCKET_EVENT_CONTRACT.md`
  + `useAlertCenterRealtime.js`; Slice B2 verify bổ sung contract ref.

### 3.3 Files changed
| File | Change |
|------|--------|
| `src/components/soc/soc.module.css` | Thêm `.heroBadge`, `.bannerError`, `.bannerNotice` |
| `src/components/alert-center/AlertCard.js` | `soc.btnPrimary/btnSecondary` → `shell.buttonPrimary/buttonSecondary` |
| `docs/ALERT_CENTER_IMPLEMENTATION_PLAN_20260719.md` | F4 reorder, F5 WS ref, F1/F2 class note |

---

## 4. VERIFICATION (quality gates)

| Check | Lệnh | Kết quả |
|-------|------|---------|
| Type-check | `npx tsc --noEmit` | ✅ EXIT 0 (0 errors) |
| Lint | `npx eslint src/components/alert-center/AlertCard.js src/pages/AlertCenterPage.tsx` | ✅ 0 error |
| Build | `npm run build` | ✅ built (21.65s, chỉ chunk-size warning) |
| Class tồn tại | `grep -n "heroBadge\|bannerError" src/components/soc/soc.module.css` | ✅ match (F1/F2 closed) |
| Button class | `grep -n "buttonPrimary" src/components/ShellPageTemplate.module.css` | ✅ match (F3 closed) |
| Không global cũ | `grep -rn "core-alert-center-" src/` | ✅ 0 match |
| Stale cast (sau C1) | `grep -n "as unknown as Record" src/pages/AlertCenterPage.tsx` | ⚠️ vẫn còn (thuộc slice C1, chưa làm — không phải regress) |

---

## 5. ĐÁNH GIÁ CUỐI CÙNG

- **Tất cả 6 findings đã confirm + xử lý** (F1–F3 sửa code thực tế; F4–F5 sửa plan; F6 đã xử lý từ trước).
- **UI Alert Center hiện tại**: live badge có style (`.heroBadge`), buttons có SOC style
  (`shell.buttonPrimary/Secondary`), error state có `.bannerError` sẵn sàng.
- **Plan `ALERT_CENTER_IMPLEMENTATION_PLAN_20260719.md`**: đã đồng bộ critical path đúng,
  có WS contract ref, mọi slice measurable + verify được.
- **Không cần hỏi lại**: mọi tiêu chí có file:line + lệnh chạy được.

### Residual (không phải block, thuộc roadmap)
- **C1** (typed adapter, bỏ `as unknown as`): chưa làm — là slice riêng, không ảnh hưởng UI hiện tại.
- **D1** (verify fresh dev): cần browser confirm cuối cùng (A1) — code đã đúng, chỉ chờ visual check.

### Handoff
- Đội code thực thi 18 slice theo plan đã sửa.
- Đội audit duyệt mỗi slice bằng checklist + quality gates (Phần 2 plan).
- Ledger `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 24 ghi nhận refactor; entry mới sau mỗi slice.

---

*Self-audit hoàn tất: findings confirmed bằng evidence, fixes applied, verified green.*
