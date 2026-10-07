# Backend - Lessons (DB, Postgres, BE Tests, Migrate)

> Chỉ ghi bài học **thực tế** có thể phòng ngừa.
> Nguồn: `AGENTS.md` "Không có môi trường ⇒ không có kết luận" + mục VERIFY 6 slice `tenantreg`.

## L-B01: BE test KHÔNG chạy được trên SQLite - phải dựng Postgres

- **Nguyên nhân:** Chạy test BE trên SQLite mặc định, trong khi migration/query dùng tính năng Postgres (vd. `array_agg`).
- **Hậu quả thật:** `OperationalError: no such function: array_agg` ngay lúc migrate (`identity_access/9000_auth_user_email_ci_unique.py:60`) → test không chạy được, dễ bị hiểu nhầm là lỗi code.
- **Khi nào gặp:** `tags: [backend, be-test, db, postgres, sqlite, migrate]`
- **QUY TẮC:** "BE test cần Postgres. Migration dùng Postgres-specific ⇒ **KHÔNG** ép chạy SQLite để 'PASS'."
- **CHECKLIST:**
  - [ ] Đã xác nhận test engine là Postgres (không phải SQLite)?
  - [ ] Có `CORE_DATABASE_URL` + `DJANGO_DEBUG=1` (thiếu → settings raise `ImproperlyConfigured`)?
  - [ ] Đã dựng **DB riêng** cho agent (vd. `aicc_r0`) thay vì dùng chung?
  - [ ] Thiếu Postgres → ghi **`CHƯA CHẠY`**, KHÔNG suy ra "chắc là được"?
  - [ ] Đã `DROP` DB tạm sau khi verify xong?
- **Proof:** `AGENTS.md` mục VERIFY 6 slice `tenantreg-*` - "**Bẫy môi trường mới**: BE test **không chạy được trên SQLite**. Migration `identity_access/9000_auth_user_email_ci_unique.py:60` dùng `array_agg` của Postgres ⇒ `OperationalError: no such function: array_agg` ngay lúc migrate. Phải dựng DB Postgres riêng."

## L-B02: Test của cùng 1 slice nằm ở 2 thư mục khác nhau

- **Nguyên nhân:** Gọi test theo đường dẫn sai thư mục khi chạy.
- **Hậu quả thật:** 5 `ModuleNotFoundError` - **không phải lỗi code**, nhưng dễ mất thời gian điều tra nhầm.
- **Khi nào gặp:** `tags: [backend, be-test, test, tenantreg]`
- **QUY TẮC:** "Trước khi kết luận test lỗi, xác nhận **đường dẫn thư mục test đúng**. `ModuleNotFoundError` thường do gọi sai path, không phải lỗi code."
- **CHECKLIST:**
  - [ ] Đã xác nhận file test nằm ở `backend/src/<app>/tests/` hay `backend/tests/`?
  - [ ] `ModuleNotFoundError` → kiểm tra path trước khi kết luận lỗi code?
  - [ ] Đã chạy đúng **cả 2** thư mục nếu slice có test ở cả hai?
- **Proof:** `AGENTS.md` mục VERIFY 6 slice `tenantreg-*` - "Test của `tenantreg-c` nằm ở **2 thư mục khác nhau**: `a`/`b`/`c1`/`c5` ở `backend/src/identity_access/tests/`, còn `c2`/`c3c4`/`c6`/`c7`/`c8` ở `backend/tests/` - gọi sai đường dẫn cho 5 `ModuleNotFoundError` (không phải lỗi code)."

## L-B03: Migration/data script KHÔNG in tiếng Việt có dấu ra stdout

- **Nguyên nhân:** Dùng `print()` chứa ký tự tiếng Việt có dấu trong migration/data script chạy tự động.
- **Hậu quả thật:** `UnicodeEncodeError` trên Windows console `cp1252` → `migrate` thất bại **giữa chừng**, dừng pipeline.
- **Khi nào gặp:** `tags: [backend, migrate, db, migration, encoding, windows]`
- **QUY TẮC:** "Script chạy tự động (migrate/seed/test setup) KHÔNG in ký tự ngoài ASCII ra stdout non-UTF8, hoặc phải xử lý encoding rõ ràng."
- **CHECKLIST:**
  - [ ] Migration/data migration tránh `print()` có ký tự tiếng Việt có dấu?
  - [ ] Nếu cần log tiếng Việt → dùng `logger` với encoding rõ ràng, hoặc ASCII?
  - [ ] Đã kiểm tra script chạy được trên Windows console (`cp1252`), không chỉ Linux (`utf-8`)?
  - [ ] Đã test `migrate` end-to-end trên đúng OS/locale của môi trường đích?
- **Proof:** `AGENTS.md` mục Portfolio Commercial - "`0019:264-272` `print()` tiếng Việt có dấu ⇒ `UnicodeEncodeError` trên cp1252 ⇒ **làm `migrate` thất bại giữa chừng**."