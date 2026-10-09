# REPORT FINAL — UI/UX wave 4 (Stage 8)

- **Nhánh**: `feat/uiux-wave4` → `dev`
- **Base**: `dev` @ `ea0002d00`
- **Ngày**: 2026-10-09 · **Quy trình**: `multi-agent-workflow` — **Mode A (3 worker + 1 supervisor)**, 8 stage
- **Ledger**: `## Entry 257`

---

## 1. TÓM TẮT 5 DÒNG

Đóng nốt toàn bộ việc dở của wave 3 (mobile Playwright, AC-3 `<h1>`, AC-4
import-graph, 4 file NAV-1 P1) và 2 major của audit Stage 5. **AC-2.4 mà handoff
dâng lên Owner là bất khả thi — Owner chốt sửa thành "giảm ≥ 4", và đo lại cho
thấy handoff đo sai 3 chỗ.** Phát hiện 1 lỗi thật: route `/stocks/:symbol` render
**2 `<h1>`**. Gate: `TONG 172 → 177` (baseline **nâng vì siết rule**), `lint` 0
error, `test:components` **844/844**, `playwright mobile-ergonomics` **2 passed**.

---

## 2. QUYẾT ĐỊNH CỦA PM — AC-2.4

`HANDOFF_UIUX_WAVE3_20261008.md` §5 hỏi: *"AC-2.4 đòi NAV-1 giảm ≥ 26 nhưng 3 hit
phải giữ ⇒ trần 21. Đề xuất sửa thành giảm ≥ 17."*

**Đã quyết theo hướng Owner, nhưng số phải sửa thêm — vì đo lại cho thấy đề xuất
đó cũng chưa đúng.**

| | Handoff nói | Đo lại | Vì sao lệch |
|---|---|---|---|
| Tổng hit NAV-1 còn sửa được | 26 | **4** | 17 hit là kết quả **W3-2 đã đạt rồi** (rồi bị gỡ lại 4 hit khi rollback escape) — không còn là việc chưa làm |
| Hit "cố ý giữ" | 3 | **7** | 4 file P1 còn lại có **4** `filtersDraft` (không phải 1). Cộng `searchDraft` = 5 draft, cộng 2 ô nhập form = **7** |
| Trần thực tế | 21 | **4** | |

**AC-2.4 mới** (`docs/PLAN_UIUX_WAVE4.md` §0.3):

> `counted` **108 → 104** (giảm ≥ 4) · 7 hit cố ý giữ được **liệt kê tường minh** ·
> `check-uiux-budget` exit 0 với baseline **đã nâng** lên số trung thực.

Một điểm handoff cũng sai và đã ghi rõ: **`selectedRequestId` không sửa được** —
nó khớp regex nhờ nhánh `|q`, là **hiện tượng regex** chứ không phải bộ lọc.

---

## 3. 5 SLICE — KẾT QUẢ

| Slice | Kết quả | Số đo (lệnh ở `TEST_REPORT_UIUX_WAVE4.md`) |
|---|---|---|
| **S1** Mobile | project `mobile-ergonomics` + **sửa CSS thật** cho vùng chạm | `undersized: none` (trước: 7 control < 44 px) · 2 passed |
| **S2** AC-3 | 6 trang có test `<h1>` + **sửa 2× `<h1>`** | 6/6 test · `/stocks/:symbol` **2 → 1** |
| **S3** AC-4 | `check-h1-graph.mjs` | 62 route · `--self-test` **8/8** |
| **S4** Major 1+2 | escape cấp biến · `replace` · `useUrlRecord` | `counted` 99 → 108 → **104** · self-test **5/5** · 35/35 test hook |
| **S5** docs | sửa 2 chỗ sai đã biết trong `TEST_REPORT_UIUX_WAVE2.md` | — |

---

## 4. PHÁT HIỆN ĐÁNG CHÚ Ý

### 4.1 `/stocks/:symbol` có **2 `<h1>`** — lỗi thật (WCAG 2.4.6)

```
ShellStockDetailPage.js:32-36  WorkstationShell(title) > StockDetailPage
  WorkstationShell.tsx:53        e("h1", …, displayTitle)
    StockDetailPage.tsx:330     e(StockDetailHeader, …)
      StockDetailHeader.js:76   e("h1", { className:"sdp-company-name" }, companyName)
```

Sửa `h1` → `h2`. An toàn: component dùng ở **đúng 1 chỗ**; `.sdp-company-name`
(`StockDetailPage.css:150`) set đủ `margin/font-size/font-weight/color/
line-height` ⇒ **không đổi hiển thị**.

⇒ Đây chính là thứ bộ test phòng thủ sinh ra để bắt. 3 vòng audit Stage 2 của
wave 3 đã không phát hiện vì **không** chạy render.

### 4.2 Test AC-3 của wave 2 **pass vì lý do sai**

`fireEvent.change(input, {value:"HPG"})` — **một** sự kiện mang giá trị **đã hoàn
chỉnh**. Người dùng thật gõ 3 ký tự ⇒ 3 sự kiện; với `push`, `navigate(-1)` chỉ
quay về `?search=HP`, **không** phải bảng chưa lọc. AC đó bảo vệ một hành vi
**không tồn tại**.

Đo lại trên code `dev`:

```
expected 'PUSH' to be 'REPLACE'
expected '/p?search=HP' not to contain 'search='
```

Test được viết lại thành 2 case mạnh hơn; **không xoá test nào**.

### 4.3 4/5 self-test của scanner là **tautology**

Cố tình cho `urlSyncdVars` đọc cả comment ⇒ self-test **PASS 4/4**. Lý do: `T1`
gọi `codeLines()` trước nên comment đã bị loại ở đường ống. Thêm `T5` gọi hàm
**trực tiếp** + cho hàm tự loại comment. Chứng minh lại: bỏ lọc ⇒ **FAIL 1/5**.

### 4.4 Baseline **nâng** 172 → 177 — vì **siết rule**

Escape cấp file đang giấu **12 hit**; bỏ nó ra thì gate nghiêm hơn. Bằng chứng
escape cấp file vô dụng: 7 file gọi `useUrlState` đều destructure **bản ghi**
(`const [{…}, setUrlState] = …`) ⇒ regex không khớp ⇒ **0 hit** ⇒ không file nào
đã sửa cần escape.

---

## 5. THAY ĐỔI HÀNH VI — OWNER CẦN BIẾT

**Major 2 bỏ khả năng "undo bộ lọc bằng nút Back".** Gõ trong ô tìm kiếm không
còn đẩy history ⇒ Back sẽ rời trang.

- **Lý do**: giữ hành vi cũ thì Back phải bấm **N lần**, N = số ký tự đã gõ.
- **Căn cứ**: test cũ pass nhưng **không** phản ánh điều người dùng thật gặp (§4.2).
- **Giá phải trả**: bộ lọc không còn nút hoàn tác nào khác.
- **Khuyến nghị**: nếu sản phẩm cần, thêm nút **"Xoá bộ lọc"** — **ticket riêng**,
  không làm trong wave này.

---

## 6. WAIVER VÀ NỢ CÒN LẠI

| # | Việc | Vì sao chưa làm |
|---|---|---|
| W-1 | `check-h1-graph --gate` **exit 1**: `unreferenced-registry-entry shell-ai-command-center` | **Lỗi CÓ SẴN** ở `dev` (`pageRegistry.js:201` khai, `main.tsx` không route). Script **tái hiện độc lập** phát hiện đã ghi ở `AGENTS.md` Entry 228. Cần Owner quyết: **nối route** hay **gỡ entry** |
| W-2 | 104 hit NAV-1 còn lại (ngoài 4 file P1) | Non-goal — mở rộng theo `nav1-report.mjs --why` |
| W-3 | 46 hit `CSS-2` (`prefers-reduced-motion`) | Non-goal |
| W-4 | Debounce cho ô nhập văn bản | `replace` đã chặn lịch sử rác; debounce là tối ưu hiệu năng |
| W-5 | `scan-ui-guidelines` chậm (**211 s** và **312 s** ở 2 lần) | Nguyên nhân đã định vị (`selectorName` O(40·n) mỗi dòng CSS) nhưng **không** sửa — ngoài phạm vi |
| W-6 | `expiresWithinDays` giữ kiểu `string` | Đổi `number` phải sửa cả form + chỗ đọc, **không** đổi hành vi |
| W-7 | Route cần đăng nhập trong Playwright | `auth.setup.ts` login thật vào `vite preview` **không backend** ⇒ project `setup` chết trước thân test |

---

## 7. BÀI HỌC CHO LEDGER

**Một test tự nó chứng minh "pass" chưa đủ — phải cố tình làm HỎNG code để xem nó
có đỏ không.** Wave này có **2** trường hợp, cả hai xanh **trước khi lẫn cũng lẫn
sau**: test AC-3 của wave 2 (vì `fireEvent.change` bắn 1 lần), và 4/5 self-test
của scanner (vì `codeLines()` lọc comment trước khi hàm kịp thấy).

Hai phần khác của wave này cũng đáng ghi:

- **Đo trước khi tin**: "escape cấp file vô dụng" là kết luận **tính được**, không
  phải đọc code rồi phán — 7 file dùng hook đều destructure `{` nên regex không
  khớp, có bằng chứng cơ học cho từng file.
- **AC bất khả thi nên nói ra, không nới**: `AC-2.4` sai không phải vì khó, mà vì
  nó đòi hành vi sai. Sửa AC + **liệt kê cái cố ý giữ** tốt hơn là làm yếu gate
  để số đẹp.