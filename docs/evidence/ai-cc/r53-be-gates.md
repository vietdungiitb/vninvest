# AI R5.3 (phần BE) — 4 system sub-agent prompt: lưu, version, audit, trace

**Claim**: `ai-r53` · **Nhánh**: `feat/ai-r53` → `dev` · **Ngày**: 2026-10-18
Phạm vi file này: **BE + test**. Phần FE (UI 4 prompt + diff preview) ghi ở file riêng.

## Điều chỉnh so với plan (đo trước khi code)

| Plan ghi | Thực tế đo | Hệ quả |
|---|---|---|
| `orchestrator.py:140-143` | **`orchestrator.py:558-561`** | citation plan sai dòng (L-T02) |
| "dùng cơ chế `prompt_config_history` sẵn có" | `prompt_config_history` nằm trên **`UserAICredential`** (user BYOK) | **không** dùng được cho prompt hệ thống ⇒ Owner chốt dùng `AIAuditLog` |
| `prompt_template_version` | **không tồn tại** ở đâu | cần migration |
| — | `SystemAISettings.metadata` → `views.py:580` → `effective_context` **đã có sẵn** | không cần sửa đường dữ liệu, chỉ thêm đường **ghi** |

**Trước R5.3 không endpoint nào ghi được 4 khoá này** — chỉ sửa tay trong DB, và whitelist
diff của endpoint update cũng không liệt kê chúng ⇒ đổi prompt **không hiện trong audit**.

## AC + kết quả (chạy thật trên VPS Postgres)

| AC | Điều kiện | Test | Kết quả |
|---|---|---|---|
| AC1 | staff lưu 4 prompt vào system metadata | `test_ac1_staff_save_prompts_to_system_metadata` | ✅ |
| AC1 | lưu ⇒ tăng `sub_agent_prompts_version` | `test_ac1_saving_bumps_version` | ✅ |
| AC1 | GET trả prompt + version (staff) | `test_ac1_get_exposes_prompts_and_version` | ✅ |
| AC1 | lịch sử đọc được từ `AIAuditLog` | `test_ac1_history_is_readable_from_audit_log` | ✅ |
| AC2 | user thường **không sửa** được | `test_ac2_member_cannot_write_prompts` | ✅ 403 |
| AC2 | user thường **không thấy** field | `test_ac2_member_does_not_see_prompts` | ✅ **key bị bỏ hẳn** |
| AC3 | trace ghi `prompt_template_version` | `test_ac3_trace_records_version_from_context` | ✅ ghi `7` |
| AC3 | thiếu version ⇒ `0`, không `None` | `test_ac3_missing_version_defaults_zero` | ✅ |
| AC4 | đổi 1 prompt ⇒ diff chỉ đổi khoá đó (+version) | `test_ac4_change_isolated_to_one_key` | ✅ |
| AC5 | prompt khác ⇒ hash khác; cùng prompt ⇒ cùng hash | `test_ac5_prompt_hash_differs_for_different_prompt` | ✅ |
| — | validation: khoá lạ / không phải dict / quá 4000 ký tự | 3 test | ✅ 400 |
| — | lưu y hệt **không** tăng version | `test_identical_save_does_not_bump_version` | ✅ |

**14/14 test mới** · **437 test hồi quy BE** (435 cũ + 2 AC3) — **0 fail**.

## AC2 — field staff-only bị **bỏ hẳn**, không trả `null`

Lần đầu tôi trả `sub_agent_prompts: None` cho user thường. Test bắt được và đó là **hợp
đồng sai**: client có thể coi `null` là "có field" rồi gửi ngược lên. Nay **pop key** ở cả
GET và PUT khi không phải staff (`response_data.pop(...)`).

## AC4 — audit trước/sau: hai lỗi tôi mắc, cả hai chỉ lộ ra khi chạy thật

1. **`after_json` thiếu 4 khoá.** Tôi chỉ vá `before_snapshot`. Audit chỉ gữ một phía ⇒
   phép so "đổi" báo **4/4 khoá** thay vì 1. Đo bằng test in trực tiếp `before/after`
   mới thấy (`after=None` cho cả 4).
2. **`before_json` chụp sau khi mutate.** Tôi chụp `_sap_before` ở *đầu* PUT nhưng script
   vá đặt nó **sau** chỗ mutate ⇒ `before == after`, phép so ra rỗng. Nay chụp **trước**
   mutate.

Cả hai đều **không thấy được** khi đọc code — chỉ thấy khi chạy test trên VPS.

## Sai sót nghiêm trọng nhất của slice này (đã khôi phục)

Một script Node của tôi dò `return envelope(response_data)` rồi chèn code vào **mọi** chỗ
khớp: biến chỉ số tràn số (`596478` trong file ~4.400 dòng) ⇒ **dán hàng loạt khối code**,
file không còn parse được. Đã khôi phục bằng `git checkout HEAD --` rồi **áp lại bằng
`edit` tool** (thay chuỗi có ngữ cảnh), mỗi bước kèm `ast.parse` + script kiểm chứng vị trí
(helper định nghĩa đúng 1 lần, khoá response đúng 2 view `get`/`put`, pop đúng 2 chỗ).

**Bài học:** sau 3 lần script tự hỏng trong một slice, công cụ đáng tin là `edit` + kiểm
chứng, **không** phải script splice.

## Còn mở

- **FE chưa làm**: UI 4 prompt (staff-only) + diff preview trước khi lưu (AC4 mức UI).
- **Chưa deploy staging**: migration `0023_aitrace_prompt_template_version` chưa chạy trên
  môi trường thật.
- Diff preview chỉ là diff **audit** (BE); AC4 của plan nói "dùng component R1.9" — chưa
  dùng lại component đó.