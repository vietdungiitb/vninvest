# Migrations - Lessons (Django Migrations, Leaf Nodes, Head Truth)

> Nhóm migration có tần suất lỗi cao nhất (conflicting leaf nodes).
> Ưu tiên an toàn: **đọc head thật, KHÔNG tự đặt số**.
> Nguồn: bảng "Cạm bẫy đã gặp thật 2026-09-26" trong `AGENTS.md`.

## L-M01: Để Django sở hữu số migration + kiểm leaf TRƯỚC khi commit (gộp M01 cũ + M03 cũ)

- **Nguyên nhân:** Agent đoán số file migration kế tiếp (`0009_...`) thay vì để `makemigrations` sinh, tự sửa số của migration có sẵn, hoặc tạo migration mà không kiểm cây leaf sau rebase.
- **Hậu quả thật:** **`Conflicting migrations; multiple leaf nodes`** → chặn deploy, phải hợp nhất thủ công, tốn thời gian.
- **Khi nào gặp:** `tags: [migration, migrations, makemigrations, leaf-node, leaf_node, rebase]`
- **QUY TẮC:** "KHÔNG tự đặt số migration — để `makemigrations` sinh. Và kiểm leaf nodes **trước** khi commit, không phải sau khi deploy đỏ."
- **CHECKLIST:**
  - [ ] **TUYỆT ĐỐI KHÔNG** chỉnh sửa/tự gán số của file migration có sẵn?
  - [ ] Migration mới được sinh bằng `makemigrations` (không tạo file migration thủ công rồi tự đặt số)?
  - [ ] Nếu sửa nội dung migration cũ → KHÔNG đổi tên file / số thứ tự?
  - [ ] Đã chạy `makemigrations --check` (exit 0) để xác nhận không thiếu migration?
  - [ ] Đã hình dung cây migration / leaf node hiện tại **trước** khi `makemigrations`?
  - [ ] Nếu nhiều agent cùng làm trên 1 app → đã **đồng bộ claim** trước khi tạo migration?
  - [ ] Đã chạy `showmigrations` để xác nhận cây hợp lệ?
  - [ ] Phát hiện leaf conflict → **KHÔNG** ép sửa số "fix nhanh", mà báo coordinator theo protocol?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy" dòng "Tự đặt số migration" → `Conflicting migrations; multiple leaf nodes`; `docs/AGENT_PROTOCOL.md` §4.

## L-M02: Đọc migration head THẬT - không chỉ trong worktree

- **Nguyên nhân:** Chỉ nhìn danh sách migration trong app hiện tại, bỏ qua branch base/dev và migration **chưa commit** của agent khác (multi-worktree).
- **Hậu quả thật:** Worktree không thấy việc chưa commit của agent khác (`aicc_r0` 145 vs `vninvest_core` 147) → tạo migration sai số dẫn đến **multiple leaf nodes**.
- **Khi nào gặp:** `tags: [migration, migrations, leaf-node, worktree, multi-agent]`
- **QUY TẮC:** "Đọc head migration thật (base/dev + ngữ cảnh claim). KHÔNG tin tuyệt đối số đọc trong worktree đơn lẻ khi có nhiều agent song song."
- **CHECKLIST:**
  - [ ] Đã kiểm tra migration head trên **nhánh base/dev** làm nguồn sự thật?
  - [ ] Đã rà `docs/CLAIMS.md` xem agent khác có claim app/migration liên quan không?
  - [ ] Đã kiểm tra `git status` **main tree** có file migration chưa commit không?
  - [ ] Field `dependencies = [...]` trong migration mới có phản ánh **đúng leaf hiện tại** không?
  - [ ] Không chắc chắn → ghi `CHƯA XÁC MINH`, KHÔNG tự đoán số?
- **Proof:** `AGENTS.md` bảng "Cạm bẫy" dòng "Tin số migration đọc trong worktree → Worktree không thấy việc chưa commit của agent khác (`aicc_r0` 145 vs `vninvest_core` 147)"; `docs/LESSONS/multi-agent.md` L-004 (bản trùng, đã gộp vào đây).

## L-M04: Cây test/migration trên VPS bám HEAD CŨ ⇒ sinh migration trùng số đã merge

- **Nguyên nhân:** Cây test trên VPS được copy từ `/opt/vninvest` — checkout **đã cũ** (chưa `git pull` sau khi PR khác vừa merge). `makemigrations` chạy trên cây đó **không thấy** migration mới trên `dev`, nên đánh số lại từ đầu.
- **Hậu quả thật (đo được 2026-10-17, R4.2):** Đã merge `0021_aitenantpolicy` (R4.1). Cây VPS còn ở R3.3 ⇒ `makemigrations` sinh **`0021_useraicredential_...` kèm luôn `Create model AITenantPolicy`** — trùng số **và** tạo lại model đã có. Merge là deploy hỏng (`multiple leaf nodes`), phải bỏ file sinh sai rồi sinh lại (`0022_...`).
- **Khi nào gặp:** `tags: [migration, makemigrations, vps, staging, worktree, cherry-pick, stale]`
- **QUY TẮC:** "Trước khi `makemigrations` trên máy khác (VPS/CI), cây nguồn phải **đã ở HEAD của `dev`**. `git pull --ff-only origin dev` là bước **bắt buộc**, không phải tuỳ chọn."
- **CHECKLIST:**
  - [ ] Cây dùng để sinh migration đã `git log -1` khớp `dev` không?
  - [ ] File migration mới sinh có chứa `Create model` cho model **đã có** trên `dev` không? (dấu hiệu cây cũ)
  - [ ] Số file mới có khớp với file mới nhất trên `dev` không (ví dụ dev đã có `0021` ⇒ file mới phải là `0022`)?
  - [ ] Đã tải file sinh về local/nhánh và `git status` thấy **đúng một** file migration mới?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 369 (mục "BẪY THẬT — MIGRATION TRÙNG SỐ"); `docs/evidence/ai-cc/r42-gates.md`.