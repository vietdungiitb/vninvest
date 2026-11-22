# B4 — ĐỒNG THUẬN / chốt quyết định — 2026-11-22

> **Verdict:** **AGREE** (có 1 reservation, không blocker) — cổng **B4→B5 ĐÃ MỞ**.
> **Auditor B3:** `AGREE` (`docs/evidence/chart-enterprise/PLAN_AUDIT_20261122.md` vòng 3).
> **Người chốt:** Owner (trả lời 7 câu hỏi D1–D7 trong phiên 2026-11-22).
> **Đối tượng:** `docs/PLAN_CHART_ENTERPRISE_CLOSED_LOOP_20261122.md`.

## 1. Quyết định D1–D7 (Owner chốt)

| # | Quyết định | Lựa chọn đã chốt | Hệ quả thực thi |
|---|---|---|---|
| **D1** | Đường cấp tier enterprise | **Path A — online PAT** | Bắt buộc nginx `/api/v1/entitlement` + PAT server-only; không dùng blob offline làm tier chính |
| **D2** | Nguồn build widget ≥0.4.6 | **Owner cung cấp `GITHUB_TOKEN`** | Task 3 bump dependency qua registry GitHub Packages; không dùng tarball local. Registry hiện **E401** ⇒ token là prerequisite của B5 |
| **D3** | Credential staging | **Tenant/PAT demo riêng** (`vninvest-demo`) | Không dùng lại PAT của `widget-demo`/`charts.edusuccess.vn`; file root-only, browser `vni_pat` rỗng |
| **D4** | `@vninvestcharts/widget-pro` | **CÓ NGAY** | Chấp nhận EULA + registry token private; nạp qua `registerProExtension` sau verify license (`W:AGENTS.md:99`); Pine/strategy/replay vào scope đợt này |
| **D5** | Thay `PortfolioChart` ECharts | **Có, sau verify export** | Task E5 verify `Object.keys(import(...))` trước; không có export thì giữ ECharts + ghi exception |
| **D6** | Mở lại Wave 1/2 của `PLAN_WIDGET_FEATURE_LEVERAGE_20261112` | **Có, mở lại** | W-G..W-N được phép trong chương trình này; đảo quyết định Owner 12/11/2026 (`:224-232`) |
| **D7** | TTL/rotation | **Subscription dài hạn, không offline key** | Tenant enterprise hạn ~2126 như demo; PAT server-only có runbook rotate; không dùng blob 7 ngày |

## 2. Reservation R-B4-1 (không chặn)

B3 đạt `AGREE` **trước khi** Owner chốt D2/D4. Plan đã được cập nhật 2 đoạn:
- Task 3 Step 3: registry + `GITHUB_TOKEN` thay vì tarball local.
- Task 6/7 + Global Constraints: widget-pro vào scope ngay (EULA + `registerProExtension`).

LIMIT 3 của B3 đã dùng hết (vòng 1/2 `NEED_REVISION`, vòng 3 `AGREE`) ⇒ **không audit vòng 4**.
Sau AGREE, Owner chốt thêm D2b/D4b ⇒ plan được cập nhật thêm 6 đoạn (Task 3 Step 3, Task 6 Step 6,
Task 7 Step 1, Global Constraints, feature scope, status). R-B4-1 (mở rộng): người thực thi phải
đọc lại **toàn bộ các đoạn cập nhật D2/D4/D2b/D4b** ở lần đầu B6 trước khi viết dòng code;
nếu phát sinh objection mới thì ghi vào `REAUDIT_FINAL.md` ở B8, không tự sửa âm thầm.

## 3. Cổng sang B5

- [x] B3 verdict thành văn bản.
- [x] B4 consensus thành văn bản + 7 quyết định có người chốt.
- [ ] **B5**: append claim `chart-enterprise-demo` **in-progress**, commit riêng, worktree/branch
  `feat/chart-enterprise-demo`, hook cài đặt, `check-multi-agent` PASS.
- [ ] **Prerequisite D2**: Owner cung cấp `GITHUB_TOKEN` cho registry `@vninvestcharts`
  (hiện `npm view` trả E401). Thiếu ⇒ Task 3 `blocker`, ghi `CHƯA CHẠY`, không suy diễn.
- [ ] **Prerequisite D4**: văn bản chấp nhận EULA `widget-pro` + token registry private.

## 4. Cập nhật 2026-11-22 — registry probe làm thay đổi D2/D4

Sau khi có `GITHUB_TOKEN`, probe registry (`docs/evidence/chart-enterprise/REGISTRY_PROBE_20261122.md`)
cho thấy 2 blocker mới:

1. Registry chỉ có `widget@0.4.6` (**không có 0.4.7**); bản này có `subscriptionTier`/`tier_code`
   nhưng **0 hit** `/api/v1/entitlement`, `enterpriseBinding`, `EnterpriseDockProvider`,
   `fetchWhaleCampaigns`, `fetchOrderbookDepth` ⇒ **không đạt parity demo**.
2. Mọi `widget-pro@0.4.3/0.4.4/0.4.5` pin cứng `widget@0.4.3` ⇒ xung đột với D2 (`0.4.6`).

⇒ Owner đã chốt **D2b / D4b** (22/11/2026):
- **D2b = build local @ `ddc947dd`** (đảo D2): lấy chính commit demo của repo widget, đóng gói
  tarball pin vào `packages/web/package.json` (deny-list — coordinator). Bump engine
  `engine-core ^0.5.8` · `engine-drawing ^0.5.7` · `engine-react ^0.5.8` — registry có đủ
  (`W:package.json` @ ddc947dd yêu cầu).
- **D4b = DEFER widget-pro** (đảo D4): không cài widget-pro đợt này (pin `widget@0.4.3`),
  không `registerProExtension`, không import engine-pro. Pine/Strategy/Replay ra ngoài scope.

Các quyết định D1, D3, D5, D6, D7 giữ nguyên. **Cổng B4→B5 MỞ lại.**
`GITHUB_TOKEN` vẫn có thể cần để tải engine 0.5.8/0.5.7 từ registry; dùng transient ENV, không lưu file.

## 5. Trạng thái

**B1–B4 xong; B4→B5 mở.** Chưa có dòng code runtime nào được viết; chưa `npm install`;
chưa đụng staging. Mọi gate chưa chạy ghi `CHƯA CHẠY` trong baseline của plan.
Token Owner đã lộ trong chat ⇒ khuyến nghị rotate sau khi lấy engine xong.
