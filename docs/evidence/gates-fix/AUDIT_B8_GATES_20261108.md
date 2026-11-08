# AUDIT B8 re-audit — gates-fix (2026-11-08)

> **Scope:** `feat/gates-1108` @ `660ff2eb8` (`origin/dev` @ `38c84ad89`) + worktree chưa commit, `D:\Mujoco Projects\agent-gates-1108` — chỉ đọc, không sửa code, không commit.
> **Diff gốc:** `git diff origin/dev` (HEAD + worktree) — 8 file tracked + `docs/PLAN_GATES_FIX_20261108.md` + `docs/evidence/gates-fix/`.
> **Bằng chứng:** mọi gate below được auditor CHẠY TRỰC TIẾP trong worktree này (log in bằng chứng § cuối). Số đo models/beat đo độc lập bằng script riêng, không reuse hàm `FACTS`.
> **Verdict:** NEED_REVISION (1 blocker + 1 major, xem § BLOCKER/MAJOR).

## 1. Bảng từng mục

| # | Mục | Kết quả | Bằng chứng (file:line + lệnh đã chạy) |
|---|---|---|---|
| 1 | `check-ai-cc.mjs` — chuẩn hoá EOL trước strip (AC11) | PASS | `packages/web/scripts/check-ai-cc.mjs:271-275` thêm `.replace(/\r\n/g,"\n").replace(/\r/g,"\n")` trước `split("\n")`+`//.*$`. Gốc rễ đúng: `main.tsx:203-206` comment "boc `StaffRoute`" của route `audit` rơi vào statement của `slo` khi strip lỗi. Auditor đã chứng minh red→green: revert 1 dòng (stash) + worktree CRLF (304 CRLF / 20359 B, blob `origin/dev` LF 0 CRLF) → `FAIL AC11: /settings/ai/slo staffOnly=false nhung main.tsx CO boc StaffRoute`; với fix → `node check-ai-cc.mjs` PASS 12/12 `SACH`, `--self-test` PASS 20/20 (đã chạy). |
| 2 | `docs/system-design/*` — số doc 118/45 + claims + freshness `--write` | PASS | `01.01-tom-tat-dieu-hanh.md:16` `117→118 model`, `:18` `46→45 lịch Celery beat`; `claims.json:16,18` `docQuote/expected 118` (C-002), `:40,42` `45` (C-005); `freshness-report.md:11,14` `118/45`, `:3` regen 2026-11-08, VOLATILE `web_src_tracked 640`, `docs_md_total 1972`. Auditor đo độc lập: models `^class …(models.Model)` trừ `vninvest_core/` = **118** (commercial 7 gồm `LicenseKey @ 205867b84`); beat `^\s{4}["']` trong `CELERY_BEAT_SCHEDULE` = **45 keys**. C-001/C-003/C-004/C-006 (15/137/10/44) không stale — plan sửa đúng 2 claim. `node check-system-design.mjs --check` → claims 6 khớp, `check-freshness: khop`, `check-inventory: 44 khop` (chỉ catalog SKIP, xem mục 3). |
| 3 | `check-system-design.mjs` — predicate hẹp + exit-2 + self-test âm | NEED_REVISION (blocker + major) | Predicate `isMissingDjangoOutput` (`docs/system-design/_meta/tools/check-system-design.mjs:520-522`) regex `/No module named ['"]django['"]/` đúng hướng hẹp, và self-test predicate đơn vị PASS (`requests` → false). Nhưng lan truyền exit-2 ở `:633-655` (`if skipped && code===0 → code=2`) làm **CONTROL self-test FAIL**: `node … --self-test` → `FAIL CONTROL: sach thi exit 0 / expected null, got exit=2 / SELF-TEST FAILED: 1 case. Gate khong duoc tin.` Auditor đã chứng minh đây là hồi quy của fix: `git stash` (bản HEAD chưa fix) self-test PASS **5/5**; với fix FAIL 1/6. Nguyên nhân: fixture `--dir` bị gán `SD` toàn cục (tmp) nên `if (dir===SD)` vẫn chạy catalog, fixture không có `gen-*-catalog.py` → `checkGenerated …:528` trả code 2 → `skipped=true` → exit 2. Cộng thêm major: `checkGenerated:547` `if (r.status===2 \|\| isMissing…)` — script gen trả 2 cho **MỌI** exception trong `collect()` (`gen-endpoint-catalog.py:141-143,158-160` catch-all `except Exception → return 2`), nên `No module named 'requests'` trong gen vẫn SKIP qua nhánh `status===2`, predicate hẹp không có tác dụng tích hợp; self-test chỉ test hàm thuần, không test `checkGenerated` tích hợp. |
| 4 | `scripts/pre-push-gate.mjs` — handler exit-2→skip + probe django→skip | PASS | Bounded diff đúng 2 block, không chạm logic khác: (a) `system-design:238-243` `exit2→skip…42` / `!==0→bad` / `0→ok`, comment contract rõ; (b) `openapi-budget:438-454` probe `PY -c "import django"` (`:441-442`) + predicate hẹp `No module named ['"]django['"]` (`:442`), import được → chạy budget như cũ, lỗi thật vẫn FAIL. Đúng tiền lệ L-G02 (SKIP trung thực, không nuốt FAIL thật): auditor đã chạy `python -c "import django"` → `No module named 'django'` (máy thiếu runtime xác thực); probe logic không đoán từ output budget. |
| 5 | Hygiene — 3 dòng CLAIM `in-progress→superseded` | PASS (minor ghi chú format) | `docs/CLAIMS.md:1707` `uistd-w1-theme` (PR #272), `:1759` `w0-foundation` (PR #278), `:1771` `w0-staging-policy` (PR #279) — chỉ đổi cụm trạng thái, giữ nguyên scope/files/note và thêm lý do + mốc §3, đúng tinh thần `AGENT_PROTOCOL.md:68-69` ("đừng xoá… chuyển sang… với status `superseded` và ghi lý do"), tiền lệ `CLAIMS.md:254,280,288…` (coordinator `**superseded** (2026-10-10)… Đổi **1 tu trang thai**… KHONG xoa`). **Minor:** format mới `**superseded (coordinator hygiene … theo AGENT_PROTOCOL §3)**` gộp lý do vào trong bold, khác tiền lệ `**superseded** (…): …` — không chặn, nhưng nên thống nhất. `node packages/web/scripts/check-multi-agent.mjs` → `0 lỗi, 0 trùng số migration — PASS` (157 CẢNH BÁO pre-existing, đã chạy). |
| 6 | `pre-push-gate` cuối — 0 FAIL, SKIP rõ, VPS là CHƯA CHẠY | PASS | Auditor chạy `node scripts/pre-push-gate.mjs` (timeout 600s) → `34 PASS / 2 SKIP / 0 FAIL — cho phep push NHUNG khong phai xanh toan phan` (exit 0, không FAIL). 2 SKIP có lý do rõ và kiểm chứng: `system-design — catalog CHUA CHAY (thieu Django runtime tren may nay) — chay VPS`; `openapi-budget — django chua co tren may nay — CHUA CHAY; chay tren VPS staging`. Cả hai là trung thực (auditor đã xác nhận máy không có `django`), không bịa PASS. `global-config-drift` PASS `7 OK / 6 caph doi byte` (G1 deploy đã chạy, machine-local, không cần commit repo — đúng plan). Ghi chú: pre-push không wire `check-system-design --self-test`, nên hồi quy mục 3 vẫn push được — blocker ở mục 3 vẫn chặn merge dù gate này xanh. |

## 2. BLOCKER / MAJOR

### B8-01 BLOCKER — `check-system-design --self-test` CONTROL fail: gate không được tin
- **Vị trí:** `docs/system-design/_meta/tools/check-system-design.mjs:633-655` (lan truyền exit-2) × `:745-766` (self-test) — `CONTROL: sach thi exit 0` (`:718-723`).
- **Thực tế:** `node docs/system-design/_meta/tools/check-system-design.mjs --self-test` (auditor chạy) → `FAIL CONTROL … got exit=2 … SELF-TEST FAILED: 1 case. Gate khong duoc tin.` Đối chứng `git stash` (trước fix) → `SELF-TEST PASS: 5 case`. Hồi quy nguyên nhân: fixture `--dir` gán `SD` toàn cục nên catalog vẫn chạy cho fixture; `gen-*-catalog.py` không tồn tại trong fixture (`checkGenerated:527-528` → code 2) → `skipped=true` → `code=2`, trong khi control expects exit 0.
- **Tác động:** Theo chính tool (`SELF-TEST FAILED … Gate khong duoc tin`) và lesson L-V01/L-G02, một gate có self-test đỏ không được tin để merge. Pre-push không chạy self-test này nên lỗi này đang lọt qua gate final (mục 6 vẫn xanh) — đúng lớp "gate xanh giá", cần chặn bằng sửa fix, không bằng waiver.
- **Đề xuất fix (1 phạm vi nhỏ):** chỉ lan truyền exit-2 khi đang check repo/real `SD`, không áp cho fixture hermetic — ví dụ: tách flag `isFixture` (khi `--dir` khác mặc định) và bỏ qua catalog trong `runCheck(dir)` khi `dir` là fixture, hoặc cho fixture sở hữu `gen-*-catalog.py` giả + target giả, hoặc giữ control expect exit 2 **kèm** assert message SKIP (không chấp nhận CONTROL đổi ngầm thành exit 2 mà không lý do). Cách nào cũng cần 1 case bổ sung chứng minh: fixture sạch vẫn exit 0, repo thật thiếu django vẫn exit 2.

### B8-02 MAJOR — Predicate `status===2 || missing` che drift thật: module khác vẫn SKIP qua catch-all của gen script
- **Vị trí:** `docs/system-design/_meta/tools/check-system-design.mjs:547` `if (r.status === 2 || isMissingDjangoOutput(blob))`; nguồn: `docs/system-design/_meta/tools/gen-endpoint-catalog.py:141-143,156-160` (và `gen-model-catalog.py` tương tự) catch-all `except Exception → return 2`.
- **Thực tế:** Với bất kỳ `ModuleNotFoundError: No module named 'requests'` (bug thật trong script gen) thì `collect()` ném exception → script trả exit 2 → nhánh `r.status===2` → trả code 2 = SKIP trung thực. Predicate hẹp ở `:520-522` và self-test đơn vị ở `:753-760` chỉ kiểm tra hàm thuần, không kiểm tra đường tích hợp `checkGenerated`, nên chủ trương "module khác vẫn FAIL" không đúng trong thực thi.
- **Tác động:** Che drift thật đúng lớp OBJ-1 mà plan rev2 tuyên bố đã khép (PLAN_GATES_FIX:41-42). Khi có Django trên VPS, lỗi import trong gen sẽ bị báo SKIP thay vì FAIL. Không còn là "thiếu runtime" nữa mà là lỗi code.
- **Đề xuất fix:** SKIP chỉ khi predicate true: `if (isMissingDjangoOutput(blob)) return {code:2,…}`; mọi `status!==0` còn lại → code 1 (FAIL), kể cả `status===2`. Bổ sung 1 case tích hợp vào self-test: gen giả in `No module named 'requests'` và exit 2 **phải** ra code 1/FAIL (không chỉ test hàm thuần). Đồng thời cân nhắc thu hẹp catch-all của gen script (chỉ trả 2 cho thiếu django, trả 1 cho lỗi khác) — ngoài phạm vi tối thiểu này thì chỉ fix phía checker là đủ để không SKIP oan.

## 3. Kết luận

- **Bốn cổng (G1 global-config, G2 AC11, G3 numbers, G4 openapi-probe + exit-2 handler) đúng thiết kế và đã chứng minh bằng chạy thật; hygiene đúng tiền lệ và `check-multi-agent` PASS; `pre-push-gate` cuối 0 FAIL với SKIP trung thực.**
- **Nhưng mục 3 chưa merge được:** self-test CONTROL đỏ (blocker) + predicate tích hợp chưa hẹp (major). Fix là nhỏ, đúng phạm vi `check-system-design.mjs` + 1 case self-test tích hợp, không cần chạm 5 file còn lại.
- **VERDICT: NEED_REVISION (0 PASS toàn phần).** Sau khi sửa B8-01/02 và chạy lại `--self-test` (phải `SELF-TEST PASS: 6 case`) + `--check` (phải `KHONG VERIFY DUOC — exit 2` trên máy thiếu django) + `pre-push-gate` (0 FAIL), mời re-audit B8 lần 2.

## 4. Bằng chứng đã chạy (auditor B8, 2026-11-08, worktree `agent-gates-1108`)

```
node packages/web/scripts/check-ai-cc.mjs               → SACH (12 PASS) exit 0
node packages/web/scripts/check-ai-cc.mjs --self-test   → SELF-TEST PASS: 20/20 exit 0
(gate cũ trên worktree CRLF) node check-ai-cc.mjs       → FAIL AC11 /settings/ai/slo … CO boc StaffRoute (red)
node docs/system-design/_meta/tools/check-system-design.mjs --check    → KHONG VERIFY DUOC exit 2 (SKIP catalog ×2)
node docs/system-design/_meta/tools/check-system-design.mjs --self-test→ FAIL CONTROL exit=2 / SELF-TEST FAILED: 1 case (blocker)
git stash (trước fix) --self-test                       → SELF-TEST PASS: 5 case (chứng minh hồi quy)
đo độc lập models                                        → TOTAL models (excl vninvest_core)=118
đo độc lập beat                                          → BEAT keys=45
python -c "import django"                               → No module named 'django' (probe xác thực)
node packages/web/scripts/check-multi-agent.mjs         → 0 lỗi, 0 trùng số migration — PASS
node scripts/pre-push-gate.mjs                          → 34 PASS / 2 SKIP / 0 FAIL (exit 0)
```

*Không sửa file khác, không commit. Auditor độc lập chỉ đọc + chạy gate + tạo file này.*
