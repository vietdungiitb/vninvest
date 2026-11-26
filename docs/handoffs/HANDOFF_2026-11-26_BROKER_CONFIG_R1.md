# HANDOFF — Broker Config R1/R2 (2026-11-26)

- **Branch:** `feat/broker-config-r1` · PR **#560** → `dev` · agent `broker-config-r1`.
- **Trạng thái:** R1 + R2 xong, gate xanh, **E2E staging có ảnh thật**; chờ merge PR.
- **Evidence:** `docs/AUDIT_BROKER_MANAGEMENT_PAGE_20261126.md` · `docs/PLAN_BROKER_CONFIG_S1_20261126.md` REV1 · `docs/evidence/broker-config-r1/PLAN_REVIEW.md` (NEED_REVISION→sửa) · `docs/evidence/broker-config-r1/gates.md` · ảnh `docs/evidence/broker-config-r1/e2e/broker-tab-r1.png` + `broker-tabs-r2.png`.

## Kết quả R1
3 key i18n VI/EN · bỏ default `{}` · validate + map lỗi i18n · cross-check purpose↔credential (thiếu = warning hiển thị FE, sai = 400) · `provider_for_purpose('backfill')` fail-closed DNSE · giữ verify khi chỉ đổi purposes · giữ reserved kill-switch key · validate purpose thô.

## Kết quả R2 (theo yêu cầu owner)
**Bỏ textarea JSON.** Khu "Credentials hệ thống" giờ có **3 tab DNSE / SSI / TCBS**, mỗi tab chỉ hiện đúng field mình cần:

| Tab | Trường bắt buộc | Nguồn schema |
|---|---|---|
| DNSE | `client_id`, `client_secret` | `user_workspace/broker/dnse.py:67-70` |
| SSI | `client_id`, `api_key`, `api_secret` | `vnbroker/broker/ssi/client.py:71-86`, `money.py:228-233` |
| TCBS | `api_key` | `vnbroker/broker/tcbs/client.py:73-87` |

Mỗi field có nhãn + helper tiếng Việt; secret dùng `type=password` với nút "Hiện giá trị / Ẩn giá trị". BE `CREDENTIAL_REQUIRED_KEYS` cập nhật theo từng provider. SSI/TCBS hiện nhãn "chưa có đường chạy/kiểm tra kết nối" (D2) — vẫn lưu được credential nhưng không hứa năng lực chưa có. Schema đã probe lại sau khi `dev` bump `vnbroker 3.10.0` — không đổi.

## Gates
BE **10/10 OK** + regression **21/21 OK** trên VPS · FE **11/11** · tsc **0** · pre-push **36 PASS / 0 FAIL** · deploy verify HEAD `b70c7a6c1` · E2E staging **2 passed** (4 GET 200, không POST khi form rỗng) · ảnh đã mở xem. Chi tiết trong `gates.md`.

## Residual / owner
- **F3 (P2):** chiều ngược (đổi credential purposes trong khi registry vẫn `backfill`) chưa cross-check.
- **F4 (P2):** fallback lỗi FE là i18n chung, không còn JSON thô.
- **S3–S5:** poll job `test-connection`, redesign 4 bước, `expected_updated_at` — defer.
- **Hạ tầng (ngoài slice):** cert public `docker.edusuccess.vn` đang trả `CN=erp.edusuccess.vn` ⇒ SNI sai; E2E chạy qua SSH tunnel. Cần ACME/nginx-proxy sửa.
- **Race deploy:** phiên khác deploy `dev` xen kẽ; sau merge PR cần deploy `dev` và chạy lại E2E một lần để chốt baseline chung.

## Next
1. Merge PR #560 (merge-commit, không squash). Nếu GitHub báo conflicting do `dev` tiến tiếp, rebase branch lên `origin/dev` rồi push lại (đã làm 2 lần trong phiên).
2. Deploy `dev`, chạy lại E2E script trong `gates.md`.
3. Coordinator đóng 3 claim stale (`vet-finish`, `cafef-ref`, `vnbroker-console`); handoff cherry-pick sang `main` sau merge.
4. Dọn staging: test DB `test_broker_config_r1_test` cần DROP sau lần test cuối; SSH tunnel PID 27404 cần đóng.
