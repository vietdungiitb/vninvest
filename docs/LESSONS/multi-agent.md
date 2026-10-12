# Multi-Agent - Lessons (Claim, Shared Files, Worktree, Gate Timing, Hook)

> Nhóm bài học về **quy trình multi-agent** - nơi 1 sai lầm dễ nhân bản nhanh sang nhiều agent.
> Nguồn: bảng "Cạm bẫy đã gặp thật 2026-09-26" trong `AGENTS.md`.

## L-001: KHÔNG commit file shared

- **Nguyên nhân:** Agent sửa file nằm trong deny-list shared (§2 `AGENT_PROTOCOL.md`) mà chưa ghi claim, hoặc không tách được hunk riêng.
- **Hậu quả thật:** 1 hunk gộp 2 agent → **tách không được**, xung đột khó giải quyết khi merge song song.
- **Khi nào gặp:** `tags: [multi-agent, shared, shared-files, claim]`
- **QUY TẮC:** "KHÔNG commit thẳng các file shared (§2 protocol). Ghi vào claim + báo coordinator. Hook sẽ chặn."
- **CHECKLIST:**
  - [ ] File định sửa có nằm trong **shared-file deny list** không? (đọc `docs/AGENT_PROTOCOL.md` §2)
  - [ ] Nếu có → đã ghi vào `docs/CLAIMS.md` + báo coordinator **trước khi sửa**?
  - [ ] Đã kiểm tra agent khác có đang claim `in-progress` file đó không?
  - [ ] Nếu vẫn cần sửa shared file → có chỉ dẫn rõ ràng từ coordinator chưa?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy đã gặp thật 2026-09-26" dòng "Commit file shared"; `docs/AGENT_PROTOCOL.md` §2.

## L-002: Khai claim TRƯỚC khi sửa dòng đầu tiên

- **Nguyên nhân:** Bỏ qua bước khai claim, bắt tay sửa code ngay sau khi đọc trạng thái.
- **Hậu quả thật:** Che mất file đang bị giữ bởi agent khác → đụng độ song song, mất dấu ownership tại thời điểm claim.
- **ĐÃ LẶP LẠI 2 LẦN (2026-10-12, cùng một tác giả):** Entry 272 lẫn Entry 274 đều mở
  đầu bằng "sửa trước, khai claim sau". Lần 2 suy luận: *"Owner nói không còn agent nào
  khác nên không cần điều phối claim"* — **sai**, vì `check-multi-agent` và `pre-push`
  vẫn chạy và `docs/CLAIMS.md` vẫn phải là nguồn sự thật. Bài học nằm ở chỗ **suy luận
  từ ngữ cảnh để bỏ qua quy trình**, không phải ở chỗ quên.
- **Khi nào gặp:** `tags: [multi-agent, claim, claims, solo, skip-process]`
- **QUY TẮC:** "Khai claim vào cuối `docs/CLAIMS.md`, commit riêng, **trước khi sửa dòng đầu tiên**."
  **Không có ngoại lệ theo ngữ cảnh** — kể cả khi chắc chắn là đang làm một mình.
- **CHECKLIST:**
  - [ ] Đã chạy `git -C <main tree> status --short` để thấy thay đổi chưa commit của agent khác?
  - [ ] Đã **commit riêng** claim vào `docs/CLAIMS.md` **TRƯỚC** khi sửa dòng code đầu tiên?
  - [ ] Claim ghi rõ: phạm vi file + branch/agent + trạng thái `in-progress`?
  - [ ] Đã đọc `docs/CLAIMS.md` xem có agent khác `in-progress` cùng file không?
  - [ ] **Tôi có đang bỏ qua claim vì "lần này chắc chắn không ai xung đột" không?**
        Nếu có → dừng lại: đó chính là lỗi đã lặp 2 lần. Khai claim trước đã.
- **Proof:** `AGENTS.md` bảng "Cạm bẫy đã gặp thật 2026-09-26" dòng "Khai claim khi chưa
  `git status`"; `docs/AGENT_PROTOCOL.md` §3; `docs/CODE_CHANGE_AUDIT_LEDGER.md`
  Entry 272 §"Còn nợ quy trình" + Entry 274 §"Còn nợ quy trình (lần thứ 2)".

## L-003: Chạy gate TRƯỚC khi rebase - sai thứ tự

- **Nguyên nhân:** Chạy gate **trước** khi rebase lên nhánh base/dev.
- **Hậu quả thật:** Báo `PASS` xanh trên code cũ, nhưng **code sau rebase đã khác** → bỏ sót lỗi phát sinh sau đồng bộ.
- **Khi nào gặp:** `tags: [multi-agent, rebase, gate, gate-timing]`
- **QUY TẮC:** "Đóng phiên: `pwsh -File scripts/agent-sync.ps1` (**rebase → check migration → gate**) → claim `done` → push → PR. KHÔNG chạy gate trước rebase."
- **CHECKLIST:**
  - [ ] Đã tuân thủ thứ tự **rebase → check migration → gate**?
  - [ ] Có tự chạy gate riêng lẻ **trước** khi rebase không? (nếu có → kết quả đó không dùng được)
  - [ ] Sau rebase có rà lại vùng code đã sửa còn hợp lệ không?
  - [ ] Kết quả gate được báo cáo là từ code **sau rebase**?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy đã gặp thật 2026-09-26" dòng "Chạy gate **trước** khi rebase"; `docs/AGENT_PROTOCOL.md` §10.

## L-004: Trust số migration đọc trong worktree đơn lẻ

- **Nguyên nhân:** Chỉ nhìn migration trong worktree hiện tại, bỏ qua việc agent khác có thể đã thêm migration **chưa commit**.
- **Hậu quả thật:** Worktree không thấy việc chưa commit của agent khác (`aicc_r0` 145 vs `vninvest_core` 147) → tạo migration sai số → leaf conflict.
- **Khi nào gặp:** `tags: [multi-agent, migration, migrations, worktree]`
- **QUY TẮC:** "KHÔNG tin tuyệt đối số migration đọc trong worktree khi có nhiều agent song song. Đọc head trên base/dev + kiểm tra claim."
- **CHECKLIST:**
  - [ ] Đã đọc migration head trên **base/dev** (nguồn sự thật đồng bộ), không chỉ worktree?
  - [ ] Đã rà `docs/CLAIMS.md` xem agent khác có đang claim app/migration liên quan không?
  - [ ] Đã kiểm tra `git status` của **main tree** xem có file migration chưa commit không?
  - [ ] Không chắc chắn → ghi `CHƯA XÁC MINH`, KHÔNG tự đặt số?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy đã gặp thật 2026-09-26" dòng "Tin số migration đọc trong worktree".

## L-005: Không tạo worktree mới khi hook chưa commit thay đổi

- **Nguyên nhân:** Tạo worktree mới khi repo còn thay đổi chưa commit / hook state chưa ổn định.
- **Hậu quả thật:** Hook **im lặng** → mọi vi phạm lọt qua, mất lớp phòng vệ đầu tiên.
- **Khi nào gặp:** `tags: [multi-agent, worktree, hook, pre-commit]`
- **QUY TẮC:** "Trước khi tạo worktree mới: `git status --short` phải sạch (hoặc đã xử lý hết) và hook đã được cài/verify trong worktree đó."
- **CHECKLIST:**
  - [ ] `git status --short` sạch trước khi tạo worktree?
  - [ ] Đã chạy `sh scripts/agent-install-hooks.sh` cho worktree mới?
  - [ ] Đã verify hook thực sự chạy (không phải im lặng)?
  - [ ] Nghi ngờ hook im lặng → verify lại thay vì bỏ qua?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy đã gặp thật 2026-09-26" dòng "Hook chưa commit khi tạo worktree mới"; `docs/AGENT_PROTOCOL.md` §10.1.

## L-006: KHÔNG báo "PASS" cho thứ chưa chạy

- **Nguyên nhân:** Báo kết quả dựa trên suy luận ("chắc là được") thay vì thực thi thật.
- **Hậu quả thật:** False-positive, che lỗi thật, mất độ tin cậy của quality gates → regression lọt vào PR.
- **Khi nào gặp:** `tags: [multi-agent, gate, gates, pass-vs-unrun, build-gates]`
- **QUY TẮC:** "KHÔNG báo 'PASS' cho thứ chưa chạy. Nếu chưa chạy được, **ghi 'CHƯA CHẠY'** - đừng suy ra 'chắc là được'."
- **CHECKLIST:**
  - [ ] Mọi kết luận `PASS` đều có **bằng chứng thực thi** (command + exit code)?
  - [ ] Chưa chạy được → ghi rõ **`CHƯA CHẠY`** kèm lý do, KHÔNG chuyển thành `PASS`?
  - [ ] Đã phân biệt rõ 3 trạng thái: `PASS` (đã chạy, thành công) | `FAIL` (đã chạy, lỗi) | `CHƯA CHẠY` (chưa chạy được)?
  - [ ] Báo cáo cho coordinator có nêu rõ phần **chưa verify** không?
- **Proof:** `AGENTS.md` "Không báo 'PASS' cho thứ chưa chạy - ghi 'CHƯA CHẠY'"; `docs/AGENT_PROTOCOL.md` §9.

## L-007: Không có môi trường ⇒ không có kết luận

- **Nguyên nhân:** Cố kết luận BE test/backend khi chưa có môi trường cần thiết (DB, env).
- **Hậu quả thật:** Kết luận sai lệch, bỏ qua lỗi thật, mất tính trung thực của báo cáo verify.
- **Khi nào gặp:** `tags: [multi-agent, backend, be-test, db, postgres]`
- **QUY TẮC:** "Không có môi trường ⇒ không có kết luận. Nếu chưa chạy được, ghi 'CHƯA CHẠY'."
- **CHECKLIST:**
  - [ ] BE test cần `CORE_DATABASE_URL` + `DJANGO_DEBUG=1` - đã có chưa?
  - [ ] Đã xác nhận DB khả dụng (Postgres riêng cho agent) trước khi chạy test BE?
  - [ ] Thiếu môi trường → ghi **`CHƯA CHẠY`**, KHÔNG suy ra "chắc là được"?
  - [ ] Kết luận verify chỉ dựa trên test **thực sự đã chạy thành công**?
- **Proof:** `AGENTS.md` "Không có môi trường ⇒ không có kết luận".

## L-008: Nếu không có điểm merge thì sinh xung đột

- **Nguyên nhân:** Commit thẳng vào `dev`, không qua branch + PR. Không có điểm hợp nhất để đồng bộ.
- **Hậu quả thật:** Không ai kịp đồng bộ → **sinh migration trùng số** lúc 06:55 (2026-09-26), cần hợp nhất thủ công.
- **Khi nào gặp:** `tags: [multi-agent, branch, merge, pr, migration]`
- **QUY TẮC:** "**KHÔNG commit thẳng vào `dev`** - tạo `feat/<slice>-<agent>` rồi PR. Không có điểm merge thì không ai kịp đồng bộ."
- **CHECKLIST:**
  - [ ] Đang ở branch riêng `feat/...` (không phải `dev`)?
  - [ ] Đã tạo PR thay vì commit thẳng vào `dev`?
  - [ ] Nếu buộc phải commit vào `dev` → có ghi lý do vào body commit không?
  - [ ] Đã chạy `pwsh -File scripts/agent-pr.ps1` để tạo PR đúng quy trình?
- **Proof:** `AGENTS.md` "Không được: **Không commit thẳng vào `dev`** - tạo `feat/<slice>-<agent>` rồi PR... đã sinh migration trùng số (2026-09-26)"; `docs/AGENT_PROTOCOL.md` §10.0.

## L-A01: `git checkout -- <file>` de hoi quy thi lap - PHA HUY CA VIEC CHUA COMMIT

- **Nguyen nhan:** Dung `git checkout -- <file>` de "undo mot thu nghiem" (doi
  file tam roi khoi phuc). Lenh nay phuc hoi ve **HEAD**, khong phai ve ban sao
  luu truoc do.
- **Hau qua that:** Xoa mat **toan bo** phan dang lam cua agent, khong chi phan
  thu nghiem. Da gap **hai lan trong mot session** (skill `agent-lessons` hazard 11),
  va wave 10 cua repo nay cung nem `git checkout --` vao CLAIMS.md lam phinh diff.
- **Khi nao gap:** `tags: [git, checkout, revert, undo, experiment, worktree, hazard-11]`
- **QUY TAC:** Muon hoi quy mot thu nghiem thi dung:
  `git show HEAD:<file> > <file>` (doc ban HEAD roi ghi de) **hoac** copy file ra
  ngoai truoc `cp <file> /tmp/keep.ts`, **hoac** `git stash push -- <file>` roi `pop`.
  `git stash` + `pop` sau khi sua them se conflict, nen **copy ra ngoai truoc**.
- **CHECKLIST:**
  - [ ] Da **copy file ra ngoai** truoc khi doi file de thu nghiem chua?
  - [ ] `git status --short` co hien thay muc tieu cua lenh hoi quy khong?
  - [ ] Co `git diff --stat` de xac nhan khong con thay doi ngoai y muon khong?
- **Proof:** skill `multi-agent-workflow` hazard 11; `docs/audit-uiux/SESSION_LOG_WAVE10_20261010.md` §3.2.
