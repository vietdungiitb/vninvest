# W2 — đóng 3 reservation minor (B8 AGREE, Entry 555)

- **O-31a**: `#0b1424` trong `DESIGN.md:7,74` nằm ngoài allowlist nhưng **là token có sẵn** tại `soc.tokens.css:46` (`--pf-surface`) — DESIGN.md chỉ mô tả giá trị hiện hữu, không tạo màu mới. `check-tokens` chỉ quét `src/`, exit 0. Không đổi hex.
- **O-31b**: `docs/evidence/uiux-ssot/w2/green2.md` + `green3.md` đã được commit cùng slice.
- **O-31c**: test `uiux-exp-w2.component.test.tsx` đã thêm assert state `empty` (`green3`, 2/2 PASS).

Không có blocker/major. Không nâng baseline, không palette mới.
