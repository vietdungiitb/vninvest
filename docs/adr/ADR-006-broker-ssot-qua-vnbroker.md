# ADR-006: Mọi vấn đề broker đi qua vnbroker (SSOT) — không tự phát triển

- **Ngày:** 2026-10-14 · **Trạng thái:** ĐÃ CHỐT (Owner) · **Claim:** `multibroker-plan`
- **Liên quan:** ADR-005 (danh mục tường minh) · `docs/REQUESTS_TO_VNBROKER_20261014.md`

## Quyết định

1. **vnbroker là nguồn sự thật duy nhất (SSOT)** cho mọi vấn đề broker: protocol, client,
   auth/token flow, ký request, chuẩn hoá response, danh sách endpoint được hỗ trợ.
   vninvest **không tự phát triển** logic broker mới dưới bất kỳ hình thức nào
   (không compat layer mới, không wrap-and-extend lén, không reverse-engineer private API).
2. **Ranh giới sở hữu:**
   - vnbroker: mọi thứ nói chuyện với server broker.
   - vninvest: credential vault (Fernet), tenant isolation, điều phối/sync/lịch, UI,
     audit, kill-switch policy, idempotency.
3. **Thiếu chức năng ⇒ văn bản yêu cầu chính thức**, không code tạm. Mọi yêu cầu sang
   vnbroker nằm ở `docs/REQUESTS_TO_VNBROKER_20261014.md`, đánh số `VNBROKER-REQ-nnn`,
   có API đề xuất + tiêu chí nghiệm thu + mức ưu tiên + trạng thái.
4. **Code broker hiện có trong vninvest** (`user_workspace/broker/`, `dnse_adapter.py`,
   `vnbroker_dnse_compat.py`) = tồn tại được miễn trừ (grandfathered). Không mở rộng;
   di dời dần về vnbroker khi có hàm tương đương (theo dõi ở VNBROKER-REQ-005).

## Hệ quả cho kế hoạch multi-broker

- Wave 1 chỉ dùng API vnbroker 3.7.2 đã có; chỗ thiếu (capability machine-readable,
  TCBS order history, watchlist) đi đường văn bản yêu cầu, không workaround trong
  vninvest (kể cả try/except dò `_REMOVED_PATHS` nội bộ — private, có thể đổi).
- Gate mới cho mọi PR chạm broker: "logic này có thuộc về vnbroker không? nếu có mà
  code ở vninvest ⇒ từ chối, mở REQ thay thế".
