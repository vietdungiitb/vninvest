# TRACEABILITY MATRIX - Package Track Foundation Baseline

## 1. Mục tiêu

Ma trận này truy vết trực tiếp từ yêu cầu package baseline đã được owner chốt sang quyết định kỹ thuật, task và bằng chứng audit.

## 2. Ma trận truy vết

| Req ID | Yêu cầu | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit bắt buộc |
|---|---|---|---|---|---|
| PKG-01 | Phải có bộ doc pack đầy đủ để giao việc cho đội code | Triad + handoff + traceability + self-audit + evidence + audit report là bắt buộc | Handoff Master mục 3-4 | ARC-01 | file pack tồn tại + cross-reference review |
| PKG-02 | `packages/core` phải có Python manifest thật | `pyproject.toml` là package identity và dependency family SSOT cho baseline | Tech Spec mục 2.1 | CORE-01 | file manifest + compile proof |
| PKG-03 | `packages/core` phải có app skeleton importable | namespace `vninvest_core` có manifest và stub entrypoints | Tech Spec mục 2.2-2.4 | CORE-02 | compile proof + import smoke |
| PKG-04 | `packages/core` phải có contract folders theo boundary | namespaces tối thiểu là `access`, `market`, `operator`, `partner` | Tech Spec mục 2.5 | CORE-03 | tree proof + module tree update |
| PKG-05 | `packages/core` phải có compose services stub thật | topology tối thiểu `db`, `redis`, `api`, `worker`, `beat` | Tech Spec mục 2.6 | CORE-04 | compose file proof + service-name review |
| PKG-06 | `packages/web` phải có route catalog | route registry là product-level shell artifact, không phải hardcoded menu list | Tech Spec mục 4.2 | WEB-02 | route ids uniqueness proof + shell check PASS |
| PKG-07 | `packages/web` phải có navigation catalog | navigation phải tham chiếu route ids và encode build target + capability gating | Tech Spec mục 4.3 | WEB-03 | shell check PASS + catalog integrity proof |
| PKG-08 | `packages/web` phải có adapter seam cho `core` và `vip-app` | hai adapter cùng interface chung, shell phía trên không biết backend cụ thể | Tech Spec mục 4.4 | WEB-04, WEB-05 | adapter export proof + shell check PASS |
| PKG-09 | `shared` phải có contract build target đầu tiên | enum canonical chỉ có `community`, `saas`, `vip` | Tech Spec mục 3.1 | SH-01 | JSON contract snapshot |
| PKG-10 | `shared` phải có contract capability bootstrap đầu tiên | payload phải map được về `PortfolioContext` + `AbilityContext` semantics hiện có | Tech Spec mục 3.2, 5.1 | SH-02 | JSON contract snapshot + mapping note |
| PKG-11 | `shared` phải có contract session payload đầu tiên | payload phải đủ cho human session, VIP local bridge và tenant context | Tech Spec mục 3.3, 5.3 | SH-03 | JSON contract snapshot |
| GOV-01 | Package baseline không được động vào legacy runtime như implementation target | baseline chỉ tạo mới dưới `packages/` và `shared/` | Handoff Master mục 5, Implementation Plan mục 2 | CORE-ALL, WEB-ALL, SH-ALL | changed-files audit không chứa `backend/` hoặc `frontend/` implementation edits |
| GOV-02 | Mọi slice phải có focused validation và audit sync | compileall, shell check, module tree, ledger/progress sync là bắt buộc | Self-Audit Protocol mục 2-4 | QA-01, QA-02, OPS-01 | validation logs + ledger/progress sync |
| GOV-03 | Taskboard phải là live status board khớp với audit mới nhất để tránh nhiều phiên claim chồng chéo | taskboard là authority cho trạng thái hiện hành; audit ledger và progress dashboard chỉ là bằng chứng lịch sử | Handoff Master mục 8, Implementation Plan mục 3-5 | ARC-03, OPS-02 | taskboard diff + audit entry alignment proof |
| GOV-04 | Mỗi slice phải để lại handoff packet để phiên sau resume mà không đoán | evidence template và self-audit protocol bắt buộc ghi trạng thái khi rời slice, lệnh pass cuối, bước kế tiếp và blockers | Handoff Master mục 8-9, Self-Audit Protocol mục 3, Evidence Template mục 9 | ARC-03, OPS-02 | filled handoff block + latest audit note |
| GOV-05 | Toàn bộ UI của phần nâng cấp phải dùng một template chung thống nhất, giàu thông tin và spacing thấp | template UI là hard rule ở cấp handoff, plan, spec; deviation chỉ được phép khi owner duyệt và có audit note | Handoff Master mục 2, 5.3, 8; Implementation Plan mục 1, 3, 4.3; Tech Spec mục 4.1A; Self-Audit mục 2-4 | WEB-13, WEB-14 và mọi slice UI tiếp theo | screenshot hoặc preview proof + template compliance review note |

## 3. Quy tắc sử dụng matrix

1. Mỗi slice phải map ít nhất một `Req ID`.
2. Không có bằng chứng ở cột cuối thì slice chưa được PASS.
3. Nếu `packages/web` adapter interface drift giữa `core` và `vip-app`, toàn bộ slice adapter phải bị đánh FAIL.
4. Nếu changed-files audit cho thấy baseline chạm implementation logic trong `backend/` hoặc `frontend/`, toàn bộ pack phải bị đưa về trạng thái `PARTIAL` hoặc `FAIL`.