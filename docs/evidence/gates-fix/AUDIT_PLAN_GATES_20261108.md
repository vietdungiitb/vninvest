# AUDIT — Kế hoạch B2 fix 4 cổng pre-push (2026-11-08)

> **Scope:** `docs/PLAN_GATES_FIX_20261108.md` (B2, 54 dòng) đối chứng gốc rễ trong repo.
> **Ngày:** 2026-11-08 · **HEAD:** `660ff2eb8` (branch `feat/gates-1108`, diff vs `origin/dev` = `docs/CLAIMS.md` +1 dòng) · **Auditor:** độc lập B3/B4 — **chỉ đọc, không sửa code, không commit**.
> **Phương pháp:** đọc toàn bộ plan + đọc/grep file thật (không đoán); số đo độc lập bằng `Select-String`/`Get-ChildItem`/`node --check` chỉ đọc.

## 1. Bảng Plan vs Thực tế (mỗi cổng)

| Cổng | Plan nói | Thực tế trong repo (file:line) | Kết luận gốc rễ |
|---|---|---|---|
| G1 `global-config-drift` | deployed `~/.opencode/` lệch canonical `tools/opencode-global/` (trong git); fix = chạy `deploy.mjs` (machine-local, không commit) | `verify-global-config.mjs:29-37` PAIRS 6 file, so byte canonical↔deployed; `:81-115` smoke-test chạy thật bản deployed trong fixture trần (bắt thiếu dependency/ERR_MODULE_NOT_FOUND). `deploy.mjs:1-8` ghi rõ canonical là sự thật; `:31-43` chỉ `copyFileSync` + `mkdirSync`, không chèn logic. `pre-push-gate.mjs:256-260` coi exit≠0 là FAIL | ĐÚNG gốc rễ. Không phải gaming — đồng bộ deployed về canonical theo đúng thiết kế. Rủi ro: `deploy.mjs` chép đè không backup bản `~/.opencode/` hiện tại (chỉ ảnh hưởng máy này, không ảnh hưởng repo) |
| G2 AC11 CRLF | `check-ai-cc.mjs:271-274` per-line `/\/\/.*$/` hỏng trên CRLF → ai-slo gán nhầm guard; fix EOL 1 dòng trong gate | `check-ai-cc.mjs:271-274` `split("\n").map(l=>l.replace(/\/\/.*$/,""))`. Trong JS, `.` không khớp `\r` nên trên dòng CRLF `.*$` không ăn được `\r` cuối dòng → **comment không bị strip**. `main.tsx` trên đĩa có 304 CRLF (đo độc lập); `:203` route `settings/ai/slo` (không StaffRoute), `:204-205` comment nhắc `StaffRoute` của route audit, `:206` audit bọc StaffRoute. Catalog `routeCatalog.js:358-375` `ai-slo` `staffOnly:false` (đúng guard). Khi strip hỏng, `StaffRoute` trong comment vẫn nằm trong statement của `slo` (`:275-281` slice 260 ký tự) → gate tưởng `slo` có guard → FAIL giả | ĐÚNG gốc rễ. Fix ở gate (chuẩn hóa `\r\n→\n` trước `split`) là sửa gốc, không bịa `staffOnly`. Không chạm logic guard thật |
| G3 C-002/C-005 stale | `LicenseKey` (`205867b84`) +1 model → 118; Entry 419 gỡ NOOP beat → 45. Sửa doc + `claims.json` expected atomically + `--write` regen | `commercial/models.py:168` `class LicenseKey(models.Model)`; commit `205867b84` `feat(license-portal): LicenseKey model...`. Đo độc lập: models = **118** (commercial 7 + advisory 13 + identity_access 24 + 10 app còn lại). `settings.py:545-898` đếm 45 key beat (không còn NOOP); ledger Entry 419 (`:51-55`) ghi `settings.py −6 (NOOP beat)`. `claims.json:16,40` vẫn `117/46`, `01.01:17,19` vẫn `117 model`/`46 lịch Celery beat`. `check-system-design.mjs:505-506` bắt SAI đúng 2 claim + freshness lệch dòng 11 (`models 118 vs 117`) | ĐÚNG gốc rễ. Sửa số đo từ code thật, đúng quy tắc `claims.json:3` "sửa TÀI LIỆU cho xanh". Cả `docQuote`+`expected` phải đổi cùng lúc (`:489-491` check nguyên văn) |
| G4a catalog READ thiếu django | `checkGenerated` trả code 1 FAIL dù contract ghi SKIP trung thực L-G02; plan: trả code 2 khi đầu ra chứa `No module named`/`ModuleNotFoundError`/`ImportError` | `check-system-design.mjs:518-538` `checkGenerated`: mọi `r.status!==0` → `code:1`. `gen-endpoint-catalog.py:39` `import django`, `gen-model-catalog.py:33+` `django.setup`. Đo thật: `gen-model-catalog.py --check` → `FAIL: READ khong doc duoc models: No module named 'django'`, exit 2 từ script gen, nhưng wrapper nâng lên 1. Comment `:615-616` ghi rõ "thiếu thì SKIP trung thực chứ không báo xanh — L-G02" | ĐÚNG hướng, nhưng predicate plan **quá rộng** (xem §2). Cần thu hẹp + cho SKIP lan ra pre-push (xem §2) |
| G4b `openapi-budget` thiếu django | `pre-push-gate.mjs` chạy `python check-openapi-schema-budget.py` (cần django); tiền lệ `ui-check-a11y-runtime` CHƯA CHẠY exit 0; plan: `skip(...)` khi PY không import được django | `pre-push-gate.mjs:430-443` openapi-budget: `if (r.code!==0) bad(...)`. `check-openapi-schema-budget.py:61-75` gọi `manage.py spectacular` qua subprocess → cần Django settings. Máy này: `python -c "import django"` → `ModuleNotFoundError`, không venv. Tiền lệ `ui-check-*` `:450-494`: timeout/không exit code → `skip(...CHUA CHAY)` (không phải FAIL), và gate a11y in `CHUA CHAY` nhưng vẫn tính `ok` kèm note | ĐÚNG hướng + trung thực (skip + cảnh báo, không bịa PASS). Cần probe import django rõ ràng thay vì suy từ output (xem §2) |
| Claim/deny-list | 3 claim stale Oct 21-22 còn `in-progress` giữ `scripts/pre-push-gate.mjs`; sửa tối thiểu + báo coordinator | `docs/CLAIMS.md:1708` `uistd-w1-theme` in-progress + `:1715` **done** cùng branch; `:1760` `w0-foundation` in-progress + `:1766` **done** (PR #278 merged); `:1772` `w0-staging-policy` in-progress + `:1778` **done** (PR #279 merged). Cả 3 cột files đều liệt kê `scripts/pre-push-gate.mjs`. Claim `gates-1108` (commit `660ff2eb8`) đã claim chính file đó. `AGENT_PROTOCOL.md:23-35` deny-list §2 **KHÔNG có** `pre-push-gate.mjs` (chỉ 5 file shared); `:45-53` §3 quy tắc vàng (2): "File đã in-progress bởi agent khác ⇒ dừng" | `pre-push-gate.mjs` **không** phải deny-list nên không vi phạm §2. Nhưng còn nguyên 3 dòng in-progress trỏ cùng file → **vi phạm chữ của §3(2)** nếu sửa ngay (gate `check-multi-agent` + preflight sẽ chặn). Xem §2 |

**Các claim còn lại (C-001/C-003/C-004/C-006): KHÔNG stale** (đo độc lập, khớp `expected`):
- C-001 `15 Django app`: SRC có 15 thư mục nghiệp vụ trừ `vninvest_core` (`ai_agents` đủ `apps.py`), khớp `check-system-design.mjs:107-125`.
- C-003 `137 migration`: đếm `migrations/0*.py` trừ `vninvest_core` = **137**.
- C-004 `10 compose stack`: 7 file root + `packages/core` + `packages/opencore` + `packages/vip-app` = **10**.
- C-006 `44 file`: 45 file `*.md` dưới `docs/system-design` trừ 1 file `_meta/freshness-report.md` (`walk(...,skipMeta)` `:74-84`) = **44**, khớp inventory `--check` ("44 file — khớp"). Plan chỉ sửa C-002/C-005 là đủ, không thiếu claim nào.

**G3 atomicity:** plan bắt sửa `docQuote`+`expected`+doc cùng lúc và regen `--write` (chỉ ghi `inventory.json`+`freshness-report.md`, đúng `:643-657`) — đủ điều kiện passing `checkClaims` (`:489-506`) + freshness. C-001/C-003/C-004/C-006 không cần đụng.

## 2. Critical issues (Why + Suggested fix)

### Non-critical (ghi nhận, không chặn): deploy đè `~/.opencode/`
G1 an toàn ở mức repo (6 file canonical→deployed, smoke-test được giữ). Rủi ro duy nhất: không backup — nếu người dùng có sửa tay trong `~/.opencode/` sẽ mất. Chỉ ảnh hưởng máy audit, không ảnh hưởng repo. Đề xuất: ghi chú trong G1 "backup tay thủ công nếu cần" hoặc để `deploy.mjs` in file đã đè (đã có SAME/DEPLOY).

### [1] G4 predicate quá rộng — mọi ImportError thành SKIP, có thể che drift thật
`checkGenerated` plan match `No module named`/`ModuleNotFoundError`/`ImportError` chung. Bất kỳ `ImportError` nào trong script gen (bug thật do người mới sửa script, thiếu dep khác django) cũng bị hạ thành SKIP → gate mất kiểm soát âm thầm. Vì sao nghiêm trọng: đây đúng là "gaming cho xanh" mà plan muốn tránh — đổi FAIL thành SKIP cho mọi lỗi import.
**Suggested fix:** thu hẹp chỉ django-missing: nhận SKIP khi output chứa đúng `No module named 'django'` (hoặc `No module named "django"`), và (nếu muốn) `drf_spectacular` nếu gen cần. Diğer `ImportError`/`ModuleNotFoundError` (module khác) vẫn là code 1. Thêm 1 case self-test (fixture gen in `No module named 'requests'` phải FAIL).

### [2] SKIP của catalog không lan ra pre-push — người đọc pre-push vẫn thấy "PASS" xanh
`check-system-design.mjs:618-632` hiện chỉ `console.log('  SKIP  '+line)` khi `cat.code===2` mà không đổi `code`, và `pre-push-gate.mjs:237-241` chỉ nhìn exit code (`!==0` là FAIL, còn lại là `ok("system-design", ...)` cố định) — phần SKIP trong output bị nuốt. Người đọc pre-push sẽ tưởng catalog đã verify. Tiền lệ `ui-check-*` (`:487-493`) ưu tiên in `CHUA CHAY`/`ADVISORY` lên summary PASS; system-design không có cơ chế tương đương.
**Suggested fix:** một trong hai: (a) trong `runCheck`, khi catalog code 2 thì ghi nhận tên gate vào danh sách SKIP/summary của tool và để pre-push parse/đưa ra như ui-gate; hoặc (b) tối thiểu cho `--check` trả 2 (KHÔNG VERIFY ĐƯỢC) khi catalog SKIP, để pre-push phân biệt — nhưng phải kiểm tra pre-push xử lý exit 2 như SKIP chứ không phải FAIL. Không để SKIP chìm trong output.

### [3] Claim `pre-push-gate.mjs` vẫn xung đột §3(2) — cần coordinator đóng 3 dòng cũ trước khi sửa
Bản thân `gates-1108` đã claim `scripts/pre-push-gate.mjs` (đúng quy trình claim-trước-code). Nhưng 3 dòng `in-progress` cũ (`1708/1760/1772`) vẫn liệt kê file đó. Theo `AGENT_PROTOCOL.md §3(2)` + cách dùng tại `CLAIMS.md:8`, agent mới **dừng**. "Đã khai claim riêng + đã báo coordinator" **không** tự chữa — gate `check-multi-agent` vẫn FAIL (dòng in-progress bất kể có dòng done trùng tên).
Bằng chứng stale: mỗi dòng in-progress đều có dòng `done` cùng branch phía dưới (`1715/1766/1778`, ghi PR merged #278/#279), đúng kiểu duplicate-row mà session `uiux-w9-stale-claims` (`CLAIMS.md:1148-1153`) đã đóng bằng 1 từ `superseded` (AGENT_PROTOCOL §3: không xóa dòng, chuyển mục đóng).
**Suggested fix (thứ tự):** coordinator (hoặc owner) append/đổi 3 dòng in-progress → `superseded` trước; hoặc tách G4b ra khỏi claim này tới khi đóng xong. Plan đã ghi "chỉ khi B4 đồng thuận + sửa tối thiểu" — cần biến thành điều kiện rõ: không chạm `pre-push-gate.mjs` cho tới khi 3 dòng được đóng, và diff giới hạn đúng block openapi-budget (`:425-443`), không đụng block khác (để tránh merge-conflict với 2 PR W0 đã merge).

## 3. Cơ hội cải tiến (không chặn)

- **G2 fixture CRLF:** plan đã yêu cầu red→green trên fixture CRLF + `--self-test` PASS. Nên thêm vào self-test 1 case CRLF (tạo `main.tsx` ảo có CRLF + comment StaffRoute trước route không-guard) để khóa hành vi; nếu không, fix có thể bị revert âm thầm ở lần nào.
- **G4b probe rõ ràng:** thay vì đoán từ output của budget script, thêm probe `PY -c "import django"` trước; chỉ skip khi probe báo `ModuleNotFoundError: No module named 'django'` (chính xác, không nuốt lỗi spectacular thật).
- **VPS verification:** cả hai cổng SKIP phải được chạy lại trên VPS có django (ghi CHƯA CHẠY nếu chưa chạy, không suy PASS) và ghi số đo (openapi `NO CON: Errors=..., Warnings=...`, catalog khớp) vào evidence.
- **Giữ LF:** khi sửa `.mjs`/`.md` nên chuẩn hóa EOL như các slice trước (`normalize-eol`), tránh diff phình (bài học CLAIMS line-ending hỗn tạp).

## 4. VERDICT

**NEED_REVISION (rev1) — 3 OBJ cần được đưa vào plan trước khi code:**
1. OBJ-1: Thu hẹp G4 predicate chỉ `No module named 'django'` (script gen), không dùng `ImportError` chung; thêm self-test negative (module khác vẫn FAIL).
2. OBJ-2: Cho SKIP catalog lan ra summary pre-push (không nuốt trong output), hoặc ít nhất ghi note `CHUA CHAY` như `ui-check-*` để pre-push PASS có thấy được; state rõ exit code khi SKIP ở cả hai tầng.
3. OBJ-3: Ghi điều kiện thứ tự: đóng 3 dòng in-progress cũ (`CLAIMS.md:1708,1760,1772` → `superseded` do coordinator thực hiện theo tiền lệ uiux-w9) **trước** khi chạm `scripts/pre-push-gate.mjs`; nếu chưa đóng thì để G4b sang claim sau. Diff `pre-push-gate.mjs` giới hạn block `:425-443`.

*Sau khi plan bổ sung 3 điểm trên (rev2), auditor sẵn sàng AGREE không điều kiện. Không REJECT: gốc rễ 4 cổng đều đúng, không có gaming — G1 đồng bộ canonical, G2 sửa gate CRLF, G3 sửa số từ code thật, G4 SKIP trung thực có kiểm soát.*
