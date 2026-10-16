# Checklist Credential Kết Nối Broker (Owner cấp sau — KHÔNG gửi secret qua chat)

> Nguyên tắc: credential thật chỉ nhập TRỰC TIẾP trên UI staging
> (`https://docker.edusuccess.vn/broker`), không qua chat/email/file.
> Mọi giá trị dưới đây chỉ nêu TÊN field + nguồn cấp, không có giá trị thật.

## 1. DNSE LightSpeed (lane `dnse`)

| Field UI | Nguồn cấp | Ghi chú |
|---|---|---|
| Client ID | EntradeX → LightSpeed API | OAuth2 client, dùng chung test + lưu |
| Client Secret | EntradeX → LightSpeed API | Secret, che mặc định, xóa sau lưu |

Luồng sau khi nhập: Lưu → Kiểm tra (read-only `get_accounts`) → Đồng bộ
tài khoản/số dư → Email-OTP → Trading token (trong phiên) → đặt lệnh thử.
Xóa cấu hình ở lane mới + lane cũ để sạch cả 3 store (đang là 3 store song
song — xem ledger Entry hiện tại; deadline gom 1 store do Owner quyết).

## 2. SSI FastConnect (lane `ssi`)

| Field UI | Nguồn cấp | Ghi chú |
|---|---|---|
| API Key | Cổng SSI FastConnect | Bắt buộc |
| API Secret | Cổng SSI FastConnect | Secret |
| Client ID | Tài khoản SSI (VD: 1234561) | Tùy chọn ở form, NHƯNG bắt buộc nếu muốn xem số dư/vị thế (test hiện tại chỉ market-only) |
| Private Key (RSA) | Cặp khóa do Owner sinh | Chỉ khi bật đặt lệnh (ký RSA). Chưa cần ở pha read-only |

## 3. TCBS OpenAPI (lane `tcbs`)

| Field UI | Nguồn cấp | Ghi chú |
|---|---|---|
| API Key | Cổng TCBS OpenAPI | Bắt buộc |
| Mã lưu ký | Tài khoản TCBS (VD: 105C…) | Tùy chọn |
| Base URL | Để trống = mặc định iFlash; host riêng phải thêm vào allowlist BE (`BROKER_EGRESS_EXTRA_HOSTS`) | Egress allowlist chặn host lạ |
| OTP pha trade | Quy trình riêng (ai giữ, kênh nào) — Owner quyết, OTP KHÔNG BAO GIỜ lưu dài hạn | Hiện tại TCBS luôn `unverified` cho tới khi có OTP |

## 4. Key vận hành (ai giữ, quay vòng thế nào — Owner quyết)

- `BROKER_SECRET_KEY` (+ `BROKER_SECRET_KEY_V<n>`, `BROKER_SECRET_VERSION`):
  mã hóa secret lane mới. Xoay theo runbook `reencrypt_broker_secrets`.
- `DNSE_CREDENTIAL_FERNET_KEY`: mã hóa lane DNSE cũ. Đã có trên staging
  (append server-side 2026-10-15); prod cần key RIÊNG, không tái dùng.
- Lộ trình gom 2 hệ khóa về 1 `SecretStore` (finding F-BE-07).

## 5. Min/format từng field (BE chỉ chặn max + ký tự lạ)

BE hiện KHÔNG đoán min-length (chưa từng thấy credential thật). Sau khi có
key thật, đối chiếu tài liệu từng broker rồi bổ sung min/format vào
`broker/{dnse,ssi,tcbs}.py::validate_secrets` + test. Không tự bịa số.

## 6. Cách verify sau khi cấp (không cần code mới)

1. Nhập 1 lane trên staging → Kiểm tra → trạng thái `CONNECTED` (DNSE/SSI) /
   `UNVERIFIED` + `otp_required` (TCBS).
2. Xóa cấu hình → kiểm tra cả lane mới + lane cũ báo chưa cấu hình.
3. Poll job của user khác → 404 `job_not_found` (đã có test).
