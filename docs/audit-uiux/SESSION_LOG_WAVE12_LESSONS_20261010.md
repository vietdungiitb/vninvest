# NHẬT KÝ — Hệ thống LESSONS có cổng máy (wave 12, 2026-10-10)

> Bàn giao cho session kế tiếp. Bổ sung cho `SESSION_LOG_WAVE11_20261010.md`.
>
> **Đọc trước:** `docs/LESSONS/INDEX.md` §1.2 (C1/C2/C3) · §1.5 (kho) · §1.6 (việc còn treo).

---

## 1. Yêu cầu và kết luận

Yêu cầu: lesson đã ghi thành văn bản nhưng **chưa có cơ chế máy** phân loại + ghi thành
skill để agent tránh lặp. Tham khảo skill `agent-lessons` và quy trình của `vnbroker`.

**Kết luận: `vnbroker` đã ghi đúng sự thật về repo này.** CHANGELOG của nó viết
*"vninvest có `docs/LESSONS/` nhưng **không có** machine gate"* — đã kiểm lại, **đúng**.

| Thành phần | Trước | Sau |
|---|---|---|
| `docs/LESSONS/` | 31 lesson / 6 file | **37 lesson / 8 file** |
| Cổng máy | **KHÔNG có** | `scripts/check-lessons.mjs` (12 self-test) |
| Nối vào gate push | không | `pre-push-gate.mjs` mục `lessons` |
| Skill | `skills/project-lessons/` — **opencode không auto-load** | `.opencode/skills/project-lessons/` |
| Skill tự trích tag | 6 nhóm | 8 nhóm + **3 fallback** |

## 2. Bằng chứng "văn bản không chặn được gì"

Viết gate xong, chạy lần đầu vào thẳng `docs/LESSONS/` thật:

```
C1       frontend.md co 128 dong > 120 - tach them roi
```

Rồi mới thêm C3 thì lộ thêm:

```
DRIFT    INDEX.md §1.5 khong khai tong so lesson
```

Đo tay: `INDEX.md` §1.5 liệt kê `build-gates (L-G01..L-G02)`, `backend (L-B01..L-B02)`,
`frontend (L-F01)`, `security (L-S01)` — **số thực tế lần lượt là 7, 3, 8, 2**.
Tổng khai **17**, thực tế **31**. Sai 14, trong **4/6 file**, và **không ai bị chặn**
suốt thời gian file tồn tại.

### 2.1 Lỗi thứ hai của chính gate — "check im lặng = không có check"

Bản Python của `vnbroker` dùng `if (declared && ...)` — **chỉ kiểm khi tìm thấy** khai báo.
`INDEX.md` của repo này **không có** khai báo tổng ⇒ nhánh DRIFT **im lặng bỏ qua**,
in ra `1 loi` và trông như sạch.

Đã đổi thành: **không có khai báo ⇒ vi phạm** (thành quy tắc C3), kèm self-test
`DRIFT: INDEX khong khai tong so lesson` khoá lại. Nếu ai đó sửa về `if (declared)`,
case này FAIL ⇒ gate tự báo.

## 3. Cổng máy — `scripts/check-lessons.mjs`

C1 ≤ 120 dòng/file · C2 ≤ 40 lesson · C3 INDEX phải khai tổng + liệt kê mọi file.
Exit **0** sạch · **1** vi phạm · **2** **không verify được** (tuyệt đối không đọc là PASS).

**Ba khác biệt có chủ đích so với bản Python** (không phải lỗi):

1. **Lesson ID repo này không đồng nhất.** `multi-agent.md` dùng `L-001`, file khác dùng
   `L-F01`. Regex của bản Python `^## L-[A-Z]\d+` ⇒ **bỏ sót 8/31 lesson** mà không báo.
   Bản này nhận cả hai: `L-(?:[A-Z]+)?\d+`, có self-test khoá.
2. Tự lỏi BOM + quy CRLF khi đếm dòng. `Measure-Object -Line` **bỏ dòng trống** ⇒ lệch 10–29
   dòng/file. Hai phương pháp cho hai con số khác nhau.
3. Self-test **loại `GIT_*`** khỏi env khi spawn (lesson 17 của `agent-lessons`:
   self-test "17/17 PASS khi gõ tay, FAIL dưới hook").

### 3.1 Chứng minh wiring bằng cách chạy thật, không giả định

Không sửa `pre-push-gate.mjs`. Harness **trích nguyên văn block** `lessons gate` từ file
thật, chạy với đúng helper `run/ok/bad/skip`:

```
cay sach -> ok|lessons|check-lessons: 9 file | 37/40 lesson | ...
cay hong -> bad|lessons|  C1       big.md co 201 dong > 120 - tach them roi
```

Không chạy cả `pre-push-gate.mjs` vì nó chạy 17 gate (~10 phút); cần chứng minh **đúng
phần đang nối**, không phải tất cả.

## 4. Sáu lesson mới — đều từ chính wave 11

| ID | Nội dung | Chứng minh |
|---|---|---|
| **L-A01** | `git checkout -- <file>` hủy **cả** việc chưa commit | hazard 11 của skill, xảy ra 2 lần/phiên |
| **L-G08** | Gate **đỏ ở worktree, xanh ở main tree** — phải **thí nghiệm đối chứng** | `global-config-drift`: PASS trên `dev` sạch, FAIL trên worktree không sửa gì |
| **L-F09** | 2 `setSearchParams` trong 1 tick **không compose** | probe thật: `a=1` rồi `b=2` ⇒ `?b=2` |
| **L-F10** | Object literal cho option hook ⇒ memo vô hiệu ⇒ **treo render** | `keyMap` literal ⇒ **treo >600s**, xong 15s |
| **L-T01** | Ghi file = đổi line-ending; `--numstat` là cảnh báo sớm nhất | xảy ra **2 lần trong chính phiên này** |
| **L-T02** | Citation **đúng dòng nhưng sai file** | handoff ghi `WhaleBubbleChart.jsx:319`, thật ra `whaleAnalyticsSnapshotAdapter.js:319` |

## 5. ⚠ Tôi đã phạm L-T01 **hai lần trong chính phiên này**

| Lần | Việc | `numstat` | Nguyên nhân |
|---|---|---|---|
| 1 | Append lesson vào `build-gates.md` / `multi-agent.md` theo **CRLF** | `137/115` | nghĩ git lưu như đĩa |
| 2 | Dùng **Edit tool** thêm 13 dòng vào `pre-push-gate.mjs` | `392/378` | **Edit tool tự đổi LF → CRLF** |

Cả hai lần đều **bị bắt bởi `git diff --numstat`** — tức là bài học vừa viết đã bắt
được người viết nó. Đã sửa cả hai, `numstat` còn `14/0` và `21/0`.

⚠ **Thu phạm mới: KHÔNG CHỈ PowerShell.** Câu hỏi "có dùng lệnh Windows không?" **không đủ**;
phải hỏi **"file này LƯU dạng gì?"** bằng `git ls-files --eol` / `git cat-file blob`.

## 6. Còn treo

1. **§1.6 — văn bản còn hỏng trong `css-soc.md`.** `transition` → `ransition` (7 lần),
   `font` → `<TAB>ont`. Do `Set-Content`/`.Replace`. **Cố ý chưa sửa** để giữ diff đọc được;
   sửa bằng script Node, kiểm `--numstat` sau khi sửa.
2. **Chuẩn hoá lesson ID** `L-001` → `L-0X1`. **Chỉ khi đó** mới thu hẹp regex — thu hẹp
   trước sẽ âm thầm bỏ sót 8 lesson.
3. **Chưa nối skill vào `AGENTS.md`** như mục bắt buộc (vnbroker có ở `CLAUDE.md:4-13`).
4. `pre-push-gate` **chưa chạy trọn** trong phiên này (mất ~10 phút) — đã chứng minh riêng
   phần `lessons` bằng harness. 16 gate kia đã xanh ở wave 11.
