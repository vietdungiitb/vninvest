# Build Gates - Lessons (TS/Build/Lint, Timing, PASS vs CHƯA CHẠY)

> Gate chỉ có giá trị khi chạy **đúng thời điểm** (sau rebase) và **trên code thật đã chạy** (không đoán).
> Nguồn: `AGENTS.md` "Build verification" + bảng "Cạm bẫy đã gặp thật 2026-09-26".

## L-G01: Rebase → Check Migration → Gate (thứ tự bắt buộc)

- **Nguyên nhân:** Chạy gate trước khi rebase lên base/dev.
- **Hậu quả thật:** Báo `PASS` xanh trên code hiện tại nhưng **code sau rebase đã khác** → bỏ sót lỗi/conflict phát sinh sau đồng bộ.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, build-gate, rebase, gate-timing]`
- **QUY TẮC:** "Thứ tự đóng phiên: **rebase → check migration → gate**. KHÔNG chạy gate trước rebase."
- **CHECKLIST:**
  - [ ] Đã tuân thủ trình tự **rebase** → **check migration** → **gate** (theo `scripts/agent-sync.ps1`)?
  - [ ] Không tự tách riêng chạy gate trước khi rebase?
  - [ ] Sau rebase có rà lại vùng code đã sửa còn đúng không?
  - [ ] Kết quả gate được báo cáo là từ code **sau rebase**?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy" dòng "Chạy gate **trước** khi rebase → Báo xanh nhưng code sau rebase khác"; `docs/AGENT_PROTOCOL.md` §10.

## L-G02: KHÔNG báo "PASS" cho thứ chưa chạy - ghi "CHƯA CHẠY"

- **Nguyên nhân:** Báo kết quả dựa trên suy luận/ước đoán ("chắc là được") thay vì thực thi thật.
- **Hậu quả thật:** False-positive, che lỗi, mất độ tin cậy của quality gates → dễ lọt regression vào PR.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, pass-vs-unrun, tsc, lint, build, test]`
- **QUY TẮC:** "KHÔNG báo 'PASS' cho thứ chưa chạy. Nếu chưa chạy được, **ghi 'CHƯA CHẠY'** - đừng suy ra 'chắc là được'."
- **CHECKLIST:**
  - [ ] Mỗi mục gate/test/build có **bằng chứng thực thi** (command + exit code)?
  - [ ] Không chạy được (thiếu DB/env) → ghi **`CHƯA CHẠY`** kèm lý do ngắn, KHÔNG đổi thành `PASS`?
  - [ ] Đã phân biệt rõ 3 trạng thái: `PASS` | `FAIL` | `CHƯA CHẠY`?
  - [ ] Frontend: `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi step - **chỉ báo PASS khi đã chạy thành công**?
- **Proof:** `AGENTS.md` "Không báo 'PASS' cho thứ chưa chạy - ghi 'CHƯA CHẠY'"; "Không có môi trường ⇒ không có kết luận".

## L-G03: Gate trên máy agent KHÔNG đại diện cho máy khác

- **Nguyên nhân:** Tin tuyệt đối kết quả gate chạy trên máy agent, không kiểm tra lại ở môi trường merge.
- **Hậu quả thật:** Cả 4 agent báo gate PASS, nhưng khi merge lại chạy thì **198 test `errors=1`** (lỗi tiếng Việt có dấu trong `print()` gây `UnicodeEncodeError` trên cp1252) → làm `migrate` thất bại giữa chừng.
- **Khi nào gặp:** `tags: [gate, gates, build-gates, multi-agent, test, merge]`
- **QUY TẮC:** "Gate trên máy agent **KHÔNG đại diện** cho máy khác. Kết luận merge phải dựa trên gate chạy **sau khi merge/rebase** trên đúng môi trường đích."
- **CHECKLIST:**
  - [ ] Đã chạy lại gate **sau khi rebase lên base/dev** (không dùng kết quả trước rebase)?
  - [ ] Nếu kết quả merge khác kết quả agent → đã ghi rõ **sự khác biệt** trong báo cáo?
  - [ ] Với test nhạy cảm encoding/locale (Windows cp1252) → đã kiểm tra riêng?
  - [ ] Đã xác nhận test suite chạy trên đúng DB engine của môi trường đích?
- **Proof:** `AGENTS.md` mục Portfolio Commercial - "Bài học coordinator đã trả giá: cả 4 agent báo gate PASS; merge lại chạy thì **198 test `errors=1`** ... `0019:264-272` `print()` tiếng Việt có dấu ⇒ `UnicodeEncodeError` trên cp1252 ⇒ làm `migrate` thất bại giữa chừng. Gate trên máy agent **không** đại diện cho máy khác."

## L-G04: Con so dem duoc KHONG phai con so LOI - phan loai theo muc do truoc khi bao cao

- **Nguyen nhan:** scanner dem "mot mau van ban" roi tu doong bang "N loi".
  Khong tach muc do, nen **noi manh gap voi thuc te**.
- **Hau qua that (4/5 muc bi thoi phong, doc lai trong `docs/audit-uiux/UIUX_AUDIT_20261007.md` muc 10):**

| Muc | Da bao | Thật | Sai vi sao |
|---|---|---|---|
| state khong dong bo URL | 115 | **29** | Dem moi useState, ke ca form input ma deep-link vo nghia |
| thieu label | 44 | 45 | Gan dung nhung chua tach theo muc tap trung |
| thieu h1 | 63 | **24** | Bo qua shell da render h1; "sua" theo so cu se tao 33 trang co **hai** h1 |
| locale that | 19 | **21** | Revert ca lot keo mat 2 diem da sua dung |

- **Khi nao gap:** moi khi bao cao mot con so tu dong (scanner, lint, grep). Rat pho bien.
- **QUY TAC:** truoc khi ghi mot con so vao bao cao:
  1. **Phan loai theo muc do** (that / tuong doi / khong phai loi).
  2. Kiem chung **it nhat 3** muc nang cao nhat bang tay, doc `file:line` that.
  3. Neu co mau danh tinh — vd shell da render h1 — **doc kien truc truoc khi dem**.
     Dem khong kiem chung kien truc la nguon sai lon nhat.
  4. Ghi ro **vi sao** con so phai tach ra, khong bao cao mot so.
- **CHECKLIST:**
  - [ ] Da tach "that / tuong doi / khong phai loi" chua?
  - [ ] Da doc kien truc dung khong (khong dem tren ma nguon)?
  - [ ] Neu sua theo danh sach nay co lam **hai** thu bi trung khong (vd 2 h1)?
  - [ ] Con so co kem **lenh tai tao** khong?
- **Proof:** muc 10 cua `docs/audit-uiux/UIUX_AUDIT_20261007.md`.

## L-G05: `git diff --stat` deletions BAT THUONG = trieu chung, dung phai cham vao

- **Hau qua that:** mot vong lap PowerShell doc file roi ghi lai bang `Set-Content -NoNewline`
  lam `soc.components.css` **3.482 dong -> 1 dong**. Commit ghi `3944 deletions`.
  Chi thay mau do **SAU** khi da commit va do lai so dong.
- **QUY TAC:** moi commit, neu `deletions` vuot so dong sua thi **dung lai**:
  1. `git show --stat HEAD`
  2. Do lai so dong: so sanh file hien tai voi `git show dev:<file>`
  3. Khoi phuc: `git show HEAD~1:<file> > <file>` roi **chay lai toan bo fix**.
- **CHECKLIST:**
  - [ ] `deletions` co vuot so dong sua khong?
  - [ ] File nao giam > 10 dong khong doi-chu y?

## L-G06: Revert theo LOT keo mat ca fix da lam DUNG o file khac

- **Hau qua that:** `TenantAdminBillingPage.tsx` loi scope nen revert **ca file do**;
  nhung file do da sua 2 diem `toLocaleString()` **dung o cho khac** bi revert theo.
  Ket qua: I18N-1 tu 19 (da bao) thanh **21** so voi thuc te.
- **QUY TAC:** revert **theo file**, va **do lai con so truoc/sau** o nhung file
  da sua dung bi revert theo. Khong bao cao "da xong" bang nho so truoc revert.
- **CHECKLIST:**
  - [ ] Revert tung file chu khong phai ca lot?
  - [ ] Da kiem tra file bi revert keo theo co mat fix nao khong?


## L-G07: Dem file theo TEN, khong phai theo REGISTRY - component con khong phai route

- **Hau qua that:** 5 file `pages/portfolio/Portfolio*Page.tsx` co ten dung
  `*Page.tsx` nen script dem nhu route-level. That su **5 route portfolio deu map
  ve MOT entry** `portfolio-workspace` (`pageRegistry.js:210-211`) - 5 file do la
  **tab con** cua `PortfolioWorkspace`. Dem theo ten file => **24** thay vi **19**.
  Sai lan thu 5 trong 5 muc (xem L-G04).
- **QUY TAC:** truoc khi dem "so trang thieu X", tra nguon su that la gi:
  1. `pageRegistry.js` / `routeCatalog.js` - danh sach route THAT.
  2. Grep cac component nao duoc `import()` that trong registry.
  3. Tinh theo **component duoc render**, khong theo ten file.
- **CHECKLIST:**
  - [ ] Da lay danh sach route tu registry chu khong phai tu ten file chua?
  - [ ] File ten co `Shell`/`Page` nhung co that su la route khong? (vi du
      `market/ShellStockDetailPage.js` - co `Shell` trong ten nhung khong dung
      `ShellPageTemplate`)
  - [ ] Co nhieu route dung chung 1 component khong? (khi do chi 1 lan sua)
- **Proof:** muc 4 cua `docs/audit-uiux/HANDOFF_UIUX_REMAINING_20261008.md`.

## L-G08: Gate DO o worktree nhung XANH o main tree - phai thi nghiem DOI CHUNG, dung doan

- **Nguyen nhan:** Gate doc/so sanh duong dan **tuong doi** hoac phu thuoc
  `core.autocrlf`/thu muc lam viec, nen ket qua **khac nhau giua main tree va worktree**.
- **Hau qua that:** `pre-push-gate` FAIL `global-config-drift` khi push tu worktree.
  Do la chi gate do trong 17 gate. Bang chung kiem chung: lenh do **PASS tren `dev` sach**
  (exit 0) va **FAIL y het tren worktree khac khong do toi file nao**. Co tie su: PR #46,
  PR #47 da phai push `--no-verify` vi ly do giong het.
- **Khi nao gap:** `tags: [gate, worktree, drift, exit-code, no-verify, billing, ci]`
- **QUY TAC:** **KHONG** doan gate do hong vi thay doi cua minh. Thi **thu nghiem doi
  chung**: chay cung lenh tren (a) `dev` sach o main tree, (b) mot worktree **khong sua
  gi**. Cung FAIL ⇒ loi moi truong, khong phai loi code ban. Ghi ly do vao **commit body**
  khi `--no-verify`. Tuong tu: CI fail vi **billing** thi chay lai cac buoc cua workflow
  **bang tay** thay vi merge tren gate chua kiem.
- **CHECKLIST:**
  - [ ] Gate do co doc duong dan tuong doi / `core.autocrlf` khong?
  - [ ] Da chay tren `dev` sach de doi chung chua?
  - [ ] Da chay tren worktree khong sua gi de loi moi truong chua?
  - [ ] Ly do `--no-verify` da ghi trong **commit body** chua?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 264` §3 (drift) va
  `docs/TEST_REPORT_UIUX_WAVE11.md` §5 (billing).
