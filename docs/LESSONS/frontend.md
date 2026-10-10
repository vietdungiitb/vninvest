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

## L-F09: 2 `setSearchParams` trong MOT tick KHONG compose - setter phai ghi TOAN BO state

- **Nguyên nhân:** `setSearchParams(fn)` nhận updater đọc `prev`. Gọi **hai** lần
  trong cùng một tick thì lần hai đọc `prev` **cũ** và ghi đè kết quả lần một.
- **Hậu quả thật:** Đo 2026-10-10 trên `react-router-dom@6.30.3`: `setParams(a=1)`
  rồi `setParams(b=2)` ⇒ kết quả `?b=2`, `a` **mất sạch**. Handler gọi 3 setter
  liên tiếp (`setLane` + `resetStatsPage` + `setSessionDate`) ⇒ **2/3 thay đổi
  biến mất**, filter nhảy về mặc định mà không có lỗi nào hiện ra.
- **Khi nào gặp:** `tags: [react, hook, url, searchParams, router, filter, useCallback]`
- **QUY TẮC:** Khi một handler gọi **nhiều** setter cùng lúc, mỗi setter phải ghi
  **TOÀN BỘ** trạng thái (optimistic `ref` cập nhật ngay trong setter), để lần gọi
  sau mang theo thay đổi của lần trước. **Đo lại bằng probe** thay vì tin comment.
- **CHECKLIST:**
  - [ ] Handler nào gọi >1 setter URL trong 1 tick không? Đã gộp thành 1 patch chưa?
  - [ ] Ràng buộc "không compose" đã **tự probe** trên đúng version `react-router-dom` chưa?
  - [ ] `replaceKeys` còn tác dụng khi patch ghi full-state không? (nếu không → cần override)
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 264` §2 - probe in ra `"b=2"`.

## L-F10: Truyen OBJECT LITERAL cho option cua hook → memo vo hinh → vong lap render vo han

- **Nguyên nhân:** Truyền option/constant dạng object literal **ngay trong lời gọi
  hook**. Identity đổi mỗi render ⇒ `useCallback`/`useMemo` phụ thuộc nó **không
  bao giờ ổn định** ⇒ object/mảng mới mỗi render ⇒ effect có dep là mảng đó chạy
  vô hạn.
- **Hậu quả thật:** Truyền `keyMap` literal cho `useUrlState` ⇒ `severityFilter`
  là **mảng mới** mỗi render ⇒ effect `[filters.severityFilter]` chạy vô hạn ⇒
  **test suite treo >600s**, không có lỗi nào in ra để đoán.
- **Khi nào gặp:** `tags: [react, hook, memo, identity, literal, options, infinite]`
- **QUY TẮC:** `spec` / `defaults` / `options` / `keyMap` của hook: **khai ở CẤP
  MODULE**, kèm comment giải thích. Không bao giờ tạo object mới trong render.
- **CHECKLIST:**
  - [ ] Mọi object/array truyền vào `useMemo`/`useCallback`/`useUrlState` đã ở
        cấp module, hoặc đã `useMemo` hoá chứ?
  - [ ] Effect có dep là **mảng/đối tượng** không? Array đó có identity ổn định không?
  - [ ] Test có **timeout** không, để treo nhìn ra là treo chứ không phải chậm?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 264` §3 - lần chạy đầu
  timeout 600s; sau khi đưa `keyMap` lên cấp module còn **15s**.
