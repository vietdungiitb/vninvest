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

## Ghi chu quan tri cay module

- Da them quy trinh cap nhat cay module tai `docs/MODULE_TREE_WORKFLOW.md`.
- File nguon cay tong: `module_tree_full.md`.
- Script cap nhat tu dong: `scripts/ops/generate_module_tree.py`.
- Quy uoc: moi thay doi class/function/variable can chay script va commit cung code thay doi de giu tai lieu dong bo.
