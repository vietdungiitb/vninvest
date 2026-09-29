# Phản Biện Vòng 2: Kế Hoạch Di Trú Legacy Frontend sang SaaS Native

* **Tài liệu gốc:** `LEGACY_FRONTEND_MIGRATION_IMPLEMENTATION_PLAN_20260622.md` (phiên bản đã cập nhật)
* **Tài liệu phản biện vòng 1:** `REVIEW_LEGACY_FRONTEND_MIGRATION_PLAN_20260622.md`
* **Ngày phản biện:** 2026-06-22 (Vòng 2)
* **Trạng thái:** Draft for Discussion

---

## Tổng quan

Tài liệu phiên bản cập nhật đã giải quyết tốt hầu hết các điểm yếu của bản đầu:
- Đã thêm Executive Summary, RACI Matrix, Shared Components Mapping, API Backend Readiness.
- Điều chỉnh timeline 16 → 28 ngày với lý do cụ thể.
- Hybrid Syntax Policy hóa giải tranh cãi `createElement` vs JSX.
- Thêm 7 Pre-Decommission Gates (A-G), Risk Register, Parity Metrics.
- Security remediation (HMAC + Pepper) được đề cập.

Dưới đây là các điểm còn cần thảo luận và chi tiết hóa trước khi finalize.

---

## 1. Timeline & Resource

### 1.1 Timeline buffer

| Giai đoạn | Estimate | Rủi ro tiềm ẩn |
|-----------|----------|----------------|
| GĐ 3 (UI & Routing) | 12 ngày | `StockDetail` (141KB legacy) + `Watchlist` (79KB) là 2 trang khó nhất. 1 Senior + 1 Junior. Nếu tính review + fix review (2-3 vòng), có thể kéo thành 14-16 ngày. |
| GĐ 5 (Shadow Run) | 3 ngày | Chỉ soak storage, không tận dụng được thời gian. Có thể viết E2E tests bổ sung hoặc performance tuning song song. |

**Câu hỏi thảo luận:** Cần buffer dự phòng (safety margin) bao nhiêu % cho toàn bộ timeline? Đề xuất 15-20%.

### 1.2 Resource Plan quá mỏng

| Vai trò | Khối lượng | Vấn đề |
|---------|-----------|--------|
| 01 Senior Frontend | Context & WS + KLine chart + StockDetail + Watchlist | Quá tải, dễ thành critical path blocker |
| 01 Frontend (2-3 năm) | 38 API adapters + 17 trang UI còn lại | Junior hơn nhưng khối lượng lớn hơn Senior |
| DevOps (kiêm nhiệm) | CI/CD, Docker, Nginx, Shadow Run | Dễ divided attention |
| QA (kiêm nhiệm) | E2E tests, visual regression, performance audit | Cần chuyên trách cho migration scope này |

**Đề xuất thảo luận:**
- Thêm 1 Frontend Developer (mid-level) để chia tải.
- QA nên chuyên trách ít nhất 50% thời gian trong suốt dự án.
- Xem xét contractor cho Giai đoạn 3 nếu internal resource không đủ.

---

## 2. RACI — thiếu Approver cho DoD

Bảng RACI đã có A (Tech Lead) cho mọi giai đoạn. Tuy nhiên, DoD cuối cùng cần phân định rõ ai sign-off từng tiêu chí:

| DoD | Nội dung | Đề xuất Sign-off Owner |
|-----|----------|------------------------|
| DoD 8 | 100% trang đã có TSX | Tech Lead + Product Owner |
| DoD 11 | Shadow Run parity >= 0.99 | Tech Lead + QA Lead |
| DoD 16 | Xóa legacy frontend/ | Tech Lead + CTO |
| Cổng F | Security Compliance | Security Lead |

**Đề xuất:** Thêm cột `Sign-off Owner` vào cuối bảng DoD và 7 Pre-Decommission Gates.

---

## 3. Giai đoạn 2 (Context & WS) — cần mini-spec

Hiện tại GĐ 2 chỉ nêu: "AuthProvider + Realtime WebSocket Provider". Cần chi tiết:

### 3.1 AuthProvider spec
- **Refresh token flow:** Silent refresh bằng interceptor? Hay redirect đến `/refresh` endpoint?
- **Expiry handling:** Token sắp hết hạn — refresh trước khi gọi API? Hay retry sau 401?
- **Logout:** Clear localStorage + revoke refresh token?
- **Session persistence:** Giữa các tab — `storage` event listener?

### 3.2 RealtimeProvider spec
- **WebSocket message types:** List cụ thể các message type (price_update, dark_flow, whale_alert, system_notification)
- **Reconnect strategy:** Exponential backoff: initial 1s, max 30s, jitter 0.1?
- **Heartbeat/ping:** Interval? Timeout?
- **Message ordering:** Cần đảm bảo không miss message khi reconnect? Sequence number?

**Đề xuất:** Thêm mini-spec inline hoặc link sang file spec riêng (`docs/WEBSOCKET_PROVIDER_SPEC.md`).

---

## 4. DoD 2 (i18n coverage) — chưa đủ mạnh

"i18n coverage report không còn thiếu key" — thiếu chi tiết:

1. **Công cụ:** Ai chạy? Dùng `i18next-scanner` hay custom script?
2. **Chất lượng:** Key có nhưng translate sai ngữ nghĩa thì sao?
3. **Native speaker review:** Cần ít nhất 1 vòng review bởi người Việt native.

**Đề xuất:** Bổ sung:
- "i18n scanner pass: không còn missing key"
- "i18n semantic review: 100% key mới được native speaker xác nhận"
- "Hardcode text check: ESLint rule cấm string literal tiếng Việt trong JSX/TSX"

---

## 5. DoD 9 (Playwright tests) — cần định nghĩa 4 luồng chính

"4 luồng người dùng chính" chưa được liệt kê. Đề xuất thống nhất:

| # | Luồng | Trang | Critical steps |
|---|-------|-------|----------------|
| 1 | Login → Dashboard | `/login` → `/dashboard` | Auth flow, portfolio load, heatmap render |
| 2 | Stock Detail | `/stocks/:symbol` | KLine chart, Order Flow Radar, whale markers, selected-session |
| 3 | Watchlist CRUD | `/watchlist` | Add/remove symbol, realtime price update |
| 4 | Screener | `/screener` | Filter rules, result grid pagination, export |

**Đề xuất:** List rõ 4 luồng (hoặc 5 nếu thêm Admin Core). Mỗi luồng cần defined acceptance criteria.

---

## 6. Hybrid Syntax Policy — cần enforcement

Policy: File Shell/Router → `createElement`; Trang nghiệp vụ mới → JSX.

**Vấn đề:** Không có enforcement thì policy sẽ bị phá vỡ ngay PR đầu tiên.

**Đề xuất:**
- ESLint rule: `react/no-jsx` cho file trong `pages/shell/` và `adapters/`
- ESLint rule: `react/prefer-jsx` cho file trong `pages/business/`
- Pre-commit hook kiểm tra

---

## 7. Security Remediation — còn chung chung

### 7.1 HMAC Pepper delivery
"HMAC kết hợp với khóa Pepper được cấu hình động từ phía máy chủ" — cần làm rõ:
- Pepper được trả về qua API endpoint nào?
- Cache pepper trong memory (session) hay localStorage?
- Nếu server trả pepper qua API, MITM có đọc được không? (cần HTTPS + certificate pinning?)

**Đề xuất:** Tách thành sub-task riêng với design document.

### 7.2 CSRF Guard
"Tất cả endpoint gọi qua coreApiAdapter phải cấu hình đúng X-CSRFToken" — nhưng core-api dùng JWT, không dùng session cookie. CSRF có còn là vấn đề?

**Đề xuất:** Xác nhận lại cơ chế auth của core-api. Nếu dùng `Authorization: Bearer <JWT>` thì CSRF không cần thiết.

---

## 8. Rollback Plan — thiếu trigger criteria cụ thể

### 8.1 Monitoring window
"Tỷ lệ lỗi HTTP 5xx tăng > 1%" — trong window bao nhiêu phút?
- 5 phút? 1 giờ? 24 giờ?
- Nếu 5 phút có 2 requests và 1 request fail = 50% — có rollback không?

**Đề xuất:** "> 1% trong sliding window 10 phút, tối thiểu 100 requests"

### 8.2 Alerting
- Ai monitor? Dùng công cụ gì? (Datadog? Grafana? Sentry?)
- Auto-rollback hay manual?
- Tech Lead có quyền đơn phương rollback? Cần notify ai trước?

**Đề xuất:** Thêm "Monitoring stack" section: Sentry for errors, Grafana for metrics, PagerDuty for alerting.

---

## 9. Shadow Run (GĐ 5) — thiếu exit criteria

Shadow Run 3 ngày với parity >= 0.99 — nhưng thiếu decision tree:

```
Ngày 1: parity = 0.97 → ?
Ngày 2: parity = 0.98 → ?
Ngày 3: parity = 0.99 → pass → GĐ 6
         parity < 0.99 → ?
```

**Đề xuất:**
- Nếu parity < 0.99 vào ngày 3: fix bug + chạy thêm 2 ngày nữa
- Nếu parity < 0.95 bất kỳ ngày nào: abort migration, quay lại legacy
- Quyền quyết định: Tech Lead + Product Owner

---

## 10. Giai đoạn 6 (Cutover) — cần checklists chi tiết

Hiện tại GĐ 6 chỉ nêu 3 việc:
1. Đổi context build docker-compose
2. Cập nhật Nginx proxy
3. Xóa frontend/

Cần checklist chi tiết hơn, đặc biệt cho bước cutover thực tế:

### 10.1 Pre-cutover checklist
- [ ] Backup tag docker image đã tạo?
- [ ] DNS TTL đã set low (60s)?
- [ ] Nginx config đã test syntax?
- [ ] docker-compose.prod.yml đã review?
- [ ] Rollback script đã test?

### 10.2 Cutover steps
1. `docker compose down frontend`
2. `docker compose up -d frontend` (với image mới)
3. `docker logs -f frontend` (monitor 15 phút)
4. Check health endpoint: `curl /health`
5. Check error rate < 0.1% trong 15 phút

### 10.3 Post-cutover (24h monitoring)
- Error rate
- Bundle size serving
- User login success rate
- WebSocket connection stability

---

## 11. Sắp xếp ưu tiên thảo luận trong meeting

| # | Chủ đề | Mức độ | Người cần tham gia |
|---|--------|--------|-------------------|
| 1 | **Resource Plan** — 1 Senior + 1 Junior có đủ cho 28 ngày không? | Critical | Tech Lead + PM |
| 2 | **Playwright test scenarios** — thống nhất 4-5 luồng chính | High | QA + Frontend |
| 3 | **Shadow Run exit criteria** — decision tree | High | Tech Lead + PO |
| 4 | **AuthProvider & RealtimeProvider mini-spec** | High | Senior Frontend |
| 5 | **Hybrid Syntax Policy enforcement** | Medium | Tech Lead |
| 6 | **Security: HMAC Pepper delivery mechanism** | Medium | Security + Backend |
| 7 | **DoD sign-off owner** | Medium | Tech Lead + PO |
| 8 | **Cutover checklist chi tiết** | Low | DevOps |
| 9 | **i18n review process** | Low | PO + Native speaker |

---

## Kết luận

Tài liệu đã đạt **mức độ chín muồi để đưa ra thảo luận team meeting**. Không còn vấn đề cấu trúc lớn nào; các điểm còn lại đều là chi tiết hóa và enforcement.

**3 quyết định cần đạt được trong meeting:**
1. Resource plan — có thêm người hay không?
2. Shadow Run — abort/fix/pass criteria cụ thể
3. Playwright test scenarios — 4 luồng nào?

Sau meeting, cập nhật tài liệu chính với các quyết định đã thống nhất và chuyển trạng thái từ `Draft for Discussion` → `Approved`.
