# ADR-007: Holdings broker và watchlist thủ công là hai làn tách bạch

- **Ngày:** 2026-10-14 · **Trạng thái:** ĐÃ CHỐT (Owner) · **Claim:** `multibroker-plan`
- **Căn cứ:** phản hồi vnbroker `RESPONSE_TO_VNINVEST_20261014.md` §2 REQ-003
  ("holdings không thay watchlist — khác biệt là ý định, không phải nguồn") +
  quyết định Owner cùng ngày
- **Liên quan:** ADR-005 (danh mục tường minh) · ADR-006 (broker SSOT)

## Quyết định

Holdings đồng bộ từ broker và watchlist thủ công của người dùng là **hai nhóm
riêng, không trộn lẫn**, để người dùng phân biệt và theo dõi chính xác:

| | Holdings | Watchlist thủ công |
|---|---|---|
| Ý nghĩa | Tôi đang **sở hữu** | Tôi muốn **theo dõi** |
| Nguồn | Provider (tiền thật), `PositionSnapshot(source='broker')` theo từng tiểu khoản | vninvest tự lưu (`Watchlist.source='manual'`), **không đẩy ngược lên broker** (không có API) |
| Mã chưa mua | Không bao giờ có | Đúng mục đích tồn tại |

## Luật bất biến

1. **Không gộp hai danh sách vào một view/bảng.** UI hiện hai khu vực riêng, mỗi
   dòng có badge nguồn (provider + tiểu khoản cho holdings; "Thủ công" cho watchlist).
2. **Watchlist dẫn xuất** ("Đang nắm giữ @ `<provider>`/`<tiểu khoản>`", sinh từ
   `PositionSnapshot(source='broker')`, `source='derived'`) là view hệ thống có nhãn
   rõ — không thay thế watchlist thủ công, không trộn vào nó.
3. **Danh mục trống ≠ watchlist trống.** Copywriting hai trạng thái rỗng phải khác
   nhau ("Chưa nắm giữ mã nào tại SSI ..." vs "Chưa theo dõi mã nào").
4. Schema (B0.2): `Watchlist` +`source` (`manual`/`derived`) +`provider`
   +`broker_account`? — bắt buộc TRƯỚC khi sinh dữ liệu dẫn xuất đầu tiên (không là
   phải viết script sửa dữ liệu cũ). `provider_watchlist_id` để sau (chưa provider
   nào có id để lưu).
5. Tên `get_watchlist` của TCBS ligo là **screener công khai, không phải watchlist
   user** — cấm dùng làm nguồn watchlist; cảnh báo đã có trong capability note.
