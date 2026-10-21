# CSS/SOC - Lessons (token, shorthand, quet a11y, mau)

> Tach tu `frontend.md` (2026-10-10) de **C1**: 1 file <= 120 dong.
> `tags: [css, soc, tokens, a11y, focus, color, shorthand, scss]`

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

## L-F05: Script viet lai khai bao CSS shorthand se LAM MAT duration/easing

- **Nguyen nhan:** transition: all 0.18s cubic-bezier(0.16,1,0.3,1) duoc viet
  lai thanh transition: color, background; — bo mat phan thoi gian.
- **Hau qua that:** CSS mac dinh transition-duration: 0s ⇒ **49 rule hover
  CHOP TUC THAY**, mat toan bo chuyen dong ma van "trong" ve mat.
- **Khi nao gap:** bat ky script nao sua transition / animation / box-shadow /
  font... dang gop nhieu thuoc tinh. Rat pho bien khi "don dep CSS".
- **QUY TAC:** script chi duoc lay **danh sach thuoc tinh**, **giu nguyen
  <time> <easing>**. Sau khi chay, **dem lai cac khai bao thieu thoi gian**:
  `bash
  node -e "/* dem moi khai bao transition trong src/**/*.css; thieu thoi gian => FAIL */"
  `
  Neu nhieu rule goc co **gia tri khac nhau** (0.15s / 0.18s / 0.3s), phai doc
  ban dev va **khoi phuc dung gia tri goc** — gan het mot gia tri la doi
  cam giac UI so voi thiet bi da chon truoc day.
- **CHECKLIST:**
  - [ ] Script co giu phan thoi gian/easing khong?
  - [ ] Da dem lai transition/animation **thieu thoi gian** = 0?
  - [ ] Da so sanh gia tri goc voi dev (chay git show dev:<file>)?
- **Proof:** audit Stage 5 dem truc tiep "transition: all da duoc bo het, nhung
  **49 khai bao khong con so thoi gian nao**". Chi co 
one !important la duoc.

## L-F06: Quet bang cua so +-N dong tao FALSE POSITIVE - phai kiem chung tay truoc khi "sua"

- **Nguyen nhan:** quet tinh khop outline-none roi kiem tra focus: **trong
  +-8 dong**. Rule .input:focus nam sau 20 dong ⇒ bo qua ⇒ **bao loi o khi
  file da co focus ring that**.
- **Hau qua that:** A11Y-8 bao 6 loi; kiem chung tay: **3/6 file CSS da co**
  :focus + box-shadow ring (aiSettings.module.css:455,
  VninvestInput.module.css:60, UserSettingsPage.css:106).
  Vong lap thu 2 (khop theo ten don le cua selector) van sai vi selector nhieu
  phan tu (.dnse-panel__field input).
- **Khi nao gap:** moi quet "rule X co ban khong?" bang heuristic cua so dong.
- **QUY TAC:** heuristic theo **cua so dong** chi dung de **nhiều candidate**,
  khong phai ket luan. Truoc khi sua: **(a)** doc file:line that cua tung
  candidate, **(b)** neu chi sua gate chu khong sua code, sua matcher de kiem
  o **muc file**. Ghi ro rule nao **co nguyang false-positive** thay vi "het loi".
- **CHECKLIST:**
  - [ ] Da doc tay it nhat 3 candidate truoc khi sua?
  - [ ] Co candidate nao la convention chuan (vd shadcn content panel khong
    focusable) khong?
  - [ ] Da ghi "co nguyang false positive" vao bao cao chua?
- **Proof:** docs/audit-uiux/scripts/scan-ui-guidelines.mjs - ham A11Y-8.

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

## L-F11: KHONG kết luận "CSS module không map class" từ file nguồn — đọc CSS ĐÃ BUILD

- **Nguyên nhân:** Đọc `soc.module.css` (3 dòng `@import`) rồi suy ra `styles.metricCard` là `undefined` ⇒ class không được áp dụng ⇒ báo "panel không có style" như một finding nghiêm trọng.
- **Hậu quả thật (2026-10-19, audit tab VNBroker):** Đọc `packages/web/dist/assets/soc-*.css` → tìm thấy `._metricCard_ovxpd_1{...}`, `._serviceCard_ovxpd_1{...}` ⇒ Vite/postcss-modules **CÓ** scope class của file được `@import` trong barrel. Kết luận sai đã bị bác **trước khi** vào báo cáo; nếu lỡ đưa vào, báo cáo mang 1 finding P0 giả (ảnh chụp thật cho thấy style có áp dụng).
- **Khi nào gặp:** `tags: [css, soc, modules, vite, postcss, audit, false-positive, build, dist]`
- **QUY TẮC:** "Muốn kết luận về **class có được áp dụng hay không** ⇒ đọc **CSS đã build** (`packages/web/dist/assets/*.css`, hoặc `docker cp` từ `/usr/share/nginx/html/assets/` trong image) và tìm tên class **đã hash** (`_metricCard_<hash>_1`). **Đừng** suy ra từ nội dung file `.module.css`. Mẹo nhận biết nhanh: class đã hash **không** xuất hiện dưới dạng `.metricCard` — tìm chuỗi `metricCard` (**không** ký hiệu chấm)."
- **CHECKLIST:**
  - [ ] Đã tìm tên class **không ký hiệu chấm** trong CSS build trước khi kết luận class không map chưa?
  - [ ] Đã phân biệt "file `.module.css` là barrel" với "class trong file được `@import` **không** được scope"?
  - [ ] Nếu deploy khác local: đã lấy CSS từ **đúng artifact** (docker image, không phải `dist` trên host — xem L-V01)?
  - [ ] Khi đối chiếu ảnh chụp mà thấy "unstyled", đã **hỏi lại**: style có thật sự không áp dụng, hay chỉ là tương phản thấp (border 1px alpha 0.15 trên nền tương tự)?
- **Proof:** `docs/AUDIT_VNBROKER_CONSOLE_20261019.md` §E1 + Phụ lục P4; `packages/web/dist/assets/soc-CqdbE_IP.css` chứa `._metricCard_ovxpd_1` và `._serviceCard_ovxpd_1` dù `soc.module.css` chỉ có 3 dòng.

## L-F12: Muốn "giu cot khi cuon ngang" — ĐỪNG dan nen cho 1 o; hay rut bang cho VUA container

- **Nguyen nhan:** Bang 9 cot rong hon container (1377px > 1202px) ⇒ cot cuoi (hanh dong) bi day ra
  ngoai tam nhin ⇒ dua no "dinh" (`position: sticky`) la cach nhanh nhat.
- **Hau qua that (Entry 391/W1, 2026-10-21):** dan nen `#ffffff` cho o sticky ⇒ o **light theme** khop, o
  **dark theme** tao mot **dai trang** che bang + 2 nut hanh dong "mo tren nen trang" (khong doc duoc) ⇒
  Owner gui anh bao "cot thao tac dang loi, mau sac cung khong hop voi dark theme cua ca trang".
  Sua bang token (`var(--color-bg-panel)`) ⇒ o dark van **lech** vi card nen **ban trong suot**
  (`rgba(#0f172a/.3)`) ≠ token **duc** ⇒ van "khong hop".
  **Cach dung:** rut bang cho **VUA container** (gop cot, dua cot it quan trong xuong dong phu/tooltip) ⇒
  khong con can sticky ⇒ khong con o nao lech mau, khong con o nao bi bop.
- **Khi nao gap:** \`tags: [css, table, sticky, overflow, dark-mode, light-mode, soc, layout, contrast]\`
- **QUY TAC:** "Khong dan nen cho MOT o de giu no khi cuon ngang. Hay rut noi dung cho bang **VUA
  container**: gop cot, dua thong tin it quan trong vao dong phu/tooltip, rut do rong cot. Neu van can
  cuon ngang thi nen cua o sticky phai **trung mau nen that cua container** (dung `background: inherit` +
  duong tach bang token), **khong** hardcode."
- **CHECKLIST:**
  - [ ] Bang co rong <= container khong? (do `table.getBoundingClientRect().width` vs wrapper `clientWidth`)
  - [ ] Neu phai cuon ngang: nen o sticky co **cung mau nen container** (khong hardcode) khong?
  - [ ] Moi thead/cell co bi **bop** khong (chu xuong dong trong o) — kiem bang computed style, khong doan?
  - [ ] Da **mo anh ra xem** (L-V05) o **ca 2 theme** truoc khi bao xong?
- **Proof:** \`docs/CODE_CHANGE_AUDIT_LEDGER.md\` Entry 391 + \`docs/HANDOVER_UI_REDESIGN_20261021.md\` §5; anh \`docs/evidence/ui-redesign-20261021/\`.
