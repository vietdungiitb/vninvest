# GATE — uiux-wave2 (Wave 2, Alert UX)

**Agent:** `uiux-wave2` · **Branch:** `feat/uiux-wave2` · **Base:** `dev @ 0b326bbe`
**Worktree:** `C:\Mujoco Projects\agent-uiux-w2` · **Ngày:** 2026-09-27
**Phạm vi:** chấm dứt pill-soup + curation 5 alert. **0 đổi API, 0 migration, 0 đụng BE.**

---

## 1. Đã làm (7/9)

| # | Việc | File |
|---|---|---|
| **2.1** | `sortAlertsByPriority` + `topAlerts` — severity → \|value\| → recency, dùng chung | `utils/alertDedup.js` |
| **2.2** | 4 pill viền → **2 badge + 1 dòng typography** | `UnifiedAlertCenter.js` |
| **2.3** | Bỏ filter trùng ở page; `severityCounts` giờ đếm trên list chưa lọc | `DashboardPage.tsx` |
| **2.5** | Xoá 2 nút phân trang (53px) → link "Xem thêm N cảnh báo →" | `UnifiedAlertCenter.js` |
| **2.6** | 8 family dùng key `alertCenter.fam*` có sẵn (thay map 5 key) | `UnifiedAlertCenter.js` + xoá 5 key chết `alert.source.*` |
| **2.7** | Render `title` (payload có sẵn, chưa từng hiện) + `isDuplicateSummary` + `freshness_state` | `UnifiedAlertCenter.js` |
| **2.8** | Xoá **21 prop chết** + import thừa + `activeTab` state | `UnifiedAlertCenter.js`, `DashboardPage.tsx` |
| **2.9** | Sửa **3 test khoá cứng 20** | xem §3 |

### 2.1 — vì sao cần thứ tự riêng

`sortAlertsByRecency` (đã có) chỉ sort theo thời gian ⇒ một cảnh báo nhỏ 20 giờ trước có thể nằm **trên** một cảnh báo critical 1 phút trước. Trong một lane chỉ đủ 5 dòng thì đó là sai câu chuyện. `SEVERITY_RANK` theo đúng `models.SeverityChoices` (`critical|high|medium|low`); severity lạ xếp cuối, không đè lên severity thật. Comparator `|value|` viết 2 lần (`AlertCenterPage.tsx:278-280`) nay có 1 nơi.

### 2.2 — pill soup đo được

| | Trước | Sau |
|---|---|---|
| Badge | 1 family + 4 pill viền | 2 (family + direction) |
| Dòng meta | 4 chip, wrap 2 hàng = **52px** | 1 dòng typography = **~22px** |
| Giá trị | lặp 2× (chip "Giá trị: 1,3 tỷ" + bold "· 1,3 tỷ") | 1× (cột phải, `tabular-nums`) |
| Chiều | lặp (chip "↓ Bán" + "bán" trong body) | 1× |

Ước lượng **~130px → ~93px** mỗi thẻ (chưa đo trong browser).

### 2.7 — `title` có sẵn từ trước

BE `serializers.py:31` luôn gửi `title`; `summary = body` nên hiện cả hai là lặp. Nay dùng `isDuplicateSummary` (helper đã có sẵn ở `alertCenterFormat.ts:113-117`, `AlertCard.tsx:171` dùng đúng) để chọn: title+summary nếu khác, title nếu trùng.

## 2. KHÔNG làm — 2.4 (read-state)

`useAlertCenterActions.ts` có `seenAlerts` nhưng là **state local**, comment tự nhận: *"BE AlertCenter chưa có endpoint seen - không gọi BE"*.

Nối nó vào dashboard ⇒ mọi thẻ "đã đọc" **reset mỗi lần reload**, tức tạo ra read-state chết — tệ hơn badge trung tính trung thực đã làm ở Wave 1 (1.8). Cần quyết định sản phẩm + endpoint BE trước. **KHÔNG tự ý.**

## 3. Test đã sửa — vì chúng khoá đúng hành vi đang bỏ

Đây là **đổi hợp đồng test**, không phải sửa cho xanh. Ghi rõ trong cả 3 file + commit body.

| File | Trước | Sau |
|---|---|---|
| `alert-list-20repro.component.test.tsx` | `expect(cardCount).toBe(20)` | `<= 5` + `> 0` + có link "xem thêm"; **thêm** test chứng minh hiện theo **ưu tiên** chứ không phải theo thời gian |
| `dashboard-alert-probe.spec.ts:100` | `toBe(20)` | `<= 5` && `> 0` |
| `dashboard-alert-probe.spec.ts:133` | `toBe(20)`, `firstCardH < 160` | `<= 5`, `firstCardH < 110` (siết theo markup mới) |

## 4. Gate

| Gate | Exit | Kết quả |
|---|---|---|
| `npx tsc --noEmit` | **0** | 0 lỗi |
| `npx eslint` (dashboard + alertDedup + page) | **0** | 0 error |
| `npm run check:shell` | **0** | PASS |
| `npx vitest run src/components/dashboard src/utils` | **0** | **52/52** |
| i18n parity | — | key `seeMore` đủ vi+en; 5 key `alert.source.*` đã xoá sau khi xác nhận **0 ref** |

## 5. 🔴 Tôi làm hỏng file một lần

Dùng `Set-Content -Value <array> -NoNewline` ⇒ PowerShell nối mọi phần tử **không có phân tách**, dồn 466 dòng thành **1 dòng**. Phát hiện ngay khi grep, khôi phục bằng `git checkout --`, làm lại toàn bộ bằng `edit` (công cụ giữ format).

Bài học: **không dùng `Set-Content -NoNewline` với array.** Chỉ dùng `edit` để sửa file nhiều dòng.

Ngoài ra `-replace` toàn file tạo 3 dòng nhân bản (mỗi chỗ vốn đã có cả `setSeverityFilter` lẫn `onSeverityFilterChange`) — `tsc` **không** bắt được (optional-call trùng lặp vẫn hợp lệ về kiểu), chỉ test mới phát hiện. Đã dò lại toàn bộ 3 chỗ.

## 6. CHƯA CHẠY

| Gate | Lý do |
|---|---|
| **`npm run build`** | **CHƯA CHẠY** |
| **Playwright `dashboard-alert-probe.spec.ts`** | **CHƯA CHẠY** — cần server + trình duyệt. Đây là thứ **duy nhất** đo được chiều cao thẻ thật; con số ~93px hiện là ước lượng từ CSS |
| vitest suite đầy | CHƯA CHẠY |
| `jest` · BE test | CHƯA CHẠY |

## 7. Còn lại của Wave 2

| Mục | Vì sao |
|---|---|
| **2.4** read-state | Cần endpoint BE (`useAlertCenterActions.ts` ghi rõ chưa có) |
| Đo chiều cao thẻ thật | Chạy Playwright probe |
