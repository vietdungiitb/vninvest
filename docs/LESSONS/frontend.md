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