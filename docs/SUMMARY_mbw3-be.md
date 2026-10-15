# SUMMARY — Slice BE Wave 3 (`mbw3-be`)

- **Branch:** `feat/mbw3-be` (worktree `C:/MujocoProjects/agent-mbw3-be`) · **HEAD:** `be7d51d35`
- **Ngày:** 2026-10-15 · **Contract:** `docs/PLAN_WAVE3_ISOLATION_20261015.md` §2 (đóng băng, không đổi)
- **Claim:** `mbw3-be` (`docs/CLAIMS.md:1295`) — giữ `in-progress`, **không merge** (1 PR wave do PM hợp nhất sang `feat/mbw3-isolation`)
- **Phạm vi file:** chỉ BE đã claim + regen system-design máy sinh. Không chạm file FE, không chạm deny-list.

## 1. Đã thực thi (đối chiếu §2)

| Hạng mục | File | Thực tế |
|---|---|---|
| BE-READ `GET broker-bindings/` | `packages/core/backend/src/user_workspace/views_broker.py` | `@api_view(['GET','PATCH'])` trên hàm hiện có (không thêm route, đúng O-5); GET trả `envelope([{binding_id, sub_account_id, provider, external_id, display_name, role, is_default}])`, 404 khi portfolio lạ (giống PATCH) |
| Action `convert` | `views_broker.py` (`_convert_portfolio_kind`) | Nhánh mới trên PATCH hiện có (`urls.py:117` giữ nguyên). Đếm binding thật trong transaction (`select_for_update`), áp đúng bảng chuyển làn §2 (`convert_needs_binding`, `convert_requires_empty`, `broker_backed_single_account`); mọi convert ghi audit, audit hỏng ⇒ từ chối `audit_unavailable` (fail-closed) |
| Audit add/remove/convert | `views_broker.py` (`_audit_binding`) | Mã nghiệp vụ nằm ở `metadata['operation']` vì `AuditEvent.action` chỉ nhận 6 giá trị cố định (`ops_audit/models.py:25`); audit hỏng không vỡ request chính (add/remove) |
| BE-KIND serializers | `packages/core/backend/src/user_workspace/serializers.py` | Portfolio read += `kind`, `is_archived` (read-only — PATCH chung không đặt được `kind`); SubAccount read += `provider`, `broker_config` (id, read-only), `last_sync_at`; Watchlist read += `source`, `provider`, `broker_account` (read-only) |
| Watchlist filter | `packages/core/backend/src/user_workspace/views.py` (`WatchlistListCreateView`) | `?provider=&broker_account=` (id số, sai kiểu ⇒ 400) |
| B3.2-BE guard aggregate | `views.py` (`TransactionListCreateView.post`, `PortfolioDetailView.patch`) | POST transaction vào aggregate ⇒ `aggregate_read_only`; PATCH `opening_balance`/`opening_balance_source` của aggregate ⇒ `aggregate_read_only`. Cho phép: bindings add/remove, rename, delete |
| B3.4 counters | `.../management/commands/count_subaccount_backfill_gaps.py` (mới) | 2 bộ đếm độc lập `provider_empty` / `broker_config_null`, output ASCII (L-B03) |
| B3.4 backfill DNSE | `.../migrations/0030_backfill_dnse_broker_backed.py` (do `makemigrations` sinh, không tự đặt số) | Data-migration idempotent: chỉ SubAccount DNSE (`provider='dnse'` hoặc `broker_source='DNSE'`) chưa có binding; đã ở portfolio `broker_backed` ⇒ chỉ tạo binding primary; còn lại ⇒ tạo portfolio `"DNSE — <số TK>"` kind=`broker_backed` + binding primary; không đổi tên/kind có sẵn, không print |
| B3.4 NOT NULL | — (không đổi `models.py`) | **Partial đúng contract:** chưa có số liệu prod để `AlterField NOT NULL` ⇒ giữ DB nullable + enforce ở serializer (`SubAccountSerializer.validate` từ chối `provider=''` gửi lên, thiếu hẳn thì giữ `''` cho worker/backfill 0025 tương thích ngược) |
| Test mới (TDD fail-before) | `tests/test_broker_bindings_read.py` (4), `tests/test_portfolio_kind_guard.py`, `tests/test_subaccount_backfill_contract.py` | Tổng 29 test |

## 2. Gates (lệnh thật + exit code + nơi chạy)

| Gate | Lệnh | Kết quả |
|---|---|---|
| BE suite mới (VPS §12.3, DB tạm `mbw3_be`) | `manage.py test user_workspace.tests.test_broker_bindings_read user_workspace.tests.test_portfolio_kind_guard user_workspace.tests.test_subaccount_backfill_contract --noinput` trên image `vninvest-core-api:staging` + code worktree `/tmp/wt-mbw3-be` | **29/29 OK** (`Ran 29 tests … OK`), test DB tạo (chạy đủ migration gồm 0030) rồi destroy |
| `makemigrations --check` (local §12.2, `DJANGO_DEBUG=1`) | `manage.py makemigrations --check --dry-run` | `No changes detected`, exit 0 |
| `py_compile` 5 file đổi (local) | `python -m py_compile …` | exit 0 |
| `check-system-design --check` (local) | `node docs/system-design/_meta/tools/check-system-design.mjs --check` | **SẠCH exit 0** (sau regen + đồng bộ C-003 121→122 theo migration 0030; sửa TÀI LIỆU trước, claims.json theo sau) |
| pre-push-gate (hook, lúc push) | tự chạy | **22/22 PASS** |
| B3.4 counters trên staging-read | `manage.py count_subaccount_backfill_gaps` với DB `vninvest_core` staging | **CHƯA CHẠY có lý do:** schema staging thiếu cột `provider` (`ProgrammingError: column user_workspace_subaccount.provider does not exist`) — staging chưa deploy migration mới; không `migrate` DB staging đang phục vụ. Đếm thật dời sang sau deploy; quyết định NOT NULL giữ nguyên **partial** (nullable + serializer-enforce) |
| Full BE suite · ruff · FE gates | — | CHƯA CHẠY (ngoài slice; regression cuối wave ở Pha 3 do PM) |

## 3. Dọn VPS (runbook §12.3 bước 4, bắt buộc)

`DROP DATABASE mbw3_be` ⇒ `DROP DATABASE` · `git worktree remove --force /tmp/wt-mbw3-be && prune` ⇒ worktree list chỉ còn `/opt/vninvest`. Không còn artifact tạm.

## 4. Drift phát hiện (báo PM, không tự sửa ngoài slice)

1. **Runbook §12.3 bước 2 stale:** `grep -E '^POSTGRES_PASSWORD='` cho rỗng — env thật dùng `CORE_DB_PASSWORD` (đã xác minh tên biến, không in giá trị). Lần chạy đầu vì thế auth fail (`fe_sendauth: no password supplied`); chạy lại với đúng biến thì 29/29 xanh. Đề nghị cập nhật runbook (FE sở hữu §12.4; §12.3 ai sở hữu thì sửa).
2. **Staging API nối DB qua `pgbouncer:6432`**, không phải `vninvest-core-db:5432` trực tiếp — §12.3 nối thẳng DB là đúng cho test (tạo test DB qua pgbouncer sẽ fail), ghi lại để agent sau khỏi "sửa cho giống staging".
3. **SSH từ Windows:** ssh.exe nuốt dấu nháy kép trong remote command; `(`/`)` chưa quote ⇒ remote `syntax error`. Mẹo đã dùng: remote command không ngoặc/không nháy, hoặc base64 `echo <b64> | base64 -d | bash`.
4. **`gen-model-catalog.py --write` crash cp1252** khi print tiếng Việt (`UnicodeEncodeError` U+1ED5) — workaround `PYTHONIOENCODING=utf-8`. Nên sửa tool (ticket riêng, ngoài slice).
5. `01.01-tom-tat-dieu-hanh.md:18` ghi `1473 route` trong khi endpoint-catalog đo `1483` — không phải claim gate (chỉ C-001..C-006 được pin), để nguyên, PM quyết có pin thêm hay không.

## 5. Bàn giao cho PM (Pha 2/3)

- BE đủ cho FE tích hợp: GET bindings + convert + guard + serializer fields + watchlist filter đúng contract §2, không thêm route.
- B3.4 ở trạng thái **partial có lý do** (đúng §8 STOP): serializer-enforce + backfill 0030 + lệnh đếm đã có; `AlterField NOT NULL` + đếm staging-thật làm sau deploy (ticket follow-up).
- Ledger Entry wave + claim `done` + merge vào `feat/mbw3-isolation`: để PM/supervisor làm ở Pha 3 (tránh trùng Entry với auditor/FE).
- File đổi tổng (dev..HEAD): 3 sửa BE (`views_broker.py`, `serializers.py`, `views.py`) + 1 migration + 1 command + 3 test + regen/docs (`07.02-danh-muc-api.md`, `06.02-danh-muc-model.md`, `freshness-report.md`, `claims.json`, `01.01-tom-tat-dieu-hanh.md`, `PLAN_AUDIT`, `PLAN_WAVE3`, `CLAIMS.md`). `git status` sạch, đã push `ed6bab4a0..be7d51d35` + 1 commit regen (`be7d51d35`).
