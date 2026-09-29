# Config Ownership Matrix

| Config Key / Secret | Môi trường lưu trữ | Dịch vụ sở hữu | Quản lý bởi |
|---|---|---|---|
| `SMTP_PASSWORD` / `GMAIL_SA_JSON` | DB (Backend `core-api`) | Mail Operator | SOC Admin (Qua UI) |
| `TURNSTILE_SECRET_KEY` | ENV / Secrets Manager | Auth System | DevOps / Backend Lead |
| `FERNET_KEY` (Nếu mã hóa) | ENV / Secrets Manager | Auth System | DevOps / Security |
