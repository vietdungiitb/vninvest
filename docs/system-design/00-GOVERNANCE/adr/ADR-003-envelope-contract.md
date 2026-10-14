# ADR-003 — Envelope Contract `{data, meta}`

- **Ngày:** hồi tố 2026-10-14 (quyết định có trước, ghi lại từ gate).
- **Ngữ cảnh:** client FE cần khung đáp ổn định để parse máy (không parse câu
  tiếng Việt để biết hành động tiếp theo).
- **Quyết định:** mọi API core bọc `{data, meta}`; lỗi có `code` máy đọc +
  `detail` tiếng Việt + `suggested_action` khi có (chuẩn khung lỗi ở
  `vninvest_core/exceptions.py:392`).
- **Thực thi bằng máy:** gate envelope 9/9 app, 0 UNWRAPPED (pre-push).
- **Hệ quả:** API mới không bọc envelope là vi phạm — gate chặn, không review tay.
