# Frontend - Lessons (Bundle, i18n, CSS/SOC)

> Chỉ thêm entry khi có bài học thực tế đủ giá trị phòng ngừa.
> Nguồn: `AGENTS.md` mục AI Advisory (B3) + Constraints về SOC CSS.

## L-F01: Đo bundle bằng cạnh import TĨNH, tránh nhầm chunk động `import()`

- **Nguyên nhân:** Dùng cách đo cảm nhận `import()` động để xác định tải đầu route.
- **Hậu quả thật:** Báo sai **94 chunk / 6.157 KB** và kéo theo route **chưa mở** → kết luận tối ưu bundle sai, ưu tiên fix nhầm nguyên nhân.
- **Khi nào gặp:** `tags: [fe, frontend, bundle, vite, rollup, chunk, preload]`
- **QUY TẮC:** "Đo tải đầu route bằng **BFS cạnh import TĨNH** (script `packages/web/scripts/measure-route-graph.mjs`). `import()` động là lazy chunk, KHÔNG thuộc tải đầu."
- **CHECKLIST:**
  - [ ] Đã phân biệt **static import** vs **dynamic `import()`** khi phân tích initial bundle?
  - [ ] Đã dùng script đo BFS cạnh tĩnh (không tự cảm nhận)?
  - [ ] Số chunk/KB có kèm **phạm vi đo** rõ ràng trước khi kết luận?
  - [ ] Đối chiếu với `npm run build` output thực tế trước khi báo cáo?
- **Proof:** `AGENTS.md` mục AI Advisory §B3 - "**Cạm bẫy đo bundle**: script đo đầu tiên của tôi cảm nhận `import()` động ⇒ báo 94 chunk/6.157 KB và kéo theo route **chưa mở**. Đo sai kiểu đó ra kết luận sai."

## L-F02: Vite preload sai chunk khiến mọi route tải dashboard

- **Nguyên nhân:** `__vitePreload` của Vite bị Rollup đặt nhầm vào chunk `dashboard`, trong khi app shell dùng nó.
- **Hậu quả thật:** **Mọi route** đều tải chunk `dashboard` → tải đầu `/ai-advisory` bị phình lên **1.998,6 KB** (sau khi fix: **1.339,8 KB**, −33%).
- **Khi nào gặp:** `tags: [fe, frontend, bundle, vite, rollup, preload, code-splitting]`
- **QUY TẮC:** "Sau khi code-split widget thành async chunk, phải verify **chunk nào thực sự được preload** ở tải đầu - Rollup có thể đặt nhầm `__vitePreload`."
- **CHECKLIST:**
  - [ ] Đã kiểm tra manifest/chunk map: chunk nào nằm trong **initial load**?
  - [ ] Library nặng (vd. `echarts` 623 KB) có nằm ngoài tải đầu route không?
  - [ ] Đã đo lại sau khi sửa để xác nhận **giảm** số liệu (không chỉ tin logic)?
  - [ ] Widget lazy-load đã tách đúng thành async chunk?
- **Proof:** `AGENTS.md` mục AI Advisory §B3 - "**Nguyên nhân gốc**: `__vitePreload` của Vite bị Rollup đặt nhầm vào chunk `dashboard`, mà app shell lại dùng nó ⇒ **mọi route** đều tải chunk dashboard. Đo bằng `packages/web/scripts/measure-route-graph.mjs` (BFS cạnh import **tĩnh**)."

## L-F03: KHÔNG thêm token/class vào soc.module.css

- **Nguyên nhân:** Thêm token hoặc class mới vào `soc.module.css` theo thói quen.
- **Hậu quả thật:** `soc.module.css` chỉ là **barrel 3 dòng re-export**, **0 token, 0 class** ⇒ chỉ dẫn không thi hành được, token/class mới không tồn tại thật.
- **Khi nào gặp:** `tags: [fe, frontend, css, soc, tokens, soc-components]`
- **QUY TẮC:** "Token → `soc.tokens.css`. Class → `soc.components.css`. **KHÔNG** dùng `soc.module.css`."
- **CHECKLIST:**
  - [ ] Token mới thêm vào `soc.tokens.css` (biến), không phải `soc.module.css`?
  - [ ] Class mới thêm vào `soc.components.css`, không phải `soc.module.css`?
  - [ ] Đã xác nhận `soc.module.css` chỉ là barrel re-export (3 dòng, 0 token/class)?
  - [ ] Đã grep **toàn repo** (`.css`, `.module.css`, config, i18n) để không bỏ sót chỗ đang dùng class cũ?
- **Proof:** `AGENTS.md` Constraints - "⚠ **KHÔNG dùng `soc.module.css`** - file đó chỉ là barrel 3 dòng re-export, **0 token, 0 class** (`packages/web/src/components/soc/soc.module.css:1-3`). Thêm token/class vào đó là chỉ dẫn không thi hành được."
## L-F04: KHONG dung Get-Content | Set-Content de sua file nhieu dong - no GHEP file thanh 1 dong

- **Nguyên nhân:** $lines = Get-Content f tra ve **mang chuoi**, nhung
  $lines[i] = ... phai la **mang dong**. Noi Set-Content -Value  -NoNewline
  se ghi cac phan tu lien tiep khong phan biet ⇒ **mat toan bo newline**.
- **Hậu quả thật:** soc.components.css **3.482 dong → 1 dong**. Commit ghi
  "6 files changed, 175 insertions(+), 3944 deletions(-)".
- **Khi nào gặp:** moi lan can sua hang chuc dong mot file van ban lon bang vong lap
  PowerShell. Rat pho bien tren Windows.
- **QUY TẮC:** Dung **Edit tool** cho sua tung cho, hoac **script Node**
  voi lines.join("\n"). KHONG bao gio dung Get-Content | Set-Content
  de sua file nhieu dong.
- **CHECKLIST:**
  - [ ] git diff --stat co deletions **bat thuong** (vuot so dong sua) khong?
  - [ ] So dong cua file **co giam so voi HEAD** khong? (Measure-Object -Line)
  - [ ] Da doc lai file bang Read tool (doc dung encoding) truoc khi commit?
- **Proof:** commit 75ef6a86 — khoi phuc bang git show HEAD~1:<file>,
  chay lai toan bo fix (ke ca phan da sua trong commit hong).

## L-F05: Script viet lai khai bao CSS shorthand se LAM MAT duration/asing

- **Nguyen nhan:** 	ransition: all 0.18s cubic-bezier(0.16,1,0.3,1) duoc viet
  lai thanh 	ransition: color, background; — bo mat phan thoi gian.
- **Hau qua that:** CSS mac dinh 	ransition-duration: 0s ⇒ **49 rule hover
  CHOP TUC THAY**, mat toan bo chuyen dong ma van "trong" ve mat.
- **Khi nao gap:** bat ky script nao sua 	ransition / nimation / ox-shadow /
  ont... dang gop nhieu thuoc tinh. Rat pho bien khi "don dep CSS".
- **QUY TAC:** script chi duoc lay **danh sach thuoc tinh**, **giu nguyen
  <time> <easing>**. Sau khi chay, **dem lai cac khai bao thieu thoi gian**:
  `ash
  node -e "/* dem moi khai bao transition trong src/**/*.css; thieu thoi gian => FAIL */"
  `
  Neu nhieu rule goc co **gia tri khac nhau** (0.15s / 0.18s / 0.3s), phai doc
  ban dev va **khoi phuc dung gia tri goc** — gan het mot gia tri la doi
  cam giac UI so voi thiet bi da chon truoc day.
- **CHECKLIST:**
  - [ ] Script co giu phan thoi gian/easing khong?
  - [ ] Da dem lai 	ransition/nimation **thieu thoi gian** = 0?
  - [ ] Da so sanh gia tri goc voi dev (chay git show dev:<file>)?
- **Proof:** audit Stage 5 dem truc tiep "	ransition: all da duoc bo het, nhung
  **49 khai bao khong con so thoi gian nao**". Chi co 
one !important la duoc.

## L-F06: Quet bang cua so +-N dong tao FALSE POSITIVE - phai kiem chung tay truoc khi "sua"

- **Nguyen nhan:** quet tinh khop outline-none roi kiem tra ocus: **trong
  +-8 dong**. Rule .input:focus nam sau 20 dong ⇒ bo qua ⇒ **bao loi o khi
  file da co focus ring that**.
- **Hau qua that:** A11Y-8 bao 6 loi; kiem chung tay: **3/6 file CSS da co**
  :focus + ox-shadow ring (iSettings.module.css:455,
  VninvestInput.module.css:60, UserSettingsPage.css:106).
  Vong lap thu 2 (khop theo ten don le cua selector) van sai vi selector nhieu
  phan tu (.dnse-panel__field input).
- **Khi nao gap:** moi quet "rule X co ban khong?" bang heuristic cua so dong.
- **QUY TAC:** heuristic theo **cua so dong** chi dung de **nhiều candidate**,
  khong phai ket luan. Truoc khi sua: **(a)** doc ile:line that cua tung
  candidate, **(b)** neu chi sua gate chu khong sua code, sua matcher de kiem
  o **muc file**. Ghi ro rule nao **co nguyang false-positive** thay vi "het loi".
- **CHECKLIST:**
  - [ ] Da doc tay it nhat 3 candidate truoc khi sua?
  - [ ] Co candidate nao la convention chuan (vd shadcn content panel khong
    focusable) khong?
  - [ ] Da ghi "co nguyang false positive" vao bao cao chua?
- **Proof:** docs/audit-uiux/scripts/scan-ui-guidelines.mjs - ham A11Y-8.

## L-F07: Doc $LASTEXITCODE SAU khi pipeline = doc sai nhat (lam gate PASS khi FAIL)

- **Nguyen nhan:** $LASTEXITCODE lay cua **lenh cuoi cung** trong pipeline.
  
pm run lint | Select-String "..." ⇒ $LASTEXITCODE cua Select-String,
  khong phai cua 
pm.
- **Hau qua that:** bao "lint exit 1" trong khi 
pm run lint thuc te exit 0
  (0 errors). Neu dao chieu, bao nham cho bao cao that.
- **Khi nao gap:** moi khi can ca exit code **VA** muon hien thi output cung luc.
- **QUY TAC:** tach 2 buoc:
  `powershell
   = npm run lint 2>&1;  = ;  | Select-Object -Last 3
  `
  Tuong tu: dung script Node de chay va doc status, khong dua vao pipeline.
- **CHECKLIST:**
  - [ ] Co can ca exit code khong? -> tach khoi pipeline.
  - [ ] Bao cao nao co "exit" thi do bang lenh THAT chay, khong phai lenh doc output.

## L-F08: MÀU TĂNG/GIẢM - thị trường Việt DUNG chuẩn Bloomberg (xanh = tăng, đỏ = giảm)

- **Sai lầm:** tôi khẳng định "thi truong Viet dung chuan NGHICH (do = tang)".
  **SAI.** Owner chot lai 2026-10-07: **Việt Nam dung GIONG Bloomberg —
  xanh = tăng, đỏ = giảm.**
- **Tai sao nham:** to hop "chuan Chau/A" (Trung Quoc, Nhat: do = tang) voi
  "chuan phuong Tay" (Bloomberg, Wall Street) ma khong kiem chung.
- **Hau qua:** neu suy ra nhanh, se doi nguoc mau cua ca he thong tai chinh.
- **QUY TAC:** token hien tai **dung chuan Bloomberg, giu nguyen**:
  --pf-gain (xanh) / --pf-loss (do).
  Spec PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md:156-157,1222,1225 ghi
  "Bloomberg green (up)" — **spec DUNG**, khong sua.
  Khi tai chinh o mo phong toi thieu truong khac: **hỏi Owner**, tu do lai doc.
- **CHECKLIST:**
  - [ ] Khi sua mau tang/giam, da **hoi Owner** chua?
  - [ ] Da doc spec chua (tai day spec la chuan Bloomberg)?
- **Proof:** Owner chot 2026-10-07. Entry 250/251 cua ledger da sua lai.
