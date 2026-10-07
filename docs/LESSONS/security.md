# Security - Lessons (Secrets, Ignore, Purge History)

> Bài học an toàn - ưu tiên phòng ngừa rò rỉ.
> ⚠ **Các bài học trong nhóm này thuộc phạm vi Owner.** Agent KHÔNG tự ý thực hiện revoke/rotate/purge.
> Nguồn: `AGENTS.md` mục OPEN P0 Portfolio Commercial (P0-SEC-01).

## L-S01: Secret trong repo - thứ tự xử lý KHÔNG được đảo

- **Nguyên nhân:** Xử lý secret sai thứ tự (vd. purge history quá sớm trước khi revoke/rotate).
- **Hậu quả thật:** Kéo dài thời gian secret bị lộ; hoặc purge history khi còn agent đang chạy → mất việc/hỏng worktree của agent khác.
- **Khi nào gặp:** `tags: [security, secret, secrets, env, ignore, purge, rotate, revoke, history]`
- **QUY TẮC:** "Thứ tự **KHÔNG đảo**: `revoke` → `rotate` → `gỡ khỏi HEAD` → `purge history` → `chặn tái diễn`. **KHÔNG purge history khi còn agent đang chạy.**"
- **CHECKLIST:**
  - [ ] Đã theo đúng thứ tự revoke → rotate → remove from HEAD → purge history → prevent re-commit?
  - [ ] **Đã xác nhận không còn agent đang chạy** trước khi purge history?
  - [ ] Chỉ ghi **tên file + số dòng** trong báo cáo, **KHÔNG** ghi giá trị secret?
  - [ ] Đã cập nhật `.gitignore` / chính sách để **chặn tái diễn**?
  - [ ] Việc này thuộc phạm vi Owner → đã báo, KHÔNG tự ý `revoke`/`rotate`?
- **Proof:** `AGENTS.md` mục OPEN P0 Portfolio Commercial - "Thứ tự **không đảo**: revoke → rotate → gỡ khỏi HEAD → purge history → chặn tái diễn. **Không purge history khi còn agent chạy.**"

## L-S02: Secret trong file tracked + không ignored là vi phạm kép

- **Nguyên nhân:** File `.env` vô tình bị `git add` và **không** nằm trong `.gitignore`; đồng thời chứa secret **có thể giải mã được** thật.
- **Hậu quả thật:** `compose.dev.env` **tracked** + không ignored, chứa `DNSE_CREDENTIAL_FERNET_KEY` 44 ký tự (đúng dạng Fernet) ⇒ **mọi `UserDNSECredential` trong DB giải mã được**. Ngoài ra 4 token GitHub thật / 20 file và 11 file `scratch/*.py` là **code chạy được**.
- **Khi nào gặp:** `tags: [security, secret, secrets, env, ignore, gitignore, fernet, dnse]`
- **QUY TẮC:** "`.env*` nằm trong **shared-file deny list** (§2 protocol) - KHÔNG commit. Secret **có thể giải mã được** phải coi như **đã lộ**, không phải 'mã hoá nên an toàn'."
- **CHECKLIST:**
  - [ ] Trước khi commit: đã kiểm tra file có nằm trong deny list `AGENT_PROTOCOL.md` §2 không?
  - [ ] File `.env*` đã được `.gitignore` **và** chưa bị track (`git ls-files`)?
  - [ ] Secret mã hoá nhưng **giải mã được** (vd. Fernet key có trong repo) → coi như **đã lộ**, cần rotate?
  - [ ] Đã chạy secret scan trước khi commit?
  - [ ] Báo cáo chỉ nêu **tên file + số dòng**, tuyệt đối không ghi giá trị secret?
- **Proof:** `AGENTS.md` mục OPEN P0 Portfolio Commercial (**P0-SEC-01 chờ owner**) - "`compose.dev.env` **tracked** + **không ignored**, chứa `DNSE_CREDENTIAL_FERNET_KEY` 44 ký tự (đúng dạng Fernet) ⇒ **mọi `UserDNSECredential` trong DB giải mã được**; 4 token GitHub thật / 20 file, 11 file `scratch/*.py` là **code chạy được**."