# i18n verify — mbw3-fe (`brokerWave3.*`)

Ngày: 2026-10-15 · Người verify (worker): agent FE · Chữ ký PM: **CHƯA CÓ — chờ supervisor/PM verify tay ≥3 key**

## 1. Quy ước slice (plan §1 + §4)

- Mọi chuỗi mới qua `t("brokerWave3.*")` + `defaultValue` tiếng Việt đầy đủ dấu.
- 1 khối duy nhất trong `vi.js:2362-2432` và `en.js:2365-2435` (FE là chủ duy nhất, không tách).
- Ngoại lệ cho phép: tái dùng key cũ khớp nghĩa (`brokerHub.data.positions.symbol/quantity` trong bảng derived).

## 2. Đối chiếu tay worker (4 key, phủ 4 nhóm)

| Key | VI (`vi.js`) | EN (`en.js`) | Dùng ở | defaultValue trong code |
|---|---|---|---|---|
| `brokerWave3.bindings.confirmAdd` | `Xác nhận gộp tiểu khoản này vào danh mục?` | `Confirm binding this sub-account to the portfolio?` | `BindingsPanel.tsx:385` | khớp VI |
| `brokerWave3.holdings.aggregateBody` | `Số liệu gộp từ các tiểu khoản môi giới. Không nhập giao dịch trực tiếp hay sửa số dư đầu kỳ ở đây.` | `Figures are merged from broker sub-accounts. No direct transactions or opening-balance edits here.` | `PortfolioHoldingsPage.tsx:246-249` | khớp VI |
| `brokerWave3.watchlist.derivedEmpty` | `Tiểu khoản chưa nắm giữ mã nào.` | `This sub-account holds no symbols.` | `ScopedWatchlist.tsx:203` | khớp VI |
| `brokerWave3.settings.goToBroker` | `Mở Broker Hub` | `Open Broker Hub` | `UserSettingsPage.tsx:262` (trong `<Link to="/broker">`) | khớp VI |

## 3. Quét máy

- `npm run i18n:scan:strict` trên VPS: **exit 0** (log `/tmp/mbw3-fe-i18n.log`).
- Tay: 36 key `msg("…")` (BindingsPanel) + 10 key (ScopedWatchlist incl. `manualEmpty/derivedEmpty`) + 4 key holdings + 3 key settings — **tất cả tồn tại ở cả 2 locale**, không key nào chỉ có 1 bên.
- 2 file mới không chứa chuỗi Việt_LITERAL ngoài `defaultValue` (check: chuỗi hiển thị duy nhất ngoài `t()` là `"—"` placeholder option và `toUpperCase()` provider code — không phải câu cần dịch).
