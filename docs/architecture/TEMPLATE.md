# TEMPLATE — quy trình tài liệu hoá kiến trúc AS-IS (dùng lại cho repo khác)

> Mẫu này là **kết quả của một lần chạy thật**, không phải thiết kế trên giấy.
> Nó đã chạy 3/3 phiên trong `vninvest` và tạo ra `D01`/`D02`/`D03` (4.247 dòng).
> Mọi mục thêm vào đều trả lời cho một lỗi **đã xảy ra thật** — cột "Bằng chứng" ở
> §2 cho biết lỗi đó ở đâu.

---

## 1. Cách dùng

| Tình huống | Làm gì |
|---|---|
| **Repo mới**, chưa có tài liệu kiến trúc | Copy nguyên khối `# PROMPT` bên dưới, điền `CONTEXT`, chạy 3 lượt |
| **Repo đã có tài liệu kiến trúc** | Làm **Bước 0** trước (§4) — không làm thì tài liệu mới sẽ mâu thuẫn tài liệu cũ |
| **Repo nhỏ** | Xem ngưỡng bỏ qua §5 |
| Muốn dùng lại cơ chế cưỡng chế | Copy `tools/measure_repo.py` + `tools/verify_arch_citations.py`, sửa hằng số cho repo |

Tài liệu đầu ra đặt ở `docs/architecture/`, gồm: `README.md` (mục lục + quy tắc
chọn bộ tài liệu), `D01` (§1,2,6), `D02` (§3,4), `D03` (§5,7),
`OPEN_QUESTIONS.md` (việc chờ Owner quyết).

---

## 2. Mẫu prompt

Copy nguyên khối này vào agent. Phần `CONTEXT` là duy nhất cần sửa.

````markdown
# ROLE
Bạn là kiến trúc sư phần mềm. Nhiệm vụ: **deep audit** codebase hiện tại và
dựng bộ tài liệu Phân tích Thiết kế Hệ thống (SAD/SDS) làm **Single Source of
Truth** cho đội phát triển tính năng mới.

# CONTEXT
- Đường dẫn repo: [repo root]
- Bài toán cốt lõi: [1–2 câu]
- Tech stack phát hiện được: [React/… · Django/… · PostgreSQL/…]
- **Runtime dùng để đo**: interpreter [X.Y] · DB [loại, phiên bản] · OS [Windows/Linux]
  _Điền vào đây sau khi đo được, không đoán. Phần này bắt buộc — xem R6._
- Có sẵn quy trình agent nào không (AGENTS.md, CLAIMS, hook)? [có/không, mô tả]
- Quy mô: [số app/số model/số route/số LOC]

# NGUYÊN TẮC — 12 mục, mỗi mục kèm cơ chế cưỡng chế

**R1. Trước khi viết dòng nào: quét tài liệu hiện có, dựng bảng xung đột.**
Liệt kê mọi tài liệu kiến trúc/spec trong repo; với mỗi cái ghi: nó là **AS-IS**
(mô tả) hay **TO-BE** (kế hoạch), nó có mâu thuẫn code ở đâu không, tên file có
phân biệt được không. Nếu có 2 bộ cùng chủ đề → **đặt bảng phân biệt ở trang đầu
tài liệu mới, trước khi viết nội dung nào khác**.

**R2. Số liệu phải do script sinh, script commit kèm tài liệu, exit 1 khi lệch.**
Không được đếm tay rồi ghi vào bảng. Mọi con số trong tài liệu phải **tái lập được**
bằng một lệnh mà người khác chạy lại được.

**R3. Không viết tay phần cơ học lớn.** ERD, data dictionary, danh mục route,
bảng capability phải **sinh từ runtime introspection** của framework (ví dụ
`django.apps.get_models()`, walk URL resolver), không gõ tay. Số lượng lớn thì
bắt buộc sinh tự động.

**R4. Bắt buộc có mục `CHƯA CHẠY / CHƯA XÁC MINH`.**
Tách khỏi finding đã xác minh. Ghi rõ: cái gì **chưa** chạy, vì sao, lần chạy gần
nhất khi nào và kết quả ra sao. Không bao giờ viết "PASS" cho thứ chưa chạy.

**R5. Artifact leo thang quyết định riêng: `OPEN_QUESTIONS.md`.**
Mỗi mục phải có 5 cột: vấn đề · bằng chứng `path:line` · **vì sao tôi không tự
quyết** · đề xuị · mức ưu tiên. Danh sách phải **thu** khi Owner quyết, không
được phình.

**R6. Ghi runtime provenance cạnh mọi kết luận về hành vi.**
Kết luận phụ thuộc runtime phải kèm: interpreter + DB + commit SHA đo. Tài liệu
đo trên **khác major** với production là tài liệu sai, dù đo rất cẩn thận.

**R7. Mỗi gate/DoD phải kèm trạng thái `đã chạy` / `CHƯA CHẠY`, và phải xác minh
gate đó thật sự tồn tại.** Trước khi trích dẫn một gate là bằng chứng, hãy
**chạy thử hoặc đọc workflow** để chắc nó không bị tắt. Gate nằm trong
`workflows-disabled` thì viết "gate này không chạy", đừng viết "gate PASS".

**R8. Mỗi lượt phải chạy lại script của lượt trước trước khi viết tiếp.**
Mọi `path:line` đã viết phải còn hợp lệ. Mermaid C4 cần phiên bản ≥ 10.1 mới
render; luôn kèm fallback `flowchart` để tài liệu không trắng trên bản Mermaid cũ.

**R9. Mỗi lượt sau phải có một vòng phản biện: đi bác lại lượt trước.**
Bước bắt buộc trước khi viết: lấy các khẳng định quan trọng của lượt trước, **tự
mở file kiểm lại**, và đánh dấu kết quả: còn đúng / sai / không xác minh được.
Ghi kết quả vào tài liệu. **Phát hiện bị bác phải ghi lại, không xoá.**

**R10. Citation phải xác minh được bằng script, không bằng mắt.**
Mọi trích dẫn dạng `path:line` phải do script kiểm: file tồn tại, dòng nằm
trong file, và **không mơ hồ**. Citation chỉ ghi tên file không kèm thư mục (ví dụ
`models.py` cộng số dòng, trong khi repo có 15 file tên đó) là citation **hỏng**,
vì không ai biết nó nói file nào. Chấp nhận đường dẫn dài. Chạy script sau **mỗi**
lượt; exit ≠ 0 thì không được báo hoàn thành.

**R11. Mọi finding có vòng đời: ID · mức · owner · trạng thái
(`open`/`fixed`/`deferred`).** Finding đã sửa: **giữ nguyên dòng**, chỉ đổi
trạng thái + ghi chỗ đã sửa. Xoá dòng là mất dấu vết và sẽ tái phát.

**R12. Bộ tài liệu có `owner` và `review-by` ghi ở trang đầu.**
Không có thì không ai rà soát và nó sẽ hỏng trong im lặng.

**R13 (bắt buộc cho §7). SOP phải BÁM lớp kiến trúc đang tồn tại, không lấy từ
lý thuyết.** Không được copy một checklist generic kiểu
"Migration → Model → Repository/DAO → Service → Controller → DTO" — đó là lớp kiến
trúc Java/Spring, áp vào repo khác là sai. Phải truy ngược **3 cặp
`path:line` thật** trong repo rồi viết SOP theo đúng thứ đang có.

**R14. Trước khi viết BẤT KỲ script nào, kiểm tra repo đã có chưa.** Đọc thư mục
`scripts/`, `tools/`, và các gate trong CI. Nếu đã có gate làm đúng việc đó thì
**mở rộng nó**, đừng viết song song — hai gate cùng kiểm một thứ thì một sẽ chết
và người đọc không biết dùng cái nào.

**R15. Kiểm tra repo đang ở giai đoạn nào TRƯỚC khi chia 3 lượt.** Đếm endpoint
thật, số model, số dòng. Nếu tầng API/routing **rỗng hoặc gần rỗng** ⇒ repo đang
ở giai đoạn scaffold: viết đủ khung nhưng **mọi mục phải gõ rõ "đây là kế hoạch,
chưa phải hiện thực"**. Viết đủ 7 mục cho một scaffold sẽ tạo ra **văn bản thứ hai
đang bịa** cạnh bộ tài liệu TO-BE.

**R16. Citation xuyên repo phải có nhãn riêng.** Trong hệ sinh thái nhiều repo, rất
nhiều `path:line` trỏ tới **repo khác** (`core/src/types.ts`, `engine/src/…`).
Nếu không đánh dấu, mọi gate sẽ báo động giả và đội sẽ tắt gate. Gắn nhãn kiểu
`<!-- FOREIGN-REF: <repo>@<commit> -->` quanh citation đó để gate bỏ qua có
chủ đích, **không** bỏ qua toàn bộ tài liệu.

# QUY TRÌNH (3 lượt, có duyệt giữa mỗi lượt)

**Lượt 1 — Audit & khung.** Bước 0 (R1) → Bước 1 audit codebase → §1, §2, §6.
Dừng lại, trình Owner duyệt. Chưa viết §3–5, §7.

**Lượt 2 — Dữ liệu & kiến trúc.** R9 phản biện lượt 1 → §3, §4 + Mermaid ERD +
≥3 sequence diagram cho luồng phức tạp nhất. Dừng lại, duyệt.

**Lượt 3 — API, UI/UX & SOP.** R9 phản biện lượt 2 → §5, §7 (SOP theo R13).
Chốt: chạy lại **toàn bộ** script (R2 + R10), cập nhật `README.md`, đóng các
mục đã xử lý ở `OPEN_QUESTIONS.md`.

# ĐẦU RA — mục lục bắt buộc
## 1. Executive Summary & System Overview (1.1 mục tiêu/phạm vi · 1.2 C4 Context ·
1.3 Glossary & Domain Entities)
## 2. Business Process & Functional Specs (2.1 FBD · 2.2 Use case kèm
Trigger/Pre/Post + happy path + edge case + sequence diagram · 2.3 RBAC matrix)
## 3. Technical Architecture & Component Design (3.1 C4 Container/Component ·
3.2 Data flow + state management · 3.3 Tích hợp bên thứ ba · 3.4 AuthN/AuthZ)
## 4. Data Modeling & Storage (4.1 ERD kèm PK/FK/Type/Nullable · 4.2 Data
dictionary · 4.3 Cache/Transaction/ACID)
## 5. API & Interface Specs (5.1 Quy ước API · 5.2 Request/Response + global error
JSON · **5.3 kiến trúc UI/UX: navigation, component tree, state, design token**)
## 6. Audit & Technical Debt (6.0 tóm tắt điều hành · 6.1 điểm không chuẩn mực ·
6.2 rủi ro bảo mật/hiệu năng/mở rộng · 6.3 đề xuất P0→P2 · **6.4 xung đột quy
trình cần Owner quyết** · **6.5 CHƯA CHẠY / CHƯA XÁC MINH**)
## 7. Onboarding & Feature SOP (7.1 cấu trúc thư mục · 7.2 check-list thêm tính
năng · 7.3 DoD kèm cột trạng thái gate · **7.4 bẫy đã mắc thật**)
## Phụ: OPEN_QUESTIONS.md (việc chờ Owner quyết)

# ĐỊNH DẠNG
- Mọi khẳng định có `path:line`. Không có dòng thì không có giá trị.
- Mọi sơ đồ là Mermaid. Không trộn ngôn ngữ; tài liệu viết bằng
  **tiếng Việt có dấu**, giữ nguyên dấu khi ghi file (dùng editor/tool ghi UTF-8,
  không dùng PowerShell `Add-Content` không chỉ định encoding).
- Cụ thể, không chung chung. "Xác thực an toàn" là vô dụng; phải ghi thuật toán,
  thời hạn token, nơi lưu, cơ chế refresh.
- Không viết tính năng ngoài phạm vi code. Thiếu/dở dang → `[CHƯA XÁC MINH]`.
````

---

## 3. Vì sao mỗi mục tồn tại

Không mục nào ở §2 là để trông đầy đủ. Mỗi mục trả lời một lỗi đã xảy ra.

| # | Cơ chế cưỡng chế | Lỗi đã xảy ra ở `vninvest` |
|---|---|---|
| R1 | Bảng xung đột ở trang đầu | `docs/architecture/D01…D03` (AS-IS) trùng tiều tố với `docs/saas_design_pack/D01…D12` (TO-BE). TO-BE mô tả 12 bảng **chưa tồn tại** ⇒ dev đọc phải import model không có |
| R2 | Script + exit 1 | Số liệu đầu tiên ghi **123** migration, đo ra **115**; route ghi **5**, thực tế **609**. Sai lệch 122 lần, không ai phát hiện vì không có cách tái lập |
| R3 | Sinh từ runtime | Data dictionary **107 model**. Viết tay là chắc chắn sai và không kiểm chứng được |
| R4 | Mục riêng `6.5` + `CHƯA CHẠY` ở `D03` | Baseline test chạy trên Django **6.0.6** trong khi production chạy **5.2.17**; "test xanh" không bảo chứng được điều đó |
| R5 | `OPEN_QUESTIONS.md` 172 dòng | 4 mục P0 agent **không thể tự quết** (deny-list mâu thuẫn với yêu cầu cập nhật; CI tắt vì billing; vá tạm hay sửa gốc; nâng major). Chỉ ghi "To-Do" là đủ để chúng chết đi |
| R6 | Trường bắt buộc | Cùng nguyên nhân với R4. Thêm nữa: test chạy trên `cp1252` với `print()` tiếng Việt có dấu → `UnicodeEncodeError` giữa chừng |
| R7 | Cột trạng thái | **9/10 workflow bị tắt** vì billing. Mọi "gate PASS" trên PR là ảo |
| R8 | Chạy lại script mỗi lượt | Chạy lại lần đầu mới ra 0 lỗi; số liệu cũ đã sai từ lúc viết |
| R9 | Vòng phản biện | Nghi ngờ 33 chỗ `django.utils.timezone.utc` còn sót → AST quét từng file ra **0**; 1 finding bị bác sau khi mở file kiểm. Không có R9 thì cả 2 đều vào tài liệu như sự thật |
| R10 | `verify_arch_citations.py` | Đo trước khi viết script: **261 citation**, trong đó **117 (45%) là bare basename** không xác minh được, **11** trỏ file không tồn tại. Cùng bệnh `AGENTS.md` (sai 20 `file:line`) |
| R11 | ID + owner + trạng thái | `OPEN_QUESTIONS.md` phải tự viết *"danh sách phải thu, không được phình"* — dấu hiệu không có cơ chế nào ép thu |
| R12 | `owner` + `review-by` | Bộ docs chỉ ghi commit đo, không gì khác ⇒ không ai rà soát sau 3 tháng |
| R13 | SOP là output | Checklist generic trong mẫu là lớp **Java/Spring**. Chạy thật bị **thay toàn bộ** bằng SOP Django/DRF thật |
| **R14** | Đọc `scripts/` + gate CI trước khi viết script | `vnsaas` đã có `verify-design-pack.mjs` **5 lớp** (L2 kiểm `file[:line]`, L3 ground truth khớp code) + **40 khối `FOREIGN-REF`**. Chạy thật: **PASS**, 99 citation hợp lệ. Làm đúng mẫu mà không kiểm ⇒ viết script trùng lặp |
| **R15** | Đếm endpoint/model/LOC trước khi chia lượt | `vnsaas`: **12 model** thiết kế kỹ nhưng **2 endpoint**; `commercial`/`ops_audit`/`tenant_lifecycle` đều `urlpatterns = []`, `views.py`+`serializers.py` mỗi file **1 dòng**. DRF + `drf_spectacular` + `django_filters` cài đủ nhưng chưa dùng |
| **R16** | Nhãn `FOREIGN-REF` cho citation xuyên repo, **và gate phải hiểu nhãn đó** | Bộ SAD của agent khác ở `vninvestcharts-widget`: **913 citation, 180 (19%) không xác minh được**, trong đó **90 là citation XUYÊN REPO** — không phải lỗi, nhưng không có nhãn thì gate báo động giả. R16 chỉ có giá trị khi **tool cũng được sửa**; thêm quy tắc mà không sửa gate thì tự tạo ra nợ mới |

Ví dụ citation xuyên repo được gate chấp nhận — nhờ nhãn ngay bên trên, không nhờ "nó nằm ở tài liệu khác":

<!-- FOREIGN-REF: vn-kline-engine-core@8a1f2c3 -->
· `core/src/types.ts:318-323` — trích từ repo engine, **không** phải repo này.

Bỏ nhãn đi thì gate phải **FAIL**. Đó là điều làm nhãn có giá trị: nó biến việc
bỏ qua thành **quyết định có chủ đích, có dấu vết**, thay vì im lặng.

### 3.1 Ba lần chạy, đo được — bằng chứng cho các quy tắc trên

Không suy diễn từ lý thuyết. Ba repo, ba kết quả đo:

| Repo | Tài liệu | Citation | Không xác minh được | Gate sẵn có |
|---|---|---|---|---|
| `vninvest` | `D01–D03` 4.247 dòng | 261 | **117 (45%)** → đã sửa còn **0** | **không có** (tự viết) |
| `vnsaas` | `saas_design_pack` 13 file | 99 | **0** (đã sửa 33 lần trước) | 5 lớp + `FOREIGN-REF` |
| `vninvestcharts-widget` | `sad-2026-10-03` 3.323 dòng | 913 | **180 (19%)** | **không có** |

**Đọc ra:** R10 là quy tắc **giá trị nhất** và cũng dễ bị bỏ nhất. `vninvest` bị
45%, `vninvestcharts-widget` bị 19%, và chỉ `vnsaas` — repo duy nhất có gate —
là sạch. Không có ngoại lệ nào trong 3 lần này.

### 3.2 Điều chưa kiểm chứng được

**R13 chưa được kiểm chứng trên bất kỳ repo nào.** Cả `vnsaas` lẫn `vninvest`
đều là Django/DRF với `models.py`/`serializers.py`/`views.py`/`urls.py` — cùng lớp
kiến trúc nên SOP sinh ra gần như trùng nhau; `vnsaas` còn có tầng API rỗng nên
§7.2 không có gì để truy ngược. Cần một repo có tầng phân tần thật **và** khác
hẳn Django (ứng viên: `vninvest-sdk`, 355 file `.py`).

---

## 4. Bước 0 — làm gì khi repo ĐÃ có tài liệu kiến trúc

Không làm bước này thì tài liệu mới sẽ mâu thuẫn tài liệu cũ và mất niềm tin.

1. Liệt kê mọi file `.md` trong thư mục tài liệu + các file `.docx`/`.pdf`/`.xlsx` nếu có.
2. Với mỗi cái, trả lời: **AS-IS hay TO-BE**? Trỏ tới code nào? Còn đúng không?
3. Đối chiếu với code: chỗ nào tài liệu nói có nhưng code không có (và ngược lại).
4. Kiểm tra tên file: có bộ nào trùng tiền tố với bộ đang tạo không?
5. Ra bảng xung đột ở trang đầu `README.md`, kèm quy tắc chọn bộ nào.
6. Việc nào cần **Owner quyết** (đổi tên file của bộ cũ, thu hồi bộ cũ…) → `OPEN_QUESTIONS.md`.
   Không tự xoá hay đổi tên tài liệu của người khác.

---

## 5. Ngưỡng bỏ qua

Chạy đủ 3 lượt cho repo nhỏ là lãng phí. Ngưỡng gợi ý:

| Quy mô repo | Làm gì |
|---|---|
| `< 10k LOC` **và** `< 20` model/data entity **và** không có backend riêng | Chỉ §1, §6, §7.3. Bỏ qua C4 container, ERD, RBAC matrix |
| Thư viện/thư viện SDK không có hệ thống nghiệp vụ | §1, §6, §7.3 + API contract (nếu có). Không có "business process" |
| Dịch vụ ≥ 20k LOC hoặc ≥ 10 module | Đủ 7 mục |

Ngưỡng này **gợi ý**: nếu ngần ngại, cứ chạy; bỏ mục thì ghi lý do vào `README.md`.

---

## 6. Cập nhật khi code đổi

| Thay đổi | Phải làm |
|---|---|
| Thêm/sửa/xoá model hoặc entity | Chạy script sinh ERD + data dictionary |
| Đổi số liệu kiến trúc | Chạy `measure_repo.py`; lệch thì sửa **cả** bảng số liệu lẫn giá trị kỳ vọng trong script |
| Sửa code ở chỗ tài liệu trích dẫn | Chạy `verify_arch_citations.py`; sửa citation, không xoá |
| Đóng một finding | Đổi trạng thái thành `fixed` + ghi chỗ đã sửa. **Không xoá dòng** |
| Owner quyết xong một câu hỏi | Chuyển nội dung sang mục tương ứng, **xoá** khỏi `OPEN_QUESTIONS.md` |

---

## 7. Hạn chế của `verify_arch_citations.py` — biết trước để không tưởng nó bảo vệ hết

Script bắt được 4 loại lỗi: trỏ file không tồn tại · trùng tên gây mơ hồ · dòng
vượt cuối file · đường dẫn gốc repo không resolve được.

**Không bắt được loại quan trọng nhất: citation resolve đúng file, đúng dòng,
nhưng nội dung ở dòng đó không nói điều tài liệu khẳng định.**

Ví dụ đã xảy ra khi viết script: `OPEN_QUESTIONS.md` ghi `api_calls_limit` ở một
`models.py` nào đó + số dòng, không kèm tên app. File tồn tại, dòng tồn tại — nhưng
`commercial/models.py:107` là `error_code = CharField(...)`, còn `api_calls_limit`
nằm ở **`commercial/models.py:44`**. Script báo "hợp lệ"; chỉ đọc nội dung mới thấy
sai.

Lỗi đó chỉ bắt được bằng **R9 — vòng phản biện đọc file thật**. Vì vậy R9 không
được coi là tuỳ chọn, và **không có script nào thay thế được R9**.

Lỗi script đã mắc trong lúc viết, ghi lại để lượt sau tìm:

1. So hậu tố có `/` làm hụt đường dẫn gốc repo (`scripts/x.ps1`) ⇒ **7 trong 11
   `DEAD_PATH` là báo động giả**. Đã sửa: thử khớp tuyệt đối trước.
2. `print()` tiếng Việt có dấu trên Windows với stdout `cp1252` ⇒
   `UnicodeEncodeError` **giữa chừng**, mất toàn bộ danh sách lỗi. Đã sửa:
   `sys.stdout.reconfigure(encoding="utf-8", errors="replace")`.

---

## 8. Kết quả chạy thật ở `vninvest` (để đối chiếu khi dùng lại)

| Hạng mục | Kết quả |
|---|---|
| Quy mô repo | 15 Django app · 107 model · 115 migration · 1.029 route · ~121k dòng Python |
| Số phiên | 3, có duyệt giữa mỗi phiên |
| Đầu ra | 5 file `.md` / **4.307 dòng** (4 file `D01–D03` + `README` + `OPEN_QUESTIONS`) + 2 script trong `tools/` |
| Mermaid | 21 khối = 3 C4 · 12 ERD · 4 sequence · 2 flowchart |
| Citation | **262/262 xác minh được** sau khi sửa 33 |
| Script | `measure_repo.py` 8/8 OK exit 0 · `gen_data_doc.py` 107 model 0 orphan exit 0 · `verify_arch_citations.py` 0 lỗi exit 0 |
| Negative test | Tiêm 3 citation xấu → bắt đủ 3 loại, exit 1; khôi phục → exit 0 |
| Còn tồn đọng | 4 câu hỏi P0 chờ Owner · 9 mục `CHƯA XÁC MINH` · CI tắt |

`TEMPLATE.md` này (192 dòng) được thêm **sau** đợt chạy đó, khi đối chiếu xem mẫu
prompt ban đầu còn thiếu gì — nên nó không nằm trong 3 lượt.