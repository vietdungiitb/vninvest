# Audit dọn dẹp & tinh giản — đề xuất

`verified: 2026-09-28 @ dab83196` · **đo trên `origin/dev`, KHÔNG xoá gì cả.**
Tài liệu này là *đề xuất*, cần bạn duyệt trước khi bất kỳ thứ gì bị xoá.

Mọi con số dưới đây đo được bằng lệnh, không ước lượng. Phần tôi **không** kiểm chứng
được ghi rõ ở mục 7.

---

## 0. Kết luận một dòng

Dự án **không thiếu code thừa nhiều, mà thiếu kỷ luật lưu trữ và an toàn dữ liệu.**
Dependency rất sạch (0 mục thừa). Vấn đề lớn nằm ở 3 chỗ: **dữ liệu production trong
git**, **1.704 tài liệu**, và **một cây `frontend/` đã chết**.

---

## 1. P0 — Dữ liệu production nằm trong git history

| Bằng chứng | Giá trị |
|---|---|
| `backups/` | **3 file, 155.6 MB**, đều **đang được git track** |
| Định dạng | `PGDMP` — PostgreSQL custom-format dump (dữ liệu nén) |
| Số bảng trong dump | **80** |
| Cột nhạy cảm (đếm trong schema) | `token`×72, `email`×41, `password`×32, `secret`×6, `api_key`×2, `balance`, `address` |
| Commit duy nhất chứa chúng | `e4fb0e31` *"chore: sync current workspace updates"* |
| Repo | **PRIVATE** (`disk=145451KB`) |

Đây là **sự cố bảo mật**, không phải vấn đề dọn dẹp. Ba file này tồn tại trong *history*,
nên xoá khỏi HEAD **không** gỡ được. Chúng nằm đó từ trước cả những phát hiện P0 đã ghi
trong `AGENTS.md` — thư mục `backups/` chưa từng được đưa vào danh sách vấn đề đã biết.

**Việc cần làm (không thuộc phạm vi dọn dẹp, nhưng chặn mọi thứ khác):**
1. Xác định phạm vi: 3 dump này có chứa dữ liệu user thật không (tôi **không** đọc dữ
   liệu, chỉ đọc phần schema).
2. Nếu có → đánh giá nghĩa vụ thông báo khách hàng / cơ quan chức năng.
3. Rewrite history **chỉ khi không còn agent nào đang chạy** (đây là điều `AGENTS.md` đã
   cảnh báo nhiều lần).

---

## 2. P1 — Tài liệu: 1.704 file

| Chỉ số | Giá trị |
|---|---|
| Tổng `.md` | **1.704** |
| File code (`.py` + `*.js/ts/tsx`) | 2.021 |
| **Tỉ lệ tài liệu / code** | **0,84** |
| `.md` nằm rải ở thư mục gốc | **68** |
| `docs/evidence/` | **180** |
| Có ngày trong tên | 1.241 (đều năm 2026) · 459 không ngày |

1.241 tài liệu đều sinh trong năm 2026 → đây là ** sprawl gần đây do làm việc nhiều
agent**, không phải tàn dư lịch sử. Nghĩa là nó còn sửa được bằng chính sách, không
cần viết lại lịch sử.

---

## 3. P1 — Cây `frontend/` đã chết: 737 file

| Bằng chứng | Kết quả |
|---|---|
| Số file tracked | **737** |
| Có trong `package.json` nào không | **Không** (chỉ có mô tả ở `package.json` root) |
| Có được `docker-compose` serve không | **Không** (chỉ một dòng comment về `frontend-beta`) |
| `AGENTS.md` | tự nói đây là đường dẫn **deprecated**, đã bị `packages/web/` thay thế |
| Commit sửa gần nhất | `4d3584f7` *"fix(nginx): enable realip module"* |
| Kích thước i18n trùng lặp | `frontend/src/i18n/vi.js` 3.234 dòng + `en.js` 3.208 — bản sao của bản ở `packages/web` (6.630 / 6.608) |

Tệ nhất: **pre-commit hook chặn mọi thay đổi trên `backend/` và `frontend/`**. Nghĩa là
cây chết này đang **làm chậm mọi agent** mỗi lần commit, để đổi lại không còn giá trị gì.

---

## 4. P1 — Bài test

| Chỉ số | Giá trị |
|---|---|
| Test runner ở FE | **3**: jest (120 file) + vitest (102 file) + playwright |
| Tên file quyết định runner | `*.test.*` → jest, `*.component.test.*` → vitest |
| Test BE chạy được | 642 |
| **Test BE không bao giờ chạy** | **1.802** (149 file dưới `src/`) |
| Vấn đề trong 1.802 đó | 55 fail + 47 error → **12 nguyên nhân gốc** |
| Hai package trùng tên | `src/*/tests/` và `backend/tests/` → `manage.py test user_workspace` **lỗi ImportError** |
| Test cần package không tồn tại | **23 test cần `vnbroker`** — repo không có package này |

Chi tiết đầy đủ: `docs/TEST_DISCOVERY_MEASUREMENT_20260928.md` (PR #55).

### Cần nói thẳng về "loại bỏ test cũ đã lỗi thời"

Tôi **không đề xuất xoá test fail để làm sạch bảng kết quả.** Đó là cách coverage rot
trở nên vô hình: số liệu đẹp lên, lỗi nằm im.

Phân loại đúng theo **nguyên nhân**, không theo "xanh/đỏ":

| Nhóm | Số | Đề xuất |
|---|---|---|
| Lỗi cơ học thuần (`timezone.utc` đã bị Django 5 xoá, test tự đóng connection) | 14 | **Sửa**, không xoá. Rủi ro thấp, không đụng hành vi |
| Test cho feature **chưa tồn tại** (`vnbroker`) | 23 | **Cần bạn quyết**: skip kèm lý do / coi là dependency ngoài / xoá nếu đã lỗi thời |
| Endpoint chưa vào URLconf | 39 | Chia theo feature; chỉ xoá khi feature **đã bị hủy**, có ghi lý do |
| Lỗi format (Content-Type, chuỗi) | 17 | Sửa dần |
| Đã fix ở PR #51 | 1 | Không làm gì |

Nếu mục tiêu là "gọn", `skip` kèm lý do sẽ cho bảng kết quả sạch **mà không giấu lỗi** —
điều mà xoá thì không.

---

## 5. P2 — Rác ở thư mục gốc

| Loại | Số | Ví dụ |
|---|---|---|
| Tổng file ở root | **138** | |
| Script `.py` dùng một lần | **33** | `cs2.py`, `fix_dup.py`, `fix_fmt.py`, `debug_*.py`, `test_*.py` (bản script tay, **không** thuộc test suite) |
| Tài liệu `.md` rải rác | **68** | `AUDIT_*.md`, `FINAL_*.md`, `SAAS_*.md` |
| File output rác | **13** | `extracted_raw_match_step_*.md`×8, `test_output.txt`, `backfill_hang_fix.patch` |

Lưu ý: 33 script `.py` ở root có tên `test_*.py` **không liên quan** tới test suite thật
(nằm ở `packages/core/backend`). Chúng gây hiểu nhầm khi ai đó tìm "test".

---

## 6. P2 — File quá lớn

**85 file > 600 dòng.** Vài cái đáng chú ý:

| Dòng | File |
|---|---|
| 6.630 / 6.608 | `packages/web/src/i18n/{vi,en}.js` (bản chất là từ điển — lớn là bình thường) |
| **3.939** | `packages/core/backend/src/market_data/stock_mgmt_native_views.py` |
| 3.043 | `packages/core/backend/src/data_ingest/tasks.py` |
| 2.483 | `packages/core/backend/src/user_workspace/portfolio_analytics_views.py` |
| 3.135 | `frontend/src/components/vnstockcharts/demo/LibraryShowcaseDemo.tsx` (trong cây chết) |

Đây là rủi ro bảo trì, nhưng **không nên tách nhỏ cơ học** trong cùng đợt dọn dẹp —
tách file mà test chưa đáng tin cậy là tự tạo bug mới.

---

## 7. Điểm tốt, và những gì tôi KHÔNG kiểm chứng được

**Tốt — không cần làm gì:**
- **Dependency: 0 mục thừa.** Cả 59 `dependencies` và 35 `devDependencies` của
  `packages/web` đều xuất hiện trong source. Đây là điểm đáng giữ.
- **Không có app "mồ côi"**: cả 16 app cục bộ đều có trong `INSTALLED_APPS`.
- Quy trình claim + PR đang hoạt động: 6 PR trong phiên này đều có claim khai trước,
  gate chạy thật, và bằng chứng ghi lại.

**Chưa kiểm chứng — cần người khác hoặc thêm thời gian:**
- **Dead code trong Python/JS**: tôi chỉ tìm thấy trùng lặp lớn (4 bản implement Fernet ở
  `encryption.py` / `crypto.py` / `security.py` / `models.py:879`) và cây `frontend/`.
  Chưa chạy phân tích reachability thật (vd. `vulture`, `knip`) nên **chưa khẳng định**
  còn bao nhiêu hàm/file chết.
- **Mức độ nhạy cảm thực tế của 3 dump**: tôi cố ý chỉ đọc phần schema, không đọc dữ
  liệu. Khẳng định "chứa dữ liệu user thật" cần người có quyền truy cập dữ liệu xác nhận.
- **Tài liệu nào còn dùng**: tôi đếm được 1.704 file nhưng **chưa phân loại được** cái nào
  còn được đọc. Xoá tài liệu mà không có tín hiệu sử dụng là mất lịch sử quyết định.

---

## 8. Phương án đề xuất — theo thứ tự, mỗi bước nhỏ và đo được

### Bước 1 — An toàn (không phụ thuộc gì, làm ngay)
Xoá 13 file output rác + 8 file `extracted_raw_match_*.md` ở root. Rủi ro gần như bằng 0.

### Bước 2 — Xử lý P0 dữ liệu production
**Cần bạn.** Xác minh phạm vi → quyết định thông báo → rewrite history khi không còn
agent chạy. Xoá `backups/` khỏi HEAD chỉ là một phần; phần còn lại nằm ở history.

### Bước 3 — Dọn root
Chuyển 33 script `.py` và 68 `.md` vào `archive/` có ngày, hoặc xoá nếu bạn xác nhận là rác.
Giữ lại: `README.md`, `AGENTS.md`, `TODO.md`, `WALKTHROUGH.md`, các `*_env.example`,
compose, script deploy.

### Bước 4 — Bỏ cây chết `frontend/` (737 file)
Xoá khỏi git. Sau đó **gỡ chặn `frontend/` khỏi pre-commit hook** — nếu không, người khác
vẫn cứ thử sửa và bị chặn. Đây là bước giải phóng nhiều nhất cho công việc sau này.

### Bước 5 — Chính sách tài liệu
Không xoá hàng loạt. Thay bằng:
- `docs/archive/<năm>/` cho tài liệu đã đóng, giữ nguyên lịch sử.
- `AGENTS.md` + `docs/CLAIMS.md` + `docs/OPEN_WORK_*.md` là nguồn sự thật hiện hành.
- Với tài liệu ở root và `evidence/`: giữ `evidence/` (là bằng chứng audit), archive phần còn lại.

### Bước 6 — Test
1. Sửa 14 test cơ học (không đụng hành vi).
2. Bạn quyết 23 test `vnbroker`.
3. Chia 39 lỗi endpoint theo feature.
4. **Chỉ sau đó** mới bật discovery, và bật ở mức **cảnh báo trước**.

### Bước 7 — Tái cấu trúc test runner
Gộp jest + vitest về một. Đây là việc **lớn và rủi ro** vì đổi tên file là đổi runner.
Chỉ nên làm khi Bước 6 xanh, và tách riêng PR.

### Bước 8 — Tách file lớn
Chỉ khi test đáng tin cậy. Mỗi file một PR.

---

## 9. Câu hỏi cần bạn quyết

1. **3 dump trong `backups/` có chứa dữ liệu người dùng thật không?** Tôi không đọc
   dữ liệu để tự trả lời. Câu trả lời quyết định có phải thông báo khách hàng hay không.
2. **23 test `vnbroker`**: bỏ, skip, hay xây package? Repo có production import nó ở 6 chỗ.
3. **`frontend/` có còn được deploy ở đâu từ repo này không?** Tôi không thấy compose
   nào serve nó, nhưng `docker-compose.beta.yml` có nhắc `frontend-beta`.
4. **Tài liệu**: bạn muốn `archive/` theo năm, hay chỉ giữ lại tài liệu còn liên quan?
5. **Có thời điểm nào mà không còn agent chạy** để rewrite history không? Đây là điều
   kiện tiên quyết cho Bước 2.
