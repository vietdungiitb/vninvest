# B3 — Audit kế hoạch thực thi (vòng 1) — 2026-11-22

> **Auditor:** subagent độc lập, chỉ đọc, khác session với người viết plan.
> **Đối tượng:** `docs/PLAN_CHART_ENTERPRISE_CLOSED_LOOP_20261122.md` @ baseline `dev 992743eea`.
> **Verdict:** **NEED_REVISION** — 2 blocker · 3 major · 4 minor. Chưa đủ điều kiện sang B5.

## 1. Objections + trạng thái xử lý

| # | Mức | Objection | Đề xuất auditor | Trạng thái sửa trong plan |
|---|---|---|---|---|
| O1 | blocker | Plan ghi `frontend/docker/nginx.conf` — **KHÔNG TỒN TẠI**; file thật `packages/web/docker/nginx.conf` (có `location ^~ /api/v1/` tại `:254-265`) | Đổi path; nêu rõ `location = /api/v1/entitlement` exact-match thắng `^~` | **ĐÃ SỬA** (file map + Task 5). ⚠ Cần bổ sung ghi chú exact-match ở step deploy — xem round 2 |
| O2 | blocker | Mâu thuẫn target: mục tiêu app vninvest trên `docker.edusuccess.vn` nhưng Task 6 build static demo `charts-test` gắn `charts.edusuccess.vn` (`compose:41,43`), đụng stack staging | Chốt 1 target | **ĐÃ SỬA**: thêm "Target triển khai" đầu plan; Task 6 Step 4 đổi sang `npm run build` + `deploy-staging.sh --verify`; parity 7–10 đổi thành "nhân cơ chế" |
| O3 | major | `check-staging.cjs` cần `/health.json {commit,dirty}`; repo vninvest 0 file health.json | Tạo health provenance hoặc đổi verifier | **ĐÃ SỬA**: thêm 2 file mới `write-build-health.mjs` + `check-staging.mjs`; Task 6 Step 4/5 cập nhật; parity #6 cập nhật |
| O4 | major | Thiếu entry gọi `preloadChartEntitlement()` trước mount → test first-render có thể xanh giả (L-V04) | Bổ sung entry + assert thứ tự | **ĐÁ SỬA**: file map thêm `src/main.tsx`; Task 4 Step 1 assert preload→render + assert giá trị thật; Step 3 gọi trước `createRoot().render()` |
| O5 | major | Citation `DEMO-ENT:18-19` chỉ nói SNI, không nói Origin; blueprint Origin = `charts.edusuccess.vn`, plan = `docker…`, chưa probe | Sửa citation + probe curl | **ĐÁ SỬA**: Review Focus 2 trích `:160-163,166`; Task 5 Step 4 probe 3 case (có/không auth, sai Origin) ghi `GATES_E3.md` |
| O6 | minor | Thiếu luật cứng #4 (không đọc tiếng Việt qua console Windows / không `print()` tiếng Việt) | Thêm 1 dòng | **ĐÁ SỬA** Global Constraints |
| O7 | minor | Baseline ghi `check-multi-agent PASS` nhưng chú thích gây hiểu claim chưa tồn tại | Đổi nhãn | **ĐÁ SỬA**: ghi rõ "đã chạy sau khi append claim `chart-enterprise-plan`" |
| O8 | minor | Task 7 thiếu step commit | Thêm step 6 | **ĐÁ SỬA** |
| O9 | minor | Interface `readPreloadedChartTier()` trả `free` nhưng blueprint trả `null` khi free | Ghi rõ mirror | **ĐÁ SỬA**: interface ghi "free → null" |

## 2. 5 Review Focus

1. Free flash — có test first-render, **nhưng** O4 làm test chưa đủ → đã sửa.
2. Origin/SNI — có `proxy_ssl_name`, **nhưng** O5 citation sai + Origin chưa probe → đã sửa.
3. Stale bundle — có verifier từ ngoài, **nhưng** O3 không có artifact để so → đã sửa.
4. Free-tier locking — `verify-capability-gate` 21/21 + điều kiện ảnh + mở ảnh ✅ khớp `DEMO-ENT:29-31`.
5. Widget 0.4.4 thiếu enterprise leg — source-scan fail-before ✅ khớp survey (721 file/0 hit).

## 3. Bằng chứng đối chiếu

- Khớp blueprint: 6 dock tab (`enterpriseDockTypes.ts:4-11`) · `enterpriseBinding` (`VNInvestChartsProps.d.ts:324`) · `EnterpriseDockProvider({binding,children})` (`:3-7`) · 6 adapter method (`CapabilityResolver.ts:184-198`) · 13 capability (`capabilities.ts:219-230`) · preload 2500 ms (`serverEntitlement.ts:13-51`).
- Không khớp (đã sửa): path nginx · target deploy · health.json · entry preload · Origin.
- 6 luật cứng: #1 ✅ · #2 ✅ · #3 ✅ (plan LF, numstat có) · #4 **vi phạm → đã sửa** · #5 **vi phạm → đã sửa** · #6 ✅ ( evidence B3/B4/B8 được quy định, nhưng **chưa có file B4/B8**).
- Claim conflict: **không có** claim `in-progress` giữ file plan sẽ sửa (`chart-enterprise-plan` done `:2040`; các claim chart khác done/released).

## 4. Kết luận vòng 1

Plan có cấu trúc 9 bước chặt chẽ, 10 task, fail-before→pass-after đầy đủ (trừ Task 7 → đã sửa), nhưng
**chưa sang B5**. Blocker O1/O2 khiến Task 5/6 không thực thi được; O3/O4 đe dọa trực tiếp 2 trong 5
Review Focus. Đã sửa O1–O9 trong plan; **phải audit vòng 2** trước khi B4.

---

## B3 — vòng 2 — 2026-11-22

**Auditor:** subagent khác, chỉ đọc. **Verdict:** **NEED_REVISION** — 1 major (M1) · 2 minor (M2/M3).

- O1 **chưa trọn**: path đúng nhưng Task 5 Step 3 không ghi rõ `location = /api/v1/entitlement`
  exact-match để thắng `location ^~ /api/v1/` (`packages/web/docker/nginx.conf:254-265`). grep
  `exact-match` trong plan = 0 hit → **M1**.
- O2, O4, O5 **sửa thật** (đọc file, không tin bảng trạng thái): target chốt rõ app vninvest;
  `main.tsx` có assert thứ tự preload→render + giá trị thật; 3 case curl Origin có thật.
- O3 sửa thật nhưng sinh **M3**: `dirty:<git status --porcelain>` trả `""` không phải `false`.
- Review Focus 3 còn stale `check-staging.cjs` → **M2**.
- O6–O9 ✅. 10 task có fail-before→pass-after→commit đầy đủ. Không claim `in-progress` xung đột.
- Reservation: file B4 `CONSENSUS_20261122.md` và B8 `REAUDIT_FINAL.md` chưa tồn tại.

**Đã sửa M1–M3 trong plan** (exact-match ở file map + Task 5 Step 3; `.mjs` ở Review Focus 3;
map `dirty` boolean ở Task 6 Step 4).

## B3 — vòng 3 (LIMIT — vòng cuối) — 2026-11-22

**Auditor:** subagent khác, chỉ đọc. **Verdict: `AGREE`** — 0 blocker, 0 major, 1 reservation nhẹ N1.

- M1 **PASS**: `location = /api/v1/entitlement` exact-match có ở file map `:115` + Task 5 Step 3
  `:207-209`, kèm cảnh báo `location ^~ /api/v1/` (`packages/web/docker/nginx.conf:254-265`) nuốt
  request. Ngữ nghĩa nginx đúng.
- M2 **AGREE**: mọi lệnh dùng `check-staging.mjs`; N1 chỉ là cụm ngoặc nhắc tên cũ `.cjs` ở `:111`.
  **Đã dọn N1** (bỏ cụm ngoặc) — grep giờ sạch.
- M3 **PASS**: map `dirty` boolean có ở Task 6 Step 4 `:239` kèm giải thích `""` ≠ `false`.
- Cấu trúc nguyên vẹn: 10 task, 6 luật cứng, không objection mới.

**Kết luận B3:** plan **đạt điều kiện kỹ thuật để sang B4**. LIMIT 3 đã dùng hết (2 vòng NEED_REVISION
+ 1 vòng AGREE) — không audit vòng 4.

**Cổng B4→B5 CHƯA mở:** cần Owner chốt D1–D7 và ký `docs/evidence/chart-enterprise/CONSENSUS_20261122.md`.
Chưa có file đó ⇒ **KHÔNG append claim implement, KHÔNG viết dòng code đầu tiên**. B8
(`REAUDIT_FINAL.md`) cũng còn thiếu, sẽ tạo sau khi code xong.
