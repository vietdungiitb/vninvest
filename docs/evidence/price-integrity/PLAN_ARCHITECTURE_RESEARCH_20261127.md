# Kế hoạch nghiên cứu kiến trúc (DOC-ONLY) — 2026-11-27

**Lessons áp dụng:** [L-V01, L-V02, L-V03, L-007] · FILES READ: `docs/LESSONS/verification.md`, `docs/LESSONS/multi-agent.md`.

## Phạm vi
- `vnbroker` 3.10.0: registry/provider pool/source router/bulk router/health router/health store/adaptive controller/reference CafeF.
- `vninvest`: `data_ingest/tasks.py`, `market_data/models.py`, `market_data/pricing.py`, `market_data/cafef/*`, `market_data/corporate_actions/*`, `market_serving/*`, settings beat, `packages/web/src/adapters/chartAdapter.js`.
- Dữ liệu staging thật qua `docker exec` (chỉ đọc).

## Tiêu chí nghiệm thu
- Mọi khẳng định có `file:line` hoặc lệnh tái hiện; số liệu có lệnh; không có "chắc là được".
- Có CONTRADICTIONS riêng (plan/doc vs code).
- Có findings ID + mức + root cause + đề xuất.
- Có kiến trúc mục tiêu + lộ trình + quyết định cần owner.
- **Không đổi source/data** — chỉ docs.

## Checklist lessons
- [x] L-V01: số liệu từ lệnh thật (`os.getenv`, ORM count, probe VCI), không từ tóm tắt.
- [x] L-V02: đính chính kết luận cũ "trần/sàn dùng raw" bằng FPT ex-date thật.
- [x] L-V03: probe bằng client-side iteration (lần đầu dùng `.iterator()` trả `InvalidCursorName` đã ghi nhận).
- [x] L-007: mọi thứ không chạy được ghi `CHƯA XÁC MINH`.

## Non-goals
Không code, không migration, không đổi flag, không deploy, không backfill dữ liệu.
