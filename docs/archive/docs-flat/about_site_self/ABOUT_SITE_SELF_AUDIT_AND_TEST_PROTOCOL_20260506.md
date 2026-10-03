# SELF AUDIT AND TEST PROTOCOL — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: xác nhận site đủ chuẩn để bàn giao mà không cần hỏi lại, bằng test thực tế và evidence rõ ràng.

---

## 1. Audit philosophy

1. Không tính “build pass” là đủ.
2. Mọi thay đổi UI phải có screenshot.
3. Mọi thay đổi route/data phải có payload snapshot.
4. Mọi thay đổi security phải có command output hoặc page source proof.
5. Nếu một requirement chỉ được chứng minh bằng lời nói thì coi như chưa đạt.

---

## 2. Required audit cases

### A1 — Locale and content quality

**Goal**: xác nhận VI/EN hoạt động và tiếng Việt có đầy đủ dấu.

**Steps**:
1. Mở `/vi`.
2. Kiểm hero, CTA, footer, pricing teaser.
3. Chuyển sang `/en`.
4. Kiểm URL canonical, title và description.

**Expected**:
- default locale là VI
- nội dung VI không thiếu dấu
- EN là bản song ngữ, không thay thế VI

**Evidence**:
- screenshot VI
- screenshot EN
- page source snippet với metadata

---

### A2 — VNBrokerCharts demo integrity

**Goal**: `/chart` phải render bằng `vnbrokercharts`.

**Steps**:
1. Mở `/chart`.
2. Chọn 2 symbol hợp lệ trong whitelist.
3. Đợi refresh dữ liệu.
4. Confirm chart layer, whale overlay, and summary cards.

**Expected**:
- component render đến từ `vnbrokercharts`
- symbol đổi thì data đổi
- không có KLineCharts/ECharts/Recharts surface

**Evidence**:
- screenshot chart
- network trace cho `/api/bars/[symbol]`
- console không lỗi

---

### A3 — Relay guardrails

**Goal**: route handlers chặn symbol lạ và áp dụng cache/rate limit.

**Steps**:
1. Gọi `/api/bars/VNM?...`.
2. Gọi `/api/bars/INVALID;DROP?...`.
3. Spam request hợp lệ vượt ngưỡng.

**Expected**:
- valid symbol trả 200
- invalid symbol trả 4xx
- vượt ngưỡng trả 429
- response có `Cache-Control`

**Evidence**:
- curl output
- terminal output

---

### A4 — Pyodide sandbox

**Goal**: playground chạy code trong browser, không có server-side execution.

**Steps**:
1. Mở `/vnbroker/playground`.
2. Chạy mẫu code fetch dữ liệu.
3. Kiểm output.
4. Kiểm network tab xem chỉ đi qua relay same-origin.

**Expected**:
- script chạy thành công
- output panel hiển thị kết quả
- không có request thẳng tới backend host từ client code

**Evidence**:
- screenshot editor/output
- network trace

---

### A5 — Blog and SEO

**Goal**: MDX, metadata, sitemap, robots đều hoạt động.

**Steps**:
1. Mở `/blog`.
2. Mở ít nhất 1 bài viết.
3. Gọi `/robots.txt` và sitemap.
4. Kiểm metadata OG/canonical.

**Expected**:
- bài viết render đúng frontmatter
- sitemap có route public
- robots không chặn nhầm public pages

**Evidence**:
- screenshot list + article
- curl output sitemap/robots
- page source

---

### A6 — Legal and public links

**Goal**: legal page và CTA link đúng.

**Steps**:
1. Mở `/legal`.
2. Click CTA về SaaS login/register.
3. Click link chart docs/embed.

**Expected**:
- legal content render được
- tất cả internal links đúng locale route

**Evidence**:
- screenshot
- navigation proof

---

### A7 — Build and deploy smoke

**Goal**: build image và deploy service không lỗi.

**Steps**:
1. Build local package.
2. Build Docker image.
3. Deploy Portainer service.
4. Hit production domain.

**Expected**:
- build pass
- container healthy
- domain trả 200

**Evidence**:
- terminal log
- Portainer screenshot
- curl production domain

---

## 3. Test matrix

| Case | Command | Pass condition |
|---|---|---|
| Build | `npm run build` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Unit checks | component/route tests | exit 0 |
| Health | `curl /api/health` | 200 |
| Chart proxy | `curl /api/bars/VNM?...` | 200 + JSON |
| Invalid symbol | `curl /api/bars/ABC;DROP...` | 4xx |
| Rate limit | repeated curls | 429 |
| Blog page | browser render | screenshot |
| Playground | run sample code | output screenshot |
| Deploy smoke | curl public domain | 200 |

---

## 4. Residual risk rules

Nếu còn rủi ro, phải viết rõ một trong các loại sau:
- chart engine còn phụ thuộc vào package chưa publish,
- relay route còn cần thêm hardening,
- Pyodide CDN còn phụ thuộc network,
- blog MDX content còn ít bài,
- Portainer env var còn chờ Ops chốt.

Không được kết luận “done” nếu residual risk chưa được ghi đúng tên.
