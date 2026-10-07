# KẾ HOẠCH XỬ LÝ TỒN ĐỌNG CLAIM — Đưa codebase về trạng thái sạch

> Ngày lập: 2026-10-07
> Mục tiêu: **0 claim actionable chưa xác định** — mọi claim hoặc đã đóng có chứng cứ,
> hoặc được phân loại rõ ràng (stale / blocked / cần xác minh).
> Nguồn dữ liệu: `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md`

---

## 0. Kết quả audit làm thay đổi giả định

Bản kế hoạch đầu lập dựa trên giả định "phần lớn claim đã released/done, không có
`in-progress` nào actionable". **Audit thật đã bác bỏ giả định đó.**

| Chỉ số | Giả định ban đầu | Thực tế đã đo |
|---|---|---|
| Claim `in-progress` | "không phát hiện actionable" | **48 dòng** chứa chuỗi `in-progress` |
| Claim thật còn giữ file | không có | **2 nhóm / 12 dòng** (`owner-audit-fix` 8 + `opencode-portfolio-p0*` 4) |
| Branch remote đã hủy | không biết | **2 branch** (`portfolio-w3-api`, `portfolio-exec-plan-20260927`) |
| Working tree | "sạch" | **KHÔNG sạch** — `REPORT_FINAL.md` (M) + `docs/_workflow/` (??) |
| File `OPEN_WORK_*` | 1 | **2** (`20260927` 32 KB, `20260929` 8.7 KB) |

**48 − 36 (nhắc nhỡ trong cột `scope` của claim đã `done`) = 12 dòng cần xử lý thật.**

---

## 1. Nguyên tắc xử lý

| Nguyên tắc | Giải thích |
|---|---|
| **Chỉ đóng khi có chứng cứ** | Mọi lần chuyển `released`/`done` phải dựa trên bằng chứng xác minh được (diff, PR, file tồn tại). **KHÔNG đoán.** |
| **Zero hidden debt** | Claim không được để mở vô thời hạn không giải thích. Blocked phải có **owner + điều kiện đóng**. |
| **Verify trước – action sau** | Không sửa `CLAIMS.md` trước khi có danh sách xác minh. |
| **Không tự ý xoá** | Theo `AGENT_PROTOCOL.md:67-68`, hủy claim = **append dòng `superseded`**, không xoá dòng cũ. |
| **Tuân thủ deny-list** | `AGENTS.md`, `docs/CLAIMS.md` (chỉ append cuối), `packages/web/package.json`, lock files, `docker-compose*.yml`, `.env*` — **không sửa khi còn agent chạy**. |
| **Planning Gate** | Áp dụng `AGENT_PROTOCOL.md` §11: ghi `Lessons áp dụng` vào plan trước khi code. |

---

## 2. Phân loại claim tồn đọng

| Nhóm | SL | Mô tả | Hành động |
|---|---|---|---|
| **A. Stale chưa hủy** | 2 branch remote | `portfolio-w3-api` (L277), `portfolio-exec-plan` (L251) — đã hủy ở local nhưng **branch còn trên remote** | **Owner** xoá remote branch sau khi xác nhận không còn PR mở |
| **B. Cần Owner quyết định** | 8 dòng | `owner-audit-fix` Slice A/B/C/E/F/G (L859-861, L940-942) trên branch `feat/openwork-ow02-03-04` (**tồn tại local + remote**) | **Owner** chọn: tiếp tục (giao agent) hoặc abort (append `superseded`) |
| **C. Claim cha chưa đóng** | 2 dòng | `opencode-portfolio-p0` (L952) + `-b` (L954) đã `done` nhưng dòng cha chưa chuyển trạng thái | Append dòng đóng, **không sửa dòng gốc** |
| **D. Untracked không ai claim** | 14 file | `docs/_workflow/` — không xuất hiện trong `CLAIMS.md` | **Owner** quyết định: commit hay xoá |
| **E. Sửa dở chưa commit** | 1 file | `docs/evidence/portfolio-commercial/REPORT_FINAL.md` — thuộc claim đã `done` | Diff → commit hoặc revert |
| **F. Blocked hợp lệ** | 2 | P0-SEC-01 (secret), P0-LEGAL-01 (license) | **Giữ nguyên** — có owner rõ |
| **G. Nhiễu kỹ thuật** | 63 | Claim tham chiếu file không tồn tại; trong đó ~46 là nhắc nhỡ lịch sử trong cột `scope` | Sửa parser `check:multi-agent.mjs` (P2) |
| **H. Reference lỗi thời** | 1 | `AGENTS.md` trỏ `OPEN_WORK_20260927.md` nhưng có `OPEN_WORK_20260929.md` | Đọc rồi quyết định merge hay cập nhật trỏ |

---

## 3. Thứ tự thực thi

> Mỗi bước **độc lập, review được riêng**. Không gộp — tránh hunk không tách được.

### Bước 0 — Planning Gate (bắt buộc)

```markdown
Lessons áp dụng: [L-002 (khai claim trước khi sửa dòng đầu),
                  L-006 (không báo PASS cho thứ chưa chạy),
                  L-008 (không commit thẳng vào dev)]
```

Gọi `skills/project-lessons` với `taskDescription` = "cleanup claims registry".

### Bước 1 — Snapshot & Verify (P0)

Mục tiêu: có bằng chứng trước khi đụng vào `CLAIMS.md`.

```powershell
# 1a. Bằng chứng cho nhóm B (owner-audit-fix)
git fetch origin
git log --oneline origin/dev..origin/feat/openwork-ow02-03-04   # commit chưa merge?
git diff --stat origin/dev...origin/feat/openwork-ow02-03-04    # scope thực tế
gh pr list --head feat/openwork-ow02-03-04 --state open         # PR còn mở?

# 1b. Bằng chứng cho nhóm A (branch remote đã hủy)
git ls-remote --heads origin | Select-String "portfolio-w3|portfolio-exec-plan"

# 1c. Bằng chứng cho nhóm E
git diff docs/evidence/portfolio-commercial/REPORT_FINAL.md

# 1d. Bằng chứng cho nhóm D
Get-Content docs/_workflow/README.md
Get-Content docs/_workflow/STATE.json
```

**Điều kiện đi qua:** có câu trả lời rõ ràng cho A, B, D, E.
**Nếu không xác minh được** → ghi `CHƯA XÁC MINH`, **không đoán**, dừng bước đó.

### Bước 2 — Việc tự làm được ngay (P1)

| Việc | File | Ghi chú |
|---|---|---|
| Commit `REPORT_FINAL.md` hoặc revert | `docs/evidence/portfolio-commercial/REPORT_FINAL.md` | Không để sửa dở |
| Append dòng đóng cho claim `opencode-portfolio-p0` + `-b` | `docs/CLAIMS.md` (**cuối file**) | Không sửa L952/L954 |
| Push commit `6c49f5741` + commit mới lên remote | — | Xem Bước 3 |

⚠ `docs/CLAIMS.md` nằm trong deny-list nhưng cho phép **append cuối file**
(`AGENT_PROTOCOL.md` §2). Phải **commit riêng**, không gộp hunk với file khác.

### Bước 3 — Push (P0)

```powershell
git push -u origin feat/portfolio-p0-20261005
```

⚠ Lệnh này **timeout lần trước** (180s, không output). Cần chạy riêng với timeout dài
hoặc kiểm tra credential trước. **Xác minh bằng:**
```powershell
git ls-remote --heads origin feat/portfolio-p0-20261005   # phải thấy hash
```

### Bước 4 — Việc cần Owner quyết định (P1)

Trình bày Owner, **không tự làm**:

| # | Quyết định | Bằng chứng đã chuẩn bị |
|---|---|---|
| 1 | `owner-audit-fix` (8 claim) — tiếp tục hay abort? | Diff scope so với `dev` + trạng thái PR |
| 2 | Xoá 2 branch remote đã hủy? | `git ls-remote` output |
| 3 | `docs/_workflow/` — commit hay xoá? | `README.md` + `STATE.json` |
| 4 | 2 file `OPEN_WORK` — merge hay sửa trỏ? | Nội dung `OPEN_WORK_20260929.md` |

### Bước 5 — Dọn handoff index (P2)

Tạo `docs/HANDOFF_INDEX.md`: bảng 65 file handoff + trạng thái + action còn mở.
Phương pháp: grep `TODO` / `Next steps` / `Follow-up` / `CHƯA` trong 65 file.

### Bước 6 — Sửa parser false-positive (P2)

`packages/web/scripts/check-multi-agent.mjs` (~:27 `DENY_LIST`) đang parse `CLAIMS.md`
bằng regex không phân biệt cột `scope` với cột `status` ⇒ **63 cảnh báo giả**.
Sửa để chỉ kiểm tra path trong **cột files/status**, bỏ qua nội dung mô tả.

---

## 4. Definition of Done

- [ ] `git status --short` **sạch** (trừ file Owner chủ động giữ)
- [ ] **0 claim `in-progress` actionable chưa xác định** — hoặc đã đóng có chứng cứ, hoặc phân loại rõ (stale / blocked / cần xác minh)
- [ ] Mọi append vào `CLAIMS.md` có **proof** ghi kèm (diff hash, PR, commit)
- [ ] **0 dòng gốc bị sửa/xoá** trong `CLAIMS.md` (chỉ append cuối)
- [ ] Blocked claims có **owner + điều kiện đóng** rõ ràng
- [ ] Commit `6c49f5741` **đã push** + verify bằng `git ls-remote`
- [ ] Branch remote đã hủy **đã được Owner duyệt xoá**
- [ ] `docs/_workflow/` **có quyết định** (commit hoặc xoá)
- [ ] `Lessons áp dụng` được ghi trong plan từng bước
- [ ] Báo cáo **CHƯA CHẠY** cho: `pre-push-gate.mjs`, `agent-sync.ps1`, `npm run build`, test suite, 25 file test còn lại, Playwright, mobile

---

## 5. Rủi ro

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Ép đóng claim chưa đủ proof | TB | Chưa đủ proof → ghi `CHƯA XÁC MINH`, giữ nguyên. An toàn hơn bỏ sót. |
| Mất lịch sử claim | Thấp | Chỉ append `superseded`, không xoá dòng cũ (`AGENT_PROTOCOL.md:67-68`). |
| Push nhầm nhánh | TB | Verify bằng `git ls-remote` sau khi push. Không dùng `--force`. |
| Gộp hunk `CLAIMS.md` với file khác | TB | Commit **riêng** file `CLAIMS.md`. |
| Sửa nhầm `AGENTS.md` | TB | `AGENTS.md` trong deny-list — chỉ Owner sửa, khi merge. |
| Nghĩ đã push nhưng chưa | **Đã xảy ra** | Lần trước `git push` timeout, **không có output**, dễ tưởng thành công. Verify bằng `git ls-remote`. |

---

## 6. Bảng tổng hợp

| Nhóm | SL | Owner | Mức | Bước |
|---|---|---|---|---|
| A. Branch remote stale | 2 | Owner | P1 | 4 |
| B. `owner-audit-fix` claim thật | 8 | Owner | P0 | 4 |
| C. Claim cha chưa đóng | 2 | Tự làm | P1 | 2 |
| D. `docs/_workflow/` | 14 file | Owner | P1 | 4 |
| E. `REPORT_FINAL.md` sửa dở | 1 | Tự làm | P1 | 2 |
| F. Blocked hợp lệ | 2 | — | Giữ | — |
| G. Nhiễu parser | 63 | Tự làm | P2 | 6 |
| H. Reference `OPEN_WORK` | 1 | Tự làm | P2 | 4 |

**Tự làm được ngay:** Bước 0, 1, 2, 3 → commit + push sạch.
**Cần Owner:** Bước 4 (4 quyết định).
**Sau:** Bước 5, 6.

---

## 7. Tham chiếu

| File | Vai trò |
|---|---|
| `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md` | Dữ liệu audit gốc (bằng chứng + lệnh) |
| `docs/LESSONS/INDEX.md` | 19 lesson liên quan |
| `docs/AGENT_PROTOCOL.md` §11 | Planning Gate |
| `docs/CLAIMS.md` | Registry cần dọn (append-only) |
| `AGENTS.md` mục Progress | Bối cảnh P0 đang mở |