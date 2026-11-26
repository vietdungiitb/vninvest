# HANDOFF — Broker Config R1 (2026-11-26)

- **Branch:** `feat/broker-config-r1` · commits `fafd51501` (claim) → `321981221` (code) · agent `broker-config-r1`.
- **Trạng thái:** code xong, gate xanh, **E2E staging có ảnh thật**; chờ owner chấp nhận residual và merge PR.
- **Nguồn:** `docs/AUDIT_BROKER_MANAGEMENT_PAGE_20261126.md` (audit độc lập) · `docs/PLAN_BROKER_CONFIG_S1_20261126.md` REV1 · `docs/evidence/broker-config-r1/PLAN_REVIEW.md` (NEED_REVISION→đã sửa) · `docs/evidence/broker-config-r1/gates.md` · ảnh `docs/evidence/broker-config-r1/e2e/broker-tab-r1.png`.

## Kết quả

- **AC1–AC3:** 3 key i18n thiếu được thêm VI/EN; textarea mặc định `""`; placeholder `client_id/client_secret`; bấm Lưu rỗng chặn FE, **không POST**, banner i18n. E2E xác nhận bằng Network + ảnh.
- **AC4:** cross-check purpose↔credential tại `service_ops/views/broker.py:201-252` (gọi preview `:390` + apply `:339`); có credential sai purpose ⇒ 400; **thiếu credential ⇒ warning**, nay FE hiển thị qua `warnings` (`SocBrokerPanel.tsx` state + banner màu `--soc-status-warn`).
- **AC5:** `data_ingest/tasks.py:2480-2495` `provider_for_purpose('backfill')`, chỉ nhận `dnse`, khác ⇒ log + fallback DNSE; không import cycle.
- **AC6:** `broker.py:561-566` so plaintext `get_secrets()` trước `set_secrets()` — đổi purpose giữ verify, rotate reset.
- **AC7:** `_with_reserved_keys` merge `tenant_kill_switches`/`provider_kill_switches` tại view apply/preview, không để Apply xoá key runtime.
- **AC8:** validate purpose thô trước `from_dict()` lọc thầm lặng.

## Bằng chứng

BE R1 **8/8 OK** + regression **21/21 OK** trên VPS (`core-db` trực tiếp, `--keepdb`) · FE **11/11** · `tsc` 0 · pre-push **36 PASS / 0 FAIL** · E2E staging **2 passed** (4 GET 200, không POST khi rỗng) · ảnh đã mở xem. Chi tiết lệnh trong `docs/evidence/broker-config-r1/gates.md`.

## Residual (owner quyết định defer hay làm tiếp)

1. **F1 (P1, đã fix trong R1 nhưng chưa E2E lại):** warning hiển thị qua state mới; E2E ảnh được chụp trước khi fix warning. Cần chạy lại E2E nếu muốn ảnh bao gồm banner warning.
2. **F3 (P2):** chiều ngược lại — đổi credential purposes sang `snapshot` trong khi registry vẫn `dnse/backfill` ⇒ `get_system_broker_secrets` trả `None`, task abort; POST `/credentials/` chưa cross-check ngược.
3. **F4 (P2):** `readCredentialError` fallback trả `err.message` cho error_code lạ (vẫn không phải JSON thô, nhưng technical).
4. **S3–S5 chưa làm:** poll job `test-connection`, redesign 4 bước, optimistic concurrency `expected_updated_at`. D3 không enforce rpm/retry theo quyết định chuyên gia.

## Next / owner

- Merge PR từ `feat/broker-config-r1` (merge-commit, không squash). Nếu cần cherry-pick handoff sang `main`, làm sau merge theo handoff rule.
- Coordinator: đóng 3 claim stale (`vet-finish`, `cafef-ref`, `vnbroker-console`) — không phải slice này sửa. Ledger Entry **654** đã chuẩn bị bởi coordinator vì Entry 643–653 đang dở của phiên khác.
- Dọn staging: test DB đã DROP; user `e2e_broker` đã xoá; VPS đang checkout branch R1 — sau merge deploy lại `dev`.
