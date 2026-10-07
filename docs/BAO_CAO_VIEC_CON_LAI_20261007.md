# Trạng thái việc còn lại — kiểm chứng 2026-10-07

> Kiểm chứng bằng lệnh thật, không suy từ tài liệu. Baseline: `dev @ 8f86c8aa9` (PR #75 đã merge).
> Nguồn: `docs/OPEN_WORK_SEC_20260929.md` (các mục OW-01, OW-03, OW-05).

---

## Tóm tắt

| Việc | Tài liệu ghi | **Thực tế kiểm chứng** | Owner làm được? |
|---|---|---|---|
| **OW-01** Rotate 7 secret | `CHƯA CHẠY` | ⚠ **2/7 điều kiện đã đạt** — `UserDNSECredential = 0`, `secret_version` không tồn tại trên DB dev | **Không** — cần network + thông báo user |
| **OW-03** Trả billing + bật CI | `CHƯA CHẠY` | ✅ **Nguyên nhân đã xác định chính xác: billing GitHub**, không phải lỗi code | **Không** — cần trả tiền GitHub |
| **OW-05** `UserDNSECredential` versioning | `chưa quyết` | ⚠ **Rủi ro đã tự nhiên giảm**: DB rỗng ⇒ rotate key không mất gì | **Có thể đóng** (xem §3) |

---

## 1. OW-01 — Rotate 7 secret

### Điều kiện tiên quyết #1: `SELECT count(*) FROM identity_access_userdnsecredential`

Tài liệu yêu cầu **bắt buộc** chạy lệnh này trước khi rotate `DNSE_CREDENTIAL_FERNET_KEY`
(vì store này không qua `SecretStore`, không có `secret_version` ⇒ rotate key là mất sạch).

```sql
$ docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core \
    -c "SELECT count(*) AS userdnsecredential FROM identity_access_userdnsecredential;"
 userdnsecredential
--------------------
                  0
```

✅ **Đạt** — store rỗng. Rotate key **không mất credential nào** trên DB dev.
Khớp với thông tin Owner cung cấp: DNSE key chỉ dùng để test, DB không lưu bản mã hóa nào.

### Điều kiện tiên quyết #2: `UserBrokerConfig.secret_version`

Tài liệu (OW-01 mục 2) yêu cầu xác nhận `0 UserBrokerConfig` ở `secret_version=1`.

```sql
$ ... -c "SELECT secret_version, count(*) FROM user_workspace_userbrokerconfig GROUP BY secret_version;"
ERROR:  column "secret_version" does not exist
```

**Tài liệu sai ở đây.** Không phải "0 bản ghi version 1" — **cột không tồn tại trên DB dev**.

Nguyên nhân: **DB dev đang ở schema cũ.**

| Mức | Giá trị |
|---|---|
| Migration trong code | `0020_userbrokerconfig_secret_version` … `0023_append_only_guards` |
| `django_migrations` trên DB dev | cao nhất `0019_pf4_tenant_and_financial_guards` (19 bản ghi) |

⇒ DB dev **thiếu 4 migration** (`0020`–`0023`). Đây là phát hiện mới, tài liệu chưa ghi.

⚠ **Hệ quả cho kiểm chứng:** mọi test BE chạy trên DB dev sẽ **không** phản ánh schema production.
Các test tôi chạy trước đó dùng DB dựng sạch (test runner tự migrate tới đầu) ⇒ **đã đúng**,
nhưng truy vấn tay lên DB dev thì không.

### Điều kiện #3: `reencrypt_broker_secrets --apply`

Lệnh có sẵn: `src/user_workspace/management/commands/reencrypt_broker_secrets.py` ✅ tồn tại.
**Chưa chạy** — cần `secret_version` trên DB thật.

### Điều kiện #4: Thông báo user

`CORE_DJANGO_SECRET_KEY` + `CORE_PAT_PEPPER` rotate ⇒ **mọi session và PAT cũ vô hiệu** (D-29).
Không thể tự quyết — cần Owner thông báo trước.

### Điều kiện #5: Tạo `docs/evidence/SEC-01/`

Chưa có. Sẽ tạo **sau** khi rotate, không tạo trước (tạo trước là báo cáo không có bằng chứng).

### Kết luận OW-01

**Chưa làm được phần rotate.** Nhưng **2 việc kiểm chứng đã xong** và **1 phát hiện mới** cần ghi:

> DB dev thiếu migration `0020`–`0023`. Trước khi rotate secret trên môi trường thật,
> phải `python manage.py migrate` cho khớp code — nếu không, `reencrypt_broker_secrets`
> sẽ lỗi vì cột `secret_version` không có.

### Thứ tự rotate (chưa thực hiện, để Owner dùng)

```
1. Owner thông báo user (session + PAT sẽ vô hiệu)      ← cần Owner
2. Kiểm tra DB thật: SELECT count(*) FROM ...userdnsecredential  → 0
3. python manage.py migrate                                ← THIẾU Ở DB DEV
4. python manage.py reencrypt_broker_secrets --dry-run
5. python manage.py reencrypt_broker_secrets --apply
6. Sinh 7 key mới, đổi trong secret store (KHÔNG commit)
7. Restart service, verify login thật
8. Tạo docs/evidence/SEC-01/{gates,rotate-log,pb-answers}.md
```

---

## 2. OW-03 — Trả billing + bật lại CI

### Bằng chứng trong repo (`.github/workflows-disabled/README.md`)

```
**Trạng thái:** tất cả. Không workflow nào chạy.

- **200/200 run gần nhất thất bại. Không một run xanh nào.**
- 8 workflow x 5 run gần nhất = **40/40 fail**.
- Nguyên nhân gốc: `The job was not started because recent account payments have failed
  or your spending limit needs to be increased.` - job fail sau **2-3 giây với steps=0**,
  tức runner chưa chạy bước nào. **Không phải lỗi code.**
```

### Kiểm chứng lại hôm nay

| Hạng mục | Kết quả |
|---|---|
| Workflow đang bật | **1** — `.github/workflows/` (chỉ `secret-scan.yml`) |
| Workflow bị disable | **8** — `backend`, `core-api`, `governance-release-gate`, `large-file-guard`, `multi-agent-gate`, `opencore-doc-sync-gate`, `web-ci`, `web` |

⇒ Tình trạng **không đổi** so với 2026-09-27. Vẫn chỉ có `secret-scan` chạy.

### Kết luận OW-03

**Nguyên nhân đã rõ, không phải việc kỹ thuật.** Chỉ cần Owner trả billing GitHub rồi:

```bash
git mv .github/workflows-disabled/*.yml .github/workflows/
```

⚠ **Không bật trước khi billing xong** — sẽ lại 40/40 fail với `steps=0`, chỉ tốn quota và gây
tác nhà cả báo động giả. Cũng không sửa được bằng code.

**Việc tôi làm được:** đã làm phần kiểm chứng. Phần còn lại **cần Owner trả tiền**.

---

## 3. OW-05 — `UserDNSECredential` versioning

### Phát hiện làm thay đổi bài toán

OW-05 được ghi "P2 → có thể thành P0" với lý do: rotate `DNSE_CREDENTIAL_FERNET_KEY` sẽ
**mất toàn bộ credential DNSE cũ** và không có đường migrate.

Nhưng kiểm chứng §1 cho thấy **store rỗng (0 bản ghi)**.

| | Trước kiểm chứng | Sau kiểm chứng |
|---|---|---|
| Số credential DNSE trong DB dev | *không đo* | **0** |
| Rủi ro rotate key | Mất toàn bộ credential | **Không mất gì** |
| Mức ưu tiên | P2 → có thể P0 | **P2, có thể đóng** |

⚠ **Giới hạn:** chỉ đúng cho **DB dev**. Store ở môi trường production có thể khác — phải
chạy lại `SELECT count(*)` trên DB thật trước khi kết luận.

### Khuyến nghị: chọn (b) — ghi ngoài phạm vi

Tài liệu đưa 2 lựa chọn:

| | Nội dung | Đánh giá |
|---|---|---|
| **(a)** | Thêm `secret_version` cho model legacy → có đường rotate an toàn | **Không làm lúc này.** Thêm migration cho một bảng **0 bản ghi** là việc không cần thiết; và cần `migrate` DB dev đang thiếu 4 migration — thêm migration làm rối thêm |
| **(b)** | Ghi rõ ngoài phạm vi, mở ticket riêng, không coi SEC-02 là đóng vật lý | **Chọn.** Vì store rỗng, rotate hiện an toàn. Nhưng **không** coi SEC-02 đóng vật lý khi còn 1 store chưa versioning — nếu sau này có DNSE credential thật thì mất |

**Việc cần làm (làm được ngay):** cập nhật OW-05 trong `OPEN_WORK_SEC_20260929.md` để ghi
rõ số liệu 0 bản ghi và lựa chọn (b), kèm điều kiện mở lại P0.

---

## 4. Việc khác phát hiện thêm

### DB dev thiếu 4 migration

| Mức | DB dev | Code |
|---|---|---|
| `user_workspace` | `0019_pf4_tenant_and_financial_guards` | `0023_append_only_guards` |

⇒ Cần `python manage.py migrate` trên DB dev. **Việc này làm được** nhưng cần Owner xác nhận
trước vì đụng vào DB dùng chung (các agent khác có thể đang dùng).

### CI chỉ có 1 workflow chạy

`secret-scan.yml` là workflow duy nhất còn bật. Mọi gate khác (test, tsc, multi-agent)
chỉ chạy **cục bộ qua `.githooks/pre-push`**. Nếu máy dev hỏng, không có CI làm lưới an toàn.

---

## 5. Tổng hợp việc còn lại

| # | Việc | Chủ sở hữu | Mức | Có thể làm không? |
|---|---|---|---|---|
| 1 | Trả billing GitHub → bật 8 workflow | **Owner** | P0 | ❌ Cần thanh toán |
| 2 | Thông báo user trước khi rotate secret | **Owner** | P0 | ❌ Cần trao đổi |
| 3 | Rotate 7 secret | Owner + hạ tầng | P0 | ❌ Phụ thuộc #2 |
| 4 | Cập nhật OW-05 theo lựa chọn (b) | Agent | P2 | ✅ **Làm được ngay** |
| 5 | `migrate` DB dev (`0019` → `0023`) | Owner xác nhận | P1 | ⚠ Cần Owner xác nhận vì DB dùng chung |
| 6 | Tạo `docs/evidence/SEC-01/` | Agent | — | ⏳ Sau khi rotate |

## 6. Kết luận

Trong 3 việc còn lại, **không việc nào là code** — tất cả đều bị chặn bởi **quyền Owner**
(thanh toán, thông báo user, xác nhận DB dùng chung).

Việc tôi **làm được ngay**: cập nhật OW-05 (mục #4). Việc cần Owner xác nhận thêm: `migrate`
DB dev (mục #5).

⚠ **Không có kết luận nào cho:** 25 file test `src/*/tests/`, Playwright, mobile,
`agent-sync.ps1`. Và mọi kết luận về DB dev chỉ đúng cho **DB dev** — phải chạy lại trên DB thật.