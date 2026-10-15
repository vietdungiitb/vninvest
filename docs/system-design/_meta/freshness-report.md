# freshness-report — Ảnh Chụp Số Liệu (Máy Sinh, Không Sửa Tay)

> Sinh lúc: 2026-10-15 · Tool: `docs/system-design/_meta/tools/check-system-design.mjs`
> So sánh khi `--check`: chuẩn hóa CRLF, bỏ khối VOLATILE, token thời gian.

## 1. Số liệu kiến trúc (fail-closed)

| Fact | Đo được | Claims khớp |
|---|---|---|
| djangoApps | 15 | C-001 |
| models | 110 | C-002 |
| migrations | 121 | C-003 |
| composeStacks | 10 | C-004 |
| beatEntries | 43 | C-005 |
| systemDesignFiles | 43 | C-006 |

## 2. VOLATILE — biến động nhanh (thông tin, không chặn)

<!-- VOLATILE-START -->
| Fact | Giá trị | Cách đo |
|---|---|---|
| routes_total | 1473 | Đo 2026-10-14 bằng `docs/architecture/tools/measure_repo.py` (cần Django runtime, không nằm trong gate này) |
| routes_core_v1 | 615 | Như trên |
| web_src_tracked | 578 | `git ls-files packages/web/src` lúc sinh báo cáo |
| docs_md_total | 1828 | Đếm `docs/**.md` lúc sinh báo cáo |
<!-- VOLATILE-END -->
