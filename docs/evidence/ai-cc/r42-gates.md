# AI R4.2 — Key scope + lịch xoay khoá Fernet

**Claim**: `ai-r42` · **Nhánh**: `feat/ai-r42-key-rotation` → `dev` · **Ngày**: 2026-10-17
**Plan**: `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md:1191-1210`

## Kết quả AC

| # | Điều kiện | Bằng chứng | AC |
|---|---|---|---|
| AC1 | Scope `management` không gọi được API suy luận | `test_advisory_refresh_never_uses_management_scoped_key`: khoá **không** vào `effective_context['api_key']` mà `generate_advisory_task` nhận; log thật `R4.2: user=6 có khoá scope=management, bo qua cho suy luan`. Đối chiếu dương: `test_inference_scoped_key_is_forwarded_to_task` ⇒ scope `inference` **vẫn** được đưa vào hàng đợi | ✅ |
| AC2 | Xoay khoá: khoá cũ đọc được trong `grace_until`, sau đó fail-closed | `test_ac2_old_key_valid_inside_grace_then_fail_closed` | ✅ |
| AC3 | Migration chấp nhận key hiện tại là V1; thêm V2 **không cần migration DB** | `test_ac3_current_env_is_v1_and_legacy_ciphertext_still_decrypts`, `test_ac3_adding_v2_needs_no_db_migration`, `test_prefixed_ciphertext_pins_exact_version` | ✅ |
| AC4 | Log cảnh báo khi dùng khoá ngoài grace | `test_ac4_warns_when_using_key_past_grace_window` — log chứa mã `fernet_key_version_fallback` | ✅ |
| AC5 | UI hiện thời điểm xoay kế tiếp | `ai-cc-r42-key-rotation.component.test.tsx` 3/3; BE trả `ai_key_rotation` trong CC GET | ✅ |

## Bốn quyết định thiết kế — và vì sao lệch cách hiểu thường gặp

1. **Giữ tên env cũ + mọi bản mã cũ vẫn đọc được.** `AI_CREDENTIAL_FERNET_KEY` được
   coi là **V1**; bản mã **không** tiền tố vẫn giải mã được. Nếu bỏ tên cũ thì lần
   deploy đầu tiên **mất khoá BYOK của toàn bộ user** — không phải lỗi nhỏ mà là
   mất sản phẩm.
2. **Tiền tố `vN:` vì Fernet token là opaque.** Không có cách nào biết token mã hoá
   bằng key nào mà không thử lần lượt. Tiền tố nằm trong **cột cũ** ⇒ đó chính là lý
   do AC3 đúng: hạ tầng mới ở env + tiền tố, **không** ở schema.
3. **Quá hạn grace ⇒ fail-closed, nhưng không xoá dữ liệu.** Sau `GRACE_UNTIL` thì
   khoá cũ **không còn được thử** và trả lỗi có mã (`fernet_key_grace_expired`).
   Âm thầm vẫn dùng khoá cũ là cách "xoay khoá" nguy hiểm nhất: trông như đã xoay,
   hành xử thì chưa.
4. **Sửa thiết kế của chính mình sau khi đọc code.** Bản đầu tôi cho rằng "không có
   key nào thì phải raise". Đọc lại `security.py` cũ thấy hệ thống **rơi về khoá băm
   từ `SECRET_KEY`** — nâng thành lỗi sẽ làm mọi môi trường không set env **không
   lưu được khoá API** ngay lúc deploy. Đã đổi thành version tổng hợp có tên `v0`:
   giữ nguyên hành vi cũ, nhưng **gọi đúng tên** để vận hành thấy dữ liệu nào đang
   dùng khoá tổng hợp thay vì tưởng nó là V1.

## Bẫy thật đã mắc trong phiên này

- **Migration trùng số.** Cây test trên VPS bám `/opt/vninvest` — còn **trước R4.1** —
  nên `makemigrations` sinh `0021_...` kèm luôn `Create model AITenantPolicy`, trùng
  với `0021_aitenantpolicy` đã merge. Merge là deploy hỏng (`multiple leaf nodes`).
  Sửa bằng cách `git pull --ff-only origin dev` trên VPS **trước khi** sinh migration
  ⇒ ra đúng `0022_useraicredential_grace_until_and_more.py`. Đây là L-M02/L-M03
  sống: số migration đọc được trong worktree lệch với `dev`.
- **Xanh giả vì URL sai.** `test_advisory_refresh_never_uses_management_scoped_key`
  ban đầu gọi `/core/v1/workspace/ai-advisory/VIC/refresh/` — **404**. `captured`
  rỗng nên `assertNotEqual(None, 'sk-personal')` **vẫn xanh**. Đã thêm assertion bắt
  buộc `captured['api_key']` phải khác `None`, tức phải chứng minh request thật sự
  tới nơi enqueue. URL thật là `/core/v1/advisory/refresh/<symbol>/`, và fixture phải
  có `plan=PRO` + `QuotaRecord` (bê từ `test_advisory_api_routes.py:36-52`), nếu không
  thì 403.
- **Test dương tính là bắt buộc.** Nếu chỉ có test "scope management bị chặn" thì
  "luôn không dùng khoá cá nhân" cũng xanh — tức R4.2 có thể âm thầm phá BYOK cho
  mọi user mà vẫn báo xanh. Đã thêm `test_inference_scoped_key_is_forwarded_to_task`.

## Gates

| Gate | Kết quả |
|---|---|
| BE mới `tests.test_ai_key_rotation` | **20/20 OK** (fail-before: `failures=2, errors=11`) |
| BE hồi quy 45 module (AI + advisory) | **568 test — 567 OK** |
| FE mới `ai-cc-r42-key-rotation.component.test.tsx` | **3/3 OK** |
| FE `components/__tests__` + `pages/__tests__` | 57 file · **364/364 OK** |
| `tsc --noEmit` | exit 0 |
| `npm run build` | exit 0 (`built in 1m 6s`) |
| `eslint` (2 file R4.2) | 0 error, 0 warning |
| `i18n:scan` | exit 0 |

Lỗi còn lại: `test_dead_models_absent_from_frontend_catalogue` — cây test BE chỉ
mount `packages/core/backend`, không có `packages/web` để đọc `providerModels.ts`
(đã tái hiện ở R4.1 trên `/opt/vninvest` ⇒ môi trường, không phải hồi quy).

## Chưa làm / còn mở

- **KHÔNG** rotate/revoke secret thật (L-S01: phạm vi Owner). R4.2 chỉ cài **cơ chế**:
  thêm `AI_CREDENTIAL_FERNET_KEY_V2` + `..._ACTIVE=v2` + `..._GRACE_UNTIL` là xoay
  được khi Owner ra lệnh, không cần migration.
- Chưa có job tự động nhắc trước khi hết grace — `key_ring_status()` đã trả đủ để
  làm, nhưng chưa có nơi hiển thị cho người vận hành trong UI.
- Test chưa chạy với khoá thật của staging (L-S01: không ghi giá trị khoá vào log/test).
  Toàn bộ test dùng `Fernet.generate_key()` sinh trong runtime.
- `grace_until` trên `UserAICredential` hiện do **BE** gán khi đổi khoá (đặt `None`);
  luồng đặt hạn từ `AI_CREDENTIAL_FERNET_KEY_GRACE_UNTIL` chưa nối vào cột này.