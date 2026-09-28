# Baseline audit gate — 2026-09-27

**Phase 2** của `docs/IMPLEMENTATION_PLAN_MANDATORY_AGENT_WORKFLOW_20260927.md`
**Lệnh:** `node scripts/audit-gates.mjs`
**Nguyên tắc:** inject 1 vi phạm đã biết vào từng gate, rồi kiểm tra gate có thật sự chặn không.

---

## Kết quả

| # | Gate | Phân loại | Bằng chứng |
|---|---|---|---|
| 1 | `check:dom-landmarks` | **CHẶN** | thêm `e('main')` thứ 2 vào `FullLayout.tsx` → exit 1 |
| 2 | `check:tokens` | **CHẶN** | thêm `.css` hex ngoài allowlist vào `src/theme/` → exit 1 |
| 3 | `check:admin-spa-routes` | **CHẶN** | thêm route `"/admin/p-not-covered"` → exit 1 |
| 4 | `check:i18n-hardcoded` | **CHẶN** | thêm chuỗi VI vào `src/components/advisory/` → exit 1 |
| 5 | `check:multi-agent` | **CHẶN** | claim file thuộc deny list → exit 1 |
| 6 | `check-large-files` | **FAIL SẴN** | fail ngay cả khi chưa vi phạm (exit 1) |
| 7 | `i18n:scan` | **BÁO LỖI NHƯNG KHÔNG CHẶN** | in `Unable to parse` rồi **exit 0** |
| 8 | `check:contrast` | **CHƯA CÓ CÁCH INJECT** | chưa tìm ra cách phá an toàn |

**Tổng: chặn 5 · báo-lỗi-nhưng-không-chặn 1 · không chặn 0 · fail sẵn 1 · chưa rõ 1 / 8**

---

## Dự đoán của tôi — **SAI**

Kế hoạch §5 Phase 2 ghi dự đoán *"**4/8 rỗng**"*. Kết quả thật: **0 gate rỗng**.

Hai kết quả tôi tưởng là rỗng hoá ra là **probe của tôi sai**, không phải gate hỏng:

| Tôi kết luận | Thực tế | Nguyên nhân |
|---|---|---|
| `check:tokens` LỖI ENOENT | Gate chặn đúng | Tôi ghi probe vào `src/styles/` — thư mục **không tồn tại**; gate chỉ quét `src/{components,pages,layouts,theme}` |
| `check:admin-spa-routes` RỖNG | Gate chặn đúng | Gate quét **text thô** bằng regex `path:\s*"(\/admin\/...)"` — tôi dùng **nháy đơn** nên regex không khớp |
| `check:dom-landmarks` RỖNG | Gate chặn đúng | Tôi thêm `<h1>` vào **comment**; gate đếm `e('main')` trong `FullLayout.tsx` |

> **Bài học:** suýt ghi "gate rỗng" vào báo cáo vì **dụng cụ đo sai**, không phải vì gate hỏng.
> Đây đúng là cái bẫy mà skill cảnh báo — *"a line number is not a verification"* /
> *"treat a second agent as a second opinion"*, mở rộng thành: **một phép đo sai thì kết luận sai,
> dù cẩn thận đến đâu**. Không có probe nào chạy được thì kết luận "rỗng" cũng chỉ là phỏng đoán.

---

## Hai phát hiện thật

### 1. `i18n:scan` — nguy hiểm nhất

In lỗi rồi **exit 0**. Người đọc log thấy `Unable to parse` nhưng CI vẫn xanh ⇒ **cảm giác an toàn giả**.
Đây là loại hỏng mà không có negative test nào phát hiện, vì ai cũng chỉ nhìn exit code.

Đã **vá tạm** ở PR #41 (Entry 237): dọn hết cú pháp TypeScript trong default value của lời gọi dịch.
Nhưng **nguyên nhân gốc chưa xử lý** — lần sau ai đó viết lại sẽ phá lại, và lần này không ai biết.

### 2. `check-large-files` fail sẵn

Exit 1 ngay cả khi không vi phạm. Theo chính bất biến thiết kế của kế hoạch: **gate fail sẵn thì bị bỏ qua**.
Đây là tiền lệ đã được ghi nhận ở claim `off-github-actions` — hiện vẫn chưa xử lý.

---

## Việc cần làm (chưa làm)

| # | Việc | Ưu tiên |
|---|---|---|
| 1 | `i18n:scan` phải **fail** khi in `Unable to parse` | **cao** — im lặng là tệ nhất |
| 2 | Tìm cách inject cho `check:contrast` để đo nốt | trung bình |
| 3 | `check-large-files`: dọn 77 vi phạm **rồi** bật chặn | thấp — nhiều việc |
| 4 | Nếu không sửa được `i18n:scan`, phải **loại nó khỏi `check:shell`** và ghi rõ lý do | trung bình |

---

## Ghi chú vận hành

- Script ghi file tạm vào cây repo rồi khôi phục trong `finally`.
- Nếu bị kill giữa chừng: `git status --short` rồi xoá mọi file `__gate_probe__*` / `__gp*`.
- Script **luôn exit 0**. Đây là tài liệu đo lường, không phải gate — nếu nó fail thì chính nó lại
  thành "gate rỗng" mà script này sinh ra.
- `git status` sau khi chạy: sạch, chỉ có `scripts/audit-gates.mjs` chưa commit.
