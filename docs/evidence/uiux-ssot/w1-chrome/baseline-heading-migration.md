# W1-chrome — baseline `check-heading-contract` migrate có giải trình (O-29)

- **Ngày**: 2026-11-19 · **Slice**: `uiux-chrome-w1` · **Owner chốt**: ghi baseline có giải trình + mở slice riêng.
- **Không phải** "nâng baseline để xanh giả": 5 ID dưới đây là **nợ có sẵn** trên `dev@4aa4a0305`, chỉ lộ ra khi detector được sửa đúng (O-29). Không có dòng code nào của slice này tạo ra chúng.

## Detector trước/sau

- Trước (`check-heading-contract.mjs:81-85` cũ): `/<h1[\s/>]/` + `/createElement("h1")/` — **bỏ sót** `e("h1")` / `renderElement("h1")` và **đếm cả `<h1>` trong comment**.
- Sau: 1 regex chung `H1_RE`, strip comment giữ số dòng, dùng chung cho phát hiện lẫn đếm dòng; self-test 7/7 (thêm case alias + negative comment).

## 5 ID nợ cũ được ghi nhận

| ID | Bằng chứng | Trạng thái |
|---|---|---|
| `packages/web/src/pages/AIUsageAnalyticsPage.tsx#1` | tự render 1 `<h1>`, `ShellPageChrome` = 0 | follow-up |
| `packages/web/src/pages/SupportPage.tsx#1` | `SupportPage.tsx:311` `e("h1", …)` | follow-up |
| `packages/web/src/pages/TransactionsPage.tsx#1` | tự render 1 `<h1>`, shell = 0 | follow-up |
| `packages/web/src/pages/UpgradePage.tsx#1` | tự render 1 `<h1>`, shell = 0 | follow-up |
| `packages/web/src/pages/UserSettingsPage.tsx#1` | tự render 1 `<h1>`, shell = 0 | follow-up |

Đồng thời baseline bỏ entry `DashboardPage.tsx#2` đã hết sau khi slice chuyển trang này sang `ShellPageChrome`.

## Lệnh + kết quả

```
cd packages/web
node scripts/check-heading-contract.mjs --self-test   # 7/7 PASS
node scripts/check-heading-contract.mjs --update-baseline
node scripts/check-heading-contract.mjs               # exit 0, 0 vi phạm mới
```

## Follow-up (slice riêng, KHÔNG nằm trong PR này)

`W1-HEADING-FOLLOWUP` — chuyển 5 page trên sang `ShellPageChrome` (mỗi page 1 `<h1>`), xoá dần 5 ID khỏi baseline sau khi sửa thật. Owner/coordinator gánh slice này sau W1-chrome merge. Không tự làm trong slice này (D6 chốt scope 4 route).
