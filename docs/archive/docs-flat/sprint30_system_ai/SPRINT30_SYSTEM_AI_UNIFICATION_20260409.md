# Sprint 30 - System AI Unification

## Muc tieu
- Thong nhat runtime AI toan he thong theo quy tac:
  - Neu user co cau hinh AI hop le: uu tien dung AI cua user.
  - Neu user thieu cau hinh AI: fallback sang System AI Settings.
- Bo sung man hinh cau hinh System AI Settings tren Django Admin.
- Loai bo fallback ngau nhien theo staff user trong luong generate advisory.

## Pham vi
- Backend Django app `portfolio`.
- Tich hop vao cac luong AI advisory chinh:
  - Celery task generate whale advisory.
  - Stock AI Advisory session/components/summary runtime gate.
  - AI helper tao component va executive synthesis.

## Hang muc trien khai
1. Tao model `SystemAISettings` (singleton logic bang `name=default` + active flag).
2. Tao service `ai_runtime_config.resolve_ai_runtime_config()` de resolve cau hinh hieu luc.
3. Refactor luong task `generate_whale_advisory_task` dung resolver trung tam.
4. Refactor AI helper dung resolver thay vi doc truc tiep `UserConfig`.
5. Cap nhat API status de expose `effective_ai_provider/model/source`.
6. Bo sung Django Admin:
   - Form nhap key an.
   - Action active config.
   - Action test ket noi.
7. Bo sung migration `0027_systemaisettings`.
8. Bo sung admin REST API `GET/PUT /api/admin-ops/system-ai-settings/` (admin-only).
9. Bo sung regression tests cho fallback user->system va no-config scenarios.
10. Bo sung endpoint admin test connection: `POST /api/admin-ops/system-ai-settings/test-connection/`.
11. Bo sung test resolver priority: user config hop le luon uu tien hon system config.
12. Bo sung audit trail cho System AI Settings (model + migration + admin readonly).
13. Bo sung endpoint admin xem lich su audit: `GET /api/admin-ops/system-ai-settings/audit-logs/`.
14. Hoan thien filter + pagination cho audit logs API (action, actor, date range, offset/limit).
15. Ho tro sort thu tu timeline cho audit logs API (`order=asc|desc`).
16. Bo sung index DB cho audit logs (`action+created_at`, `actor+created_at`).
17. Bo sung management command retention: `prune_system_ai_audit_logs` (default 180 ngay, co dry-run).

## Quy tac runtime sau Sprint
- Priority:
  1) User config (provider + model + key)
  2) System AI Settings
  3) Env fallback (neu `allow_env_fallback=True`)
- Neu khong co runtime AI hop le: endpoint AI tra thong bao ro nguyen nhan.

## Tieu chi hoan thanh
- Admin nhin thay model `System AI Settings` trong nhom `Cau hinh he thong`.
- Refresh/generate AI khong bi block neu user thieu key nhung system co key hop le.
- `generate_whale_advisory_task` khong con fallback staff-user.
- API `GET /api/ai-config/` tra ve duoc effective source/provider/model.
- API admin-only `GET/PUT /api/admin-ops/system-ai-settings/` hoat dong on dinh.
- API admin-only `POST /api/admin-ops/system-ai-settings/test-connection/` hoat dong on dinh.
- Audit trail System AI duoc ghi khi update settings va test connection.
- API admin-only `GET /api/admin-ops/system-ai-settings/audit-logs/` tra ve lich su truy vet.
- Audit API ho tro filter/pagination de frontend admin hien thi du lieu lon on dinh.
- Audit API ho tro sort asc/desc de xem timeline theo thu tu mong muon.
- Query audit logs tren du lieu lon duoc toi uu bang DB indexes.
- Co command don dep log cu de kiem soat kich thuoc bang du lieu production.
- Test fallback chinh pass (user thieu AI -> dung system AI neu san sang).
- Test priority pass (user AI hop le -> source=user, khong bi de system override).

## Rui ro va ke hoach rollback
- Rui ro: system config sai provider/model => AI runtime fail.
- Giam thieu: action test connection tren admin truoc khi activate.
- Rollback: tat `is_active` cua config loi, cap nhat lai config active truoc do.

## Cap nhat trien khai 2026-04-09

### Backend
- Cap nhat danh sach model AI su dung thuc te trong `portfolio/ai_options.py`:
  - `copilot`: giu catalog GitHub Models API-compatible dang wired on dinh: `openai/gpt-4.1-mini`, `openai/gpt-4.1`.
    - Luu y: cac ten nhu `GPT-5.4`, `MAI-Image-2`, `MAI-Voice-1`, `Transcribe-1`, `Copilot Cowork` la product labels, khong phai model IDs da map vao endpoint GitHub Models inference hien tai.
  - `claude`: `claude-mythos-5`, `claude-4.6-opus`, `claude-4.6-sonnet`, `claude-4.5-haiku` + model cu de tuong thich.
  - `gemini`: `gemini-3.1-pro`, `gemini-3.1-flash`, `gemini-3.1-flash-lite`, `nano-banana-2` + model cu de tuong thich.
- Cap nhat default model:
  - `copilot -> openai/gpt-4.1-mini`
  - `claude -> claude-4.6-sonnet`
  - `gemini -> gemini-3.1-pro`

### Frontend / i18n
- Fix loi hien thi key i18n `whaleAdvisory.selectModel` trong combo model:
  - Bo sung key vao dictionary `vi` va `en`.
  - Nang cap translator de ho tro `defaultValue` fallback khi key chua co.
- Bo sung capability-aware model filtering:
  - `/api/ai-options/` tra ve them `model_catalog` metadata va `scope=text_advisory`.
  - Dropdown Whale Advisory chi hien model da `validated_for_runtime=True` va ho tro capability `text_advisory`.
  - Backend chan luon cac model chi la product label / chua verify runtime cho advisory flow.

### Kiem thu da chay
- Backend:
  - `manage.py test portfolio.tests.test_ai_config_api --verbosity 2`
  - `manage.py test portfolio.tests.test_system_ai_admin_api portfolio.tests.test_ai_runtime_config --verbosity 2`
- Frontend:
  - `npm run -s build`

### Ghi chu redeploy
- Release nay bao gom thay doi runtime AI + admin API + audit/retention + update model catalog + i18n fix.
- Sau khi deploy, can smoke test:
  1) `/api/ai-options/` tra danh sach model moi.
  2) Whale Advisory config dropdown khong con hien key i18n.
  3) Admin API `/api/admin-ops/system-ai-settings/` hoat dong binh thuong.
- Script thu thap evidence Sprint 30:
  - `powershell -File scripts/ops/sprint30_collect_deploy_evidence.ps1`
- Bao cao gate:
  - `docs/SPRINT30_GO_NO_GO_REPORT_20260409.md`

## Ghi chu quan tri cay module

- Da them quy trinh cap nhat cay module tai `docs/MODULE_TREE_WORKFLOW.md`.
- File nguon cay tong: `module_tree_full.md`.
- Script cap nhat tu dong: `scripts/ops/generate_module_tree.py`.
- Quy uoc: moi thay doi class/function/variable can chay script va commit cung code thay doi de giu tai lieu dong bo.

## Cap nhat luong Whale Advisory (2026-04-09)

### Muc tieu bo sung
- Chuan hoa luong Whale Advisory theo huong "always actionable per tracked symbol":
  - Moi ma trong tracked list deu co 3 action co dinh: `Refresh AI`, `Mo dashboard ma`, `Mo stock workspace`.
  - Co the tao/lam moi advisory tu nhieu trigger: periodic, whale alert, dark flow, manual refresh.

### Quyet dinh da chot voi owner
1. Ma moi them vao tracked list: cho trigger dau tien hoac user tu refresh.
2. Whale Alert + Dark Money xay ra gan nhau: gop 1 advisory.
3. Manual refresh: van giu cooldown.
4. Loi/quota/policy: hien thi theo tung row.
5. Community plan: van thay nut `Refresh AI`, nhan se bi chan theo plan.
6. Cua so gop su kien: `180s`.
7. Uu tien trigger: `score dong hoan toan` (khong hard-code whale > dark flow).
8. Khi row dang pending: disable nut refresh den khi xong.

### Da trien khai dot 1 (frontend + manual refresh bootstrap)
- Backend `POST /api/portfolio/whale-advisory/<symbol>/refresh/`:
  - Bo hanh vi 404 khi chua co advisory.
  - Cho phep queue tao advisory dau tien ngay tren nut refresh.
  - Message response tach rieng cho truong hop first-create.
- Frontend `WhaleAdvisory`:
  - Moi row symbol deu hien 3 nut co dinh (ke ca khi chua co advisory).
  - Them row-level message (khong chi banner global).
  - Pending theo tung symbol va disable nut refresh den khi ket thuc polling.
- Regression test da cap nhat theo contract moi:
  - Case "no existing advisory" doi tu 404 -> 202 queued.

### Da trien khai dot 2 (merge trigger 180s + score dong)
- Bo sung co che gom su kien advisory theo `user_id + symbol` trong `180s`:
  - Cache key: `advisory:event-merge:<user_id>:<symbol>`.
  - Whale alert va dark flow cung ghi vao bucket gom su kien.
  - Sau khi het cua so 180s, flush 1 lan va queue 1 advisory duy nhat.
- Tinh score dong:
  - Whale: dung `event_score` * huong side.
  - Dark flow: dung `strength` + huong suy luan tu signal_type/cvd_change.
  - Tong diem (`score_sum`) -> resolve `BUY/SELL/UNKNOWN` theo neutral band.
- Fan-out theo user tracked symbol:
  - Trigger whale alert va dark flow deu queue theo tung user dang track ma.

### File thay doi chinh
- `backend/portfolio/views.py`
- `frontend/src/pages/WhaleAdvisory.jsx`
- `backend/portfolio/tests/test_api_routes.py`
- `backend/portfolio/tasks.py`

### Ke hoach tiep tuc (dot ke)
1. Bo sung metadata merge vao advisory payload de frontend hien thi `merged_sources` va `primary_source`.
2. Chuan hoa thong diep chan theo plan (community) de row hien thi ro ly do.
3. Them test integration cho kip ban:
   - whale + dark flow trong 180s -> chi tao 1 advisory.
   - pending row disable dung hanh vi.
4. Them observability metric cho merge queue (scheduled/merged/flushed/skipped).

### Tien do bo sung tiep theo (2026-04-09)
- Da chuan hoa contract block cho community plan tai endpoint refresh:
  - Endpoint `POST /api/portfolio/whale-advisory/<symbol>/refresh/` nhan `IsAuthenticated`.
  - Neu user khong du quyen whale advisory: tra `403` voi payload business:
    - `reason=plan_upgrade_required`
    - `message` huong dan nang cap Pro
    - `symbol`, `queued=false`
- Da bo sung regression test xac nhan community plan bi chan dung contract va khong queue task advisory.

### Tien do tiep tuc (2026-04-09 - dot tiep)
- Da them observability cho pipeline merge event advisory:
  - Counter: `scheduled`, `merged`, `flushed`, `skipped`.
  - Expose trong `get_market_observability_snapshot()` tai key `advisory_event_merge`.
- Da bo sung test task-level cho kip ban merge 180s:
  - 2 event (whale_alert + dark_flow) cung user/symbol trong window 180s chi schedule flush 1 lan.
  - Merge state gom day du sources va source_scores.

### Tien do tiep tuc (2026-04-09 - endpoint ops)
- Da bo sung endpoint admin-only:
  - `GET /api/admin-ops/runtime-kpi/advisory-merge/`
  - Muc tieu: tra nhanh chi so `scheduled/merged/flushed/skipped` cua merge pipeline.
- Da bo sung smoke script ops:
  - `scripts/ops/sprint30_runtime_kpi_smoke.ps1`
  - Thu thap artifact cho:
    - `/api/admin-ops/runtime-kpi/`
    - `/api/admin-ops/runtime-kpi/advisory-merge/`
  - Auth input: `-AccessToken` hoac `-Credential` (khong truyen plain password string).
- Da bo sung wrapper release gate:
  - `scripts/ops/sprint30_run_release_gate.ps1`
  - Muc tieu: chay mot lenh cho `collect deploy evidence` + `runtime KPI smoke`, co ho tro skip flags.

### Tien do tiep tuc (2026-04-09 - hardening refresh advisory)
- Da bo sung co che hardening cho manual refresh Whale Advisory khi worker Celery khong san sang:
  - Them env flag `WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER` trong settings.
  - Flag=True: endpoint refresh co the fallback dong bo, tao advisory ngay.
  - Flag=False: endpoint refresh fail-fast `503` de uu tien mo hinh async nghiem ngat.
- Da cap nhat env template:
  - `backend/.env.example`
  - `backend/.env.production.example`
- Da bo sung regression test:
  - no worker + fallback disabled -> `503`.
