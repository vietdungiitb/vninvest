# RUN CODE REVIEW — About Site: VNInvest Ecosystem Hub

**Ngày**: 2026-05-06  
**Mục tiêu**: hướng dẫn reviewer tập trung vào bug, regression, security drift và spec drift của about site.

---

## 1. Review stance

Review phải trả lời bốn câu hỏi trước:
1. Có đúng là `vnstockcharts` được dùng cho `/chart` không?
2. Có route nào public còn fetch trực tiếp backend từ client không?
3. Có text user-facing nào chưa đi qua i18n tiếng Việt đầy đủ dấu không?
4. Có config/security drift nào làm site public kém an toàn không?

Nếu một trong bốn câu này không trả lời được bằng diff hoặc evidence, review chưa đạt.

---

## 2. What to inspect first

### 2.1 Diff surface
- `packages/opencore-site/**`
- `.github/workflows/opencore-site.yml`
- `portainer-stack-vninvest.yml`
- `backend/portfolio/views.py` nếu có relay endpoint mới

### 2.2 Immutable guardrails
- `frontend/src/components/WhaleBubbleChart.jsx` không được sửa vì project này.
- `vnstockcharts` là dependency nguồn, không copy chart logic vào about site.
- Pyodide code phải ở browser, không có server runner.

### 2.3 Public surface
- `/`
- `/chart`
- `/chart/docs`
- `/chart/embed`
- `/vnstock`
- `/vnstock/playground`
- `/blog`
- `/legal`
- `/api/bars/[symbol]`
- `/api/public/vnstock-data`

---

## 3. Review checklist

### Functionality
- [ ] Locale default là VI
- [ ] EN locale route hoạt động
- [ ] `ChartDemo` sử dụng `VNStockChart`
- [ ] `PlaygroundPanel` render chạy được
- [ ] Blog pages render MDX đúng
- [ ] Legal page render đúng

### Data contracts
- [ ] Symbol allowlist áp dụng ở route handler
- [ ] Relay response có cache headers
- [ ] Invalid symbol trả 4xx
- [ ] Rate limit trả 429 khi vượt ngưỡng
- [ ] Chart payload match `vnstockcharts` adapter contract

### Security
- [ ] Không có direct fetch từ browser tới backend host
- [ ] Không expose secret hoặc internal URL trong bundle client
- [ ] CSP hợp lý với Pyodide và static assets
- [ ] Không có `eval` server-side hoặc arbitrary code execution

### SEO / content
- [ ] Metadata per route tồn tại
- [ ] Sitemap và robots có route public
- [ ] OG tags hợp lệ
- [ ] Text mới có dấu tiếng Việt đầy đủ

### Deployability
- [ ] Docker build pass
- [ ] GHCR image name đúng
- [ ] Portainer env vars đầy đủ
- [ ] Container healthcheck pass

---

## 4. Required reviewer questions

1. Có chỗ nào hardcode string public-facing mà chưa qua i18n không?
2. Có route nào chấp nhận symbol free-form mà không validate không?
3. Có demo nào đang dùng fallback mock mà người đọc có thể tưởng là data thật không?
4. Có config nào phụ thuộc local dev path nhưng chưa nói rõ cách chạy production không?
5. Có chỗ nào Pyodide tải chậm nhưng không có fallback state không?

---

## 5. Stop-ship findings

Bất kỳ finding nào dưới đây là stop-ship:
- `/chart` không dùng `vnstockcharts`
- client fetch trực tiếp backend host
- thiếu i18n cho UI public
- thiếu whitelist hoặc rate limit
- thiếu CSP/header hardening
- blog/legal/SEO route bị broken
- Portainer deploy không khỏe

---

## 6. Review output format

Reviewer phải trả về:
- **Findings**: ordered by severity, có file reference
- **Open questions**: chỉ khi còn mơ hồ thực sự
- **Change summary**: ngắn, chỉ sau findings
- **Residual risk**: nếu có

Nếu không có finding thì phải ghi rõ: `No blocking findings.`
