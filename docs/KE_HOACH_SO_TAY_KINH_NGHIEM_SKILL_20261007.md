# KẾ HOẠCH BÁO CÁO PROJECT MANAGER
## Sổ tay kinh nghiệm (Lessons) và Skill Autoload theo ngữ cảnh

> Ngày lập: 2026-10-07
> Trạng thái: **ĐÃ TRIỂN KHAI** — commit `6c49f5741` (chưa push, xem §7)

---

## 1. Mục tiêu báo cáo

Trình bày đề xuất **"Sổ tay kinh nghiệm + Skill autoload theo ngữ cảnh"** nhằm
ngăn chặn việc lặp lại các sai lầm quy trình đã từng xảy ra trong dự án multi-agent.

---

## 2. Bối cảnh vấn đề

Các lỗi quy trình đã lặp lại nhiều lần **dù đã được ghi nhận**. Nguyên nhân:

| Nguyên nhân gốc | Minh chứng thật | Hậu quả |
|---|---|---|
| **Kinh nghiệm phân tán** | `AGENTS.md` (bảng "Cạm bẫy"), `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/CLAIMS.md`, `docs/AGENT_PROTOCOL.md`, `docs/OPEN_WORK_*.md` | Agent phải tự mò lại, dễ bỏ sót. Không có 1 nơi tra cứu duy nhất. |
| **Chưa có cơ chế "đọc trước khi lập kế hoạch"** | Bảng "Cạm bẫy đã gặp thật 2026-09-26" liệt kê 6 lỗi — nhưng **không quy định** agent phải đọc lại trước khi plan | Cùng loại lỗi tái diễn: tự đặt số migration, commit file shared, chạy gate trước rebase, báo `PASS` chưa chạy. |
| **Chỉ là "ghi nhớ", không phải checklist hành động** | Bài học hiện tại là **bảng mô tả dạng diễn giải**, không có mục kiểm tra | Agent đọc qua loa, không áp dụng vào plan cụ thể. |
| **Ảnh hưởng nhân bản mạnh với multi-agent** | 1 agent mắc lỗi quy trình → lỗi khác agent không biết cũng mắc vì cùng quy tắc | Tốn thời gian xử lý conflict, chậm tiến độ, tăng nguy cơ chặn merge. |
| **Dữ liệu thực tế về registry** | `CLAIMS.md`: 216 KB / 759 dòng, 48 dòng chứa `in-progress`; hook cảnh báo **63** claim tham chiếu file không tồn tại | Registry phình to, khó tra cứu, nhiều nhiễu ⇒ dễ quyết định sai. |

---

## 3. Giải pháp đề xuất

**3 lớp bổ sung**, không thay thế hệ thống hiện tại:

| Lớp | Vai trò | Phân biệt với cái cũ |
|---|---|---|
| **A) Sổ tay hành động** `docs/LESSONS/` | Chứa "bẫy thực tế" dạng **atomic + checklist** | **LEDGER** = *đã xảy ra gì* (lịch sử, append-only). **LESSONS** = *phải tránh gì* (playbook). |
| **B) Skill `project-lessons`** | Chọn lọc **chỉ** lesson liên quan theo tag, trả checklist ngắn | Tránh context bloat — không đọc toàn bộ. |
| **C) Planning Gate** `AGENT_PROTOCOL.md` §11 | Ép buộc gọi skill + ghi `Lessons áp dụng` vào plan | Điểm kiểm soát duy nhất để quy tắc thi hành được. |

### 3.1 Cấu trúc đã tạo

```text
docs/LESSONS/
  INDEX.md        # Mục lục + mapping tag -> file + quy tắc ghi lesson mới
  multi-agent.md  # L-001..L-008
  migrations.md   # L-M01..L-M03
  build-gates.md  # L-G01..L-G03
  backend.md      # L-B01..L-B03
  frontend.md     # L-F01..L-F03
  security.md     # L-S01..L-S02
skills/
  project-lessons/SKILL.md   # Skill autoload theo ngữ cảnh
docs/AGENT_PROTOCOL.md        # +§11 Planning Gate (42 dòng)
```

### 3.2 Nội dung 19 lesson đã trích xuất

| File | Lesson | Nguồn |
|---|---|---|
| `multi-agent.md` | **L-001** KHÔNG commit file shared · **L-002** khai claim TRƯỚC sửa dòng đầu · **L-003** chạy gate TRƯỚC rebase · **L-004** tin số migration trong worktree · **L-005** hook im lặng khi tạo worktree · **L-006** không báo PASS cho thứ chưa chạy · **L-007** không có môi trường ⇒ không có kết luận · **L-008** không commit thẳng vào `dev` | Bảng "Cạm bẫy đã gặp thật 2026-09-26" |
| `migrations.md` | **L-M01** không tự đặt số migration · **L-M02** đọc head THẬT, không chỉ worktree · **L-M03** tránh multiple leaf nodes | Bảng "Cạm bẫy" |
| `build-gates.md` | **L-G01** thứ tự rebase → check migration → gate · **L-G02** ghi `CHƯA CHẠY` · **L-G03** gate máy agent không đại diện máy khác | `AGENTS.md` |
| `backend.md` | **L-B01** BE test không chạy trên SQLite (`array_agg`) · **L-B02** test nằm ở 2 thư mục · **L-B03** `print()` tiếng Việt gây `UnicodeEncodeError` | `AGENTS.md` |
| `frontend.md` | **L-F01** đo bundle bằng cạnh import TĨNH · **L-F02** Vite `__vitePreload` đặt sai chunk · **L-F03** `soc.module.css` chỉ là barrel | `AGENTS.md` |
| `security.md` | **L-S01** thứ tự revoke → rotate → purge KHÔNG đảo · **L-S02** secret trong file tracked = đã lộ | P0-SEC-01 |

### 3.3 Format chuẩn của một lesson

```markdown
## L-XXX: [Tiêu đề]

- **Nguyên nhân:** Ngắn gọn, đúng thực tế
- **Hậu quả thật:** VD: "Conflicting migrations; multiple leaf nodes"
- **Khi nào gặp:** `tags: [...]`
- **QUY TẮC:** "KHÔNG ... / PHẢI ..."
- **CHECKLIST:**
  - [ ] Câu hỏi kiểm tra cụ thể, trả lời Có/Không
- **Proof:** `file:line` | `docs/CODE_CHANGE_AUDIT_LEDGER.md#Entry-N` | commit hash
```

### 3.4 Nguyên tắc "context-aware autoload"

- **Tag-based**: skill trích tag từ `taskDescription` + `filePaths` + `actions`
- **Chỉ đọc phần cần thiết**: task "sửa migration `identity_access`" → chỉ load `migrations.md` + `multi-agent.md`
- **Output giới hạn** ~20 dòng: `LESSONS APPLICABLE` + `MANDATORY CHECKLIST` + `FILES READ`
- **Fallback an toàn**: task có từ khóa `claim`/`shared`/`migration`/`worktree`/`rebase`/`gate`/`agent` → **mặc định đọc `multi-agent.md`**
- **Chỉ gom bẫy thực tế**: quy tắc chưa từng gây lỗi thuộc phạm vi protocol, không phải lesson

---

## 4. Mục tiêu & cách đo lường

| Mục tiêu | Cách đo | Kỳ vọng |
|---|---|---|
| Giảm lỗi quy trình lặp lại | Số lần vi phạm cùng loại lesson trong 4–6 tuần | Giảm **≥ 40–60%** nhóm top |
| Plan có checklist | % plan ghi `Lessons áp dụng` | **100%** |
| Ổn định multi-agent | Số lần resolve conflict do lỗi quy trình | Giảm đáng kể |
| Không phình context | So sánh context khi planning trước/sau | **≤ +10–15%** (nhờ tag-based) |
| Không phá hệ thống hiện tại | Số thay đổi deny-list / hook / gate | **0** |

---

## 5. Phạm vi triển khai — ĐÃ XONG

| STT | Công việc | Trạng thái |
|---|---|---|
| 1 | Thu thập bài học ưu tiên từ bảng "Cạm bẫy" | ✅ 19 lesson, 6 nhóm |
| 2 | Tạo `docs/LESSONS/` (7 file) | ✅ |
| 3 | Viết skill `project-lessons/SKILL.md` | ✅ |
| 4 | Thêm §11 Planning Gate vào `AGENT_PROTOCOL.md` | ✅ +42 dòng, 0 dòng xoá |
| 5 | Thử nghiệm thực tế với 1–2 agent | ⏳ **CHƯA CHẠY** |
| 6 | Liên kết `continuous-learning-v2` | ⏳ **CHƯA CHẠY** |

---

## 6. Rủi ro & biện pháp

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Context bloat | TB–Thấp | Tag-based. Output giới hạn ~20 dòng. |
| Tag parsing sai → bỏ lỡ lesson | TB | Fallback an toàn → mặc định đọc `multi-agent.md`. |
| Hình thức hóa (đọc cho có) | TB | Bắt buộc ghi `Lessons áp dụng` trong plan; skill có mục Anti-pattern. |
| Trùng lặp với `AGENT_PROTOCOL.md` | Thấp | Chỉ gom bẫy **đã từng xảy ra**; quy tắc chưa từng gây lỗi không đưa vào. |
| Lesson thành "append-only rác" | TB | Quy tắc `INDEX.md` §1.3: cần đủ 4 điều kiện; cần team leader phê duyệt. |

---

## 7. Trạng thái commit & push

| Hạng mục | Giá trị |
|---|---|
| Commit | `6c49f5741` |
| Nội dung | 9 files changed, **541 insertions**, 0 deletions |
| Branch | `feat/portfolio-p0-20261005` |
| Gate đã chạy | `check:multi-agent` → **0 lỗi, 0 trùng số migration — PASS** |
| **Push** | ⛔ **CHƯA PUSH** — `git push` timeout, branch chưa có upstream |

⚠ Theo `docs/LESSONS/build-gates.md` **L-G02**: các gate khác
(`pre-push-gate.mjs`, `agent-sync.ps1`, `npm run build`, test suite) **CHƯA CHẠY**.

---

## 8. Nội dung trình bày cho PM

| Phần | Nội dung | Ghi chú |
|---|---|---|
| **1. Tóm tắt** | "Lặp lại lỗi quy trình dù đã ghi nhận — cần cơ chế ép đọc trước khi lập kế hoạch" | Nêu ngay vấn đề cốt lõi |
| **2. Thực trạng** | 2–3 ví dụ thật: migration trùng số, commit file shared, báo `PASS` chưa chạy. Thêm: registry 216 KB / 63 cảnh báo giả. | Dùng bằng chứng đã xảy ra |
| **3. Ý tưởng** | "Sổ tay hành động + Skill autoload theo ngữ cảnh" | Phân biệt rõ LEDGER vs LESSONS |
| **4. Đã làm** | 19 lesson / 7 file / 1 skill / 1 gate — commit `6c49f5741` | Nhấn mạnh đã có bằng chứng |
| **5. Lợi ích** | Giảm lỗi lặp, tăng ổn định multi-agent, tiết kiệm thời gian xử lý conflict | Gắn với hiệu quả thực tế team |
| **6. Rủi ro đã tính** | Context bloat → tag-based · bỏ lỡ → fallback · hình thức → bắt buộc liệt kê | Cho thấy đã cân nhắc kỹ |
| **7. Đề xuất** | "Cho phép thử nghiệm 2 tuần với 1–2 agent, đánh giá hiệu quả trước khi mở rộng" | Rõ ràng, khả thi |

---

## 9. Kết luận

**Đã triển khai xong MVP.** Thay đổi cốt lõi: **chuyển "kinh nghiệm nhớ lại" thành
"kinh nghiệm buộc phải kiểm tra" ngay tại thời điểm lập kế hoạch.**

Bước tiếp theo: **push commit `6c49f5741` lên GitHub** và chạy **Bước 5** —
thử nghiệm với 1–2 agent có task migration/multi-agent để kiểm chứng skill có thực sự ngăn được lỗi cũ hay không.

---

## 10. Tham chiếu

| File | Vai trò |
|---|---|
| `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md` | Audit claim/handoff/open-work (dữ liệu thật) |
| `docs/LESSONS/INDEX.md` | Danh sách lesson + quy tắc ghi mới |
| `skills/project-lessons/SKILL.md` | Skill autoload |
| `docs/AGENT_PROTOCOL.md` §11 | Planning Gate |
| `docs/KE_HOACH_XU_LY_TON_DONG_CLAIMS_20261007.md` | Kế hoạch dọn claim tồn đọng |