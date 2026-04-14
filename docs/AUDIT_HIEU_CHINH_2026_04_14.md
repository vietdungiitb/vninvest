# AUDIT HIỆU CHỈNH 2026-04-14

## 1) Tóm tắt điều hành

Bản audit "Django quản lý bài viết" trước đó chỉ còn phù hợp ở mức nguyên tắc kỹ thuật nền (bảo mật, test, CI/CD, tối ưu, monitoring), nhưng đã lệch phạm vi nghiệp vụ và mức trưởng thành thực tế của VNInvest.

Đánh giá nhanh:
- Mức khớp định hướng: Trung bình.
- Mức khớp thực thi với codebase hiện tại: Thấp đến trung bình.
- Khuyến nghị: Dùng tài liệu này làm baseline mới cho 2-4 tuần tới.

---

## 2) Bảng đối chiếu thực tế

| Hạng mục | Đã hoàn tất (Đúng) | Còn thiếu / Chưa đúng | Ưu tiên 2-4 tuần |
|---|---|---|---|
| Phạm vi sản phẩm | Hệ thống hiện là stock tracker + robo-advisory realtime, không còn là blog CRUD. | Audit cũ bám Article/Comment nên sai domain triển khai. | Chuẩn hóa bộ tài liệu audit theo domain chứng khoán realtime và AI advisory. |
| Bảo mật cấu hình Django | Đã có env-based secret, guard production khi thiếu key, các cờ SSL/HSTS/CSRF cơ bản. | Chưa thấy bằng chứng rõ về CSP policy runtime, secret rotation runbook chuẩn hóa theo chu kỳ. | Bổ sung hardening checklist + runbook rotate secrets + kiểm thử rollback cấu hình bảo mật. |
| Quản lý secrets | .env và biến môi trường đã được áp dụng, file secrets đã ignore. | Tài liệu vận hành secrets giữa dev/staging/prod còn phân tán. | Gom thành một chuẩn "Configuration Contract" và checklist phát hành. |
| Kiến trúc API | DRF + JWT + throttle + nhiều endpoint health/admin/realtime đang vận hành. | Tài liệu API contract ở một số nhánh tính năng chưa thống nhất thành nguồn duy nhất. | Chốt "single source of truth" cho API contract public/internal. |
| Realtime pipeline | Có Celery/Redis/beat schedule tương đối đầy đủ, có prefetch và health endpoint. | Cần chuẩn hóa thêm SLO/SLA runtime (p95, freshness, error budget) thành tiêu chí release gate. | Ban hành Runtime SLO v1 + dashboard cảnh báo theo ngưỡng rõ ràng. |
| Docker hóa | Đã có docker-compose prod/dev, tách service backend/worker/beat/db/redis/frontend. | Cần thêm chuẩn hóa chiến lược image tag, rollback tag, và checklist migration-safe deploy. | Chuẩn hóa quy trình phát hành container và rollback trong 15 phút. |
| CI/CD | Đã có GitHub Actions (governance gate, large-file guard). | Chưa phải full pipeline chuẩn cho mọi PR (lint + full test matrix + security scans). | Dựng pipeline CI chuẩn 3 lớp: quality, test matrix, security. |
| Test tự động | Có số lượng test backend lớn, đã có nhiều test theo module nghiệp vụ. | Chưa thấy cấu hình pytest chuẩn hóa cấp repo; coverage gate chưa thể hiện rõ trong CI. | Chốt runner thống nhất + coverage gate theo module lõi rủi ro cao. |
| Refactor codebase | Đã tách nhiều module views_*; routing đã phân tách theo miền chức năng. | Vẫn còn file tổng hợp trung tâm, technical debt tổ chức lớp service/view chưa triệt để. | Tiếp tục strangler pattern, giảm dần coupling ở lớp views tổng hợp. |
| Monitoring/Observability | Có health endpoints và admin runtime KPI phục vụ quan sát vận hành. | Chưa thấy tích hợp trực tiếp Sentry/Prometheus client ở mức code evidence hiện tại. | Hoàn thiện telemetry stack và alert rule theo mức sự cố P1/P2/P3. |
| Quản trị tài liệu | Có ROADMAP_STATUS và nhiều tài liệu sprint chi tiết. | Mâu thuẫn phiên bản Django giữa tài liệu và requirements gây nhiễu điều hành. | Đồng bộ version truth trong toàn bộ docs trong 1 sprint ngắn. |

---

## 3) Backlog thực thi đề xuất (2-4 tuần)

### P0 - Cần làm ngay (Tuần 1)

1. Đồng bộ "nguồn sự thật" phiên bản công nghệ
- Chốt phiên bản Django/DRF/Python chính thức theo runtime thực tế.
- Cập nhật đồng bộ README, roadmap status, checklist vận hành.

2. Dựng CI chuẩn cho mọi PR
- Bắt buộc chạy: lint, unit/integration test, migration check, security scan dependency.
- Thiết lập rule pass/fail rõ cho nhánh dev/main/deploy.

3. Chốt Runtime SLO v1
- Định nghĩa: p95 API chính, tỉ lệ 5xx, cache hit ratio, độ tươi dữ liệu prefetch.
- Gắn SLO vào release gate và dashboard theo dõi.

### P1 - Nâng độ tin cậy (Tuần 2-3)

1. Chuẩn hóa monitoring stack
- Tích hợp error tracking + metric scraping + alert routing.
- Tạo runbook xử lý sự cố theo cấp độ.

2. Giảm technical debt lớp views tổng hợp
- Tách dần handler còn dính domain chéo sang module chuyên trách.
- Giữ backward compatibility route và test regression.

3. Chuẩn hóa test strategy
- Runner thống nhất, phân lớp smoke/regression/e2e nhẹ.
- Gate coverage cho module rủi ro cao thay vì target coverage dàn đều.

### P2 - Hoàn thiện vận hành (Tuần 4)

1. Chuẩn hóa quy trình phát hành Docker
- Version tagging, release notes, rollback template.

2. Chuẩn hóa quản trị secrets đa môi trường
- Rotation policy, checklist handover, kiểm thử khôi phục.

3. Hợp nhất tài liệu kiến trúc
- Giảm trùng lặp, quy định tài liệu canonical theo từng domain.

---

## 4) KPI kiểm chứng sau 4 tuần

- 100% PR vào nhánh chính đi qua pipeline CI chuẩn.
- 0 lỗi mâu thuẫn phiên bản giữa tài liệu chính và runtime dependency lock.
- Có dashboard vận hành với ngưỡng cảnh báo rõ cho tối thiểu 5 chỉ số runtime.
- Tỉ lệ lỗi production mức nghiêm trọng giảm theo tuần và có báo cáo hậu kiểm.

---

## 5) Kết luận

Audit cũ đúng về tư duy nền tảng nhưng không còn phản ánh đúng trạng thái trưởng thành của VNInvest hiện tại. Bản audit hiệu chỉnh này nên được dùng làm baseline điều hành kỹ thuật ngắn hạn để tránh lệch hướng ưu tiên và giảm rủi ro triển khai.
