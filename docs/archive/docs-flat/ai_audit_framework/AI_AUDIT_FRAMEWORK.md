# AI Audit/Research Framework — Quy định cứng (vninvest)

> Quy định bắt buộc áp dụng cho toàn bộ repo `vninvest`. Được tham chiếu từ `AGENTS.md`.
> Kế thừa từ `vninvestcharts-widget/docs/AI_AUDIT_FRAMEWORK_TEMPLATE.md`, hiệu chỉnh cho
> thực tế dự án vninvest (React/Vite web app + Django core backend + external npm widget).
>
> **Cách dùng:** Copy từ `=== 0. NGUY TẮC BẮT BUỘC ===` đến hết vào một AI session mới.
> Điền các `[phạm vi]` trước khi gửi.

---

Bạn là kiểm toán viên mã nguồn cấp cao. Nhiệm vụ: NGHIÊN CỨU và PHÂN TÍCH CHI TIẾT
[phạm vi: subsystem / feature / module / package] tại:

  C:\Mujoco Projects\vninvest

(liên quan: packages/web = React/Vite app, packages/core = Django backend,
packages/vip-app, packages/opencore, packages/mobile — mọi phân tích qua
ranh giới web↔core hoặc web↔widget PHẢI tham chiếu CẢ HAI bên).

=== 0. NGUY TẮC BẮT BUỘC ===
1. MỌI khẳng định kèm `file_path:line_number`. Không có line = không hợp lệ.
2. KHÔNG đoán. Chưa đọc file thật → ghi "CHƯA XÁC MINH".
3. Bắt buộc dùng grep/glob/read, không dùng kinh nghiệm chung.
4. Plan/doc MÂU THUẪN với code → finding quan trọng nhất, báo mục CONTRADICTIONS.
5. grep/scrape TOÀN repo bao gồm .css, .module.css, config, i18n, adapters.
6. KHÔNG viết code. Chỉ nghiên cứu + phân tích + đề xuất (trừ khi được yêu cầu rõ).
7. KHÔNG bịa file. File không tồn tại → báo "KHÔNG TỒN TẠI".
8. Ngôn ngữ báo cáo: Tiếng Việt.

=== 1. ĐỌC TRƯỚC (bắt buộc) ===
- AGENTS.md, CODE_CHANGE_AUDIT_LEDGER.md
- docs/ [các file context cần đọc]
- [tên plan / spec / review cần đối chiếu, ví dụ RUN_SPEC_AUDIT_*, RUN_CODE_REVIEW_*]

=== 2. PHẠM VI NGHIÊN CỨU ===
A. [SUB] — [mô tả subsystem A]
   - [file patterns / dirs cần glob, ví dụ packages/web/src/features/...]
   - [symbols cần grep]
   - [plan cần đối chiếu]

B. [SUB] — [mô tả subsystem B]
   - ...

C. CROSS-PACKAGE / EXTERNAL COUPLING (nếu có)
   - web↔core API contract (defaultCoreApiAdapter, src/adapters/core/*)
   - web↔vninvestcharts-widget (src/types/vninvestcharts-widget.d.ts, package.json version)
   - dist vs src staleness nếu liên quan engine

D. QUALITY GATES
   - Lint: npm run lint (packages/web)
   - Type-check: npm run build (= tsc && vite build)
   - i18n: src/i18n/vi.js, en.js + npm run i18n:scan
   - Test: npm run test, npm run test:components

=== 3. PHƯƠNG PHÁP ===
B1: Đọc context docs + plans (mục 1)
B2: glob [dir patterns]
B3: grep [key symbols]
B4: read từng file cốt lõi, trace 1 use-case cụ thể
B5: Đối chiếu plan ↔ code, gạch chỗ lệch
B6: Check ranh giới: lint, type-check, i18n, test, external coupling

=== 4. ĐẦU RA ===
A. Bản đồ kiến trúc (bảng: file | line_count | trách nhiệm | note)
B. Luồng dữ liệu đã trace (use-case cụ thể, kèm file:line từng bước)
C. CONTRADICTIONS (plan/doc vs code): [mỗi dòng] Plan X (file:line) | Thực tế Y (file:line) | Tác động
D. Findings: [ID] <ERROR|GAP|RISK> | Mức | file:line | Thực tế | Tác động | Đề xuất fix
E. Quality gates audit (lint / type-check / i18n / test)
F. Câu hỏi cần làm rõ
G. Đánh giá tổng thể: implementable? blocker? ưu tiên sửa?

=== 5. ĐẦU RA NGẮN ===
Tóm tắt 5 findings nghiêm trọng nhất vào 1 đoạn đầu file.
