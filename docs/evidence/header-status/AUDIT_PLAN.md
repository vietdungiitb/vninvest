# AUDIT PLAN — Header realtime indicator phân biệt 5 trạng thái (R1)

- **Ngày**: 2026-11-19
- **Vai trò**: auditor độc lập (subagent), **CHỈ ĐỌC** — không sửa code, không commit
- **Đối tượng**: `docs/PLAN_HEADER_REALTIME_STATUS_20261119.md` (89 dòng)
- **Nguồn liên quan**: `docs/DIAGNOSIS_OFFLINE_404_DATAOPS_20261119.md` (Entry 560)
- **Baseline**: `dev` @ `62f0d1aba` · `git status` = ledger đã modified + 2 file plan/diagnosis untracked (không có code runtime đang bị giữ)
- **VERDICT: NEED_REVISION**

---

## 0. Tóm tắt 5 finding nghiêm trọng nhất

1. **`common.online` KHÔNG TỒN TẠI** trong cả 2 locale — plan dùng làm `labelKey` nhưng SCOPE không thêm key nào vào `common.js` ⇒ AC6 không thể đạt (objection O1, blocker).
2. **`disconnected` không phải trạng thái thật** của `useRealtimeFeedCore` — plan trích dẫn sai `file:line` và gán nhãn "status thật" cho giá trị không bao giờ được set (O2).
3. **Trường hợp `useRealtimeContext()` trả `null` không được định nghĩa** — resolver mặc định gán `connecting` (vàng) và có thể gây `TypeError` nếu đọc `consumerCount` không có optional chaining (O3).
4. **Test approach khả thi nhưng plan chưa đủ chi tiết** — phải mock thêm đúng module, reset trong `beforeEach`, và assert trên **key** i18n chứ không phải chuỗi tiếng Việt/Anh vì mock `t` trả về key (O4).
5. **AC1 là assertion phủ định thuần**, vi phạm tinh thần L-V04 — cần positive assert (labelKey + class chấm) cho từng trạng thái (O5).

---

## 1. Objection (đánh số, kèm `file:line`)

### O1 — BLOCKER: `common.online` không tồn tại; AC6 tự mâu thuẫn với SCOPE

**Bằng chứng (đã tự grep/read):**
- `packages/web/src/i18n/locales/vi/common.js` — grep `online|Online|offline|Offline` → **0 hit**.
- `packages/web/src/i18n/locales/en/common.js` — cùng lệnh → **0 hit**.
- Toàn thư mục `packages/web/src/i18n` — grep `\bonline\b` → **0 hit**. Chỉ có `offline` ở `locales/vi/adminOps.js:157`, `locales/en/adminOps.js:157`, `locales/vi/watchlist.js:211`, `locales/en/watchlist.js:205`.
- `packages/web/src/i18n/index.js:12-16` `getNestedValue()` reduce `dictionary['common']['online']` → `undefined`; `:42` fallback sang `defaultValue`. Nghĩa là runtime **có thể** vẫn hiện "Online" nhờ default, nhưng key thì không hề tồn tại.
- `packages/web/src/i18n/vi.js:4,110` và `en.js:4,110` nạp namespace `common` + `layout` vào dictionary → `t('layout.realtime.idle')` **sẽ resolve đúng** sau khi thêm key vào `layout.js` (điểm này plan đúng).

**Mâu thuẫn trong plan:**
- `PLAN...:58` khai `connected: { labelKey: 'common.online', ... }`.
- `PLAN...:26` (AC6) khẳng định "Cả 4 key i18n (`idle`, `connecting`, `polling`, `disconnected`/`online`) tồn tại trong `locales/{vi,en}/layout.js`" — vừa đếm sai (thực ra 5 labelKey), vừa gán `online` vào `layout.js` trong khi code lại trỏ `common.online`.
- `PLAN...:42-43` (SCOPE) chỉ thêm **4 key `realtime.*`** vào 2 file `layout.js`; không có dòng nào thêm `online` vào `common.js`; `PLAN...:45` (LIMIT) còn cấm đụng `i18n/{vi,en}.js`.

⇒ **Không có đường nào trong SCOPE để thỏa AC6.**

**Fix bắt buộc:** đổi `PLAN...:58` thành `labelKey: 'layout.realtime.online'`; thêm key thứ 5 `online: 'Online'` / `online: 'Online'` vào object `realtime` trong **cả hai** `locales/vi/layout.js` và `locales/en/layout.js`; sửa AC6 (`PLAN...:26`) thành "**5** key `layout.realtime.{idle,connecting,polling,connected,disconnected}` tồn tại trong 2 locale". Giữ nguyên LIMIT không đụng barrel `i18n/{vi,en}.js`.

---

### O2 — MEDIUM: trích dẫn sai; `disconnected` không phải giá trị hook có thể set

**Bằng chứng:**
- `packages/web/src/hooks/useRealtimeFeedCore.js` — grep `setRealtimeStatus` (21 hit) chỉ sinh **4 giá trị**:
  - `idle`: `:464` (initial), `:556`, `:913`, `:985`, `:997`, `:1228`
  - `connecting`: `:1014`
  - `polling`: `:968`, `:1003`, `:1020`, `:1100`, `:1194`, `:1238`
  - `live`: `:1044`, `:1134`, `:1151`, `:1163`, `:1168`, `:1172`, `:1175`, `:1178`
- grep `'disconnected'` trong chính file đó → **0 hit**; grep `realtimeStatus.*disconnected` toàn `packages/web/src` → **0 hit**.
- `PLAN...:14` viết "Các status thật: `idle`, `connecting`, `polling`, `live`, `disconnected`" và dẫn `useRealtimeFeedCore.js:554-563,1014,1020,1194,1238`. Các dòng được dẫn chỉ sinh `idle` (`:556`), `connecting` (`:1014`), `polling` (`:1020,:1194`) — **không có dòng nào sinh `disconnected`** ⇒ sai `file:line` (vi phạm L-V01/L-T02, `docs/LESSONS/verification.md:20-33`).

**Tác động:** AC5 (`PLAN...:25`) là nhánh phòng thủ chỉ có thể đi qua mock; không có đường production nào phát `realtimeStatus='disconnected'`. Mapping ở `PLAN...:69` vẫn đúng về mặt code, nhưng plan phải nói thật.

**Fix:** sửa `PLAN...:14` thành "4 giá trị thật `idle|connecting|polling|live`; `disconnected` là nhánh phòng thủ (chỉ test mock sinh ra)"; ghi rõ AC5 = defensive-only. Giữ mapping `:69` và AC5.

---

### O3 — MEDIUM: null context chưa được xử lý; nguy cơ throw ở 7 test cũ

**Bằng chứng:**
- `packages/web/src/context/RealtimeContext.js:5` `createContext(null)`; `:8-10` `useRealtimeContext()` trả `null` khi không có Provider.
- `packages/web/src/main.tsx:6,298` có mount `RealtimeProvider` ⇒ production không null.
- **Nhưng** `Header.component.test.tsx:86-95` mount `Header` trong `MemoryRouter` **không có Provider** ⇒ hôm nay context đang là `null`. `Header.tsx:91` dùng `realtimeCtx?.feed?.realtimeStatus || ''` nên không nổ; `consumerCount` nếu đọc kiểu `realtimeCtx.feed.metrics.manager.consumerCount` sẽ **nổ TypeError ngay render** và làm 7 test cũ đỏ.
- Với resolver `PLAN...:66-70`: context null ⇒ `consumerCount === 0` sai, `status === 'idle'` sai ⇒ rơi `default → connecting` ⇒ hiện "Đang kết nối" (vàng) cho trang **không có provider** — sai nghĩa, đúng cái plan đang muốn sửa (phải neutral/idle).

**Fix:** thêm **AC0** vào `PLAN...§2`: "Given `useRealtimeContext()` trả `null`/`undefined`; Then nhãn = idle, chấm xám"; resolver `PLAN...:66` thành `if (!realtimeCtx) → idle`; đọc `consumerCount` bằng `realtimeCtx?.feed?.metrics?.manager?.consumerCount ?? 0`.

---

### O4 — MEDIUM: test approach khả thi nhưng plan chưa đủ để implement không hỏi lại

**Khả thi (đã verify):**
- `packages/web/vitest.config.ts:19` alias `"@" → src` (trùng `vite.config.ts:17`); khớp **chính xác** import `Header.tsx:14` `@/context/RealtimeContext.js` ⇒ `vi.mock("@/context/RealtimeContext.js", ...)` resolve đúng. Không có rủi ro path alias.
- Không cần mock thêm module nào khác: 4 mock hiện tại (`Header.component.test.tsx:38-43`) đã phủ `PortfolioContext`, `LangContext`, `useCoreQuery`, `coreApiAdapter`.

**Cần bổ sung vào plan:**
- `PLAN...:44` chỉ ghi "mock `useRealtimeContext`, 5 case" — phải nói rõ: thêm `useRealtimeContext: vi.fn()` vào `h = vi.hoisted(...)` (`:30-36`), thêm dòng `vi.mock` (`:38-43`), `mockReset()` trong `beforeEach` (`:102-108`), và sửa comment `MOCKS REQUIRED` (`:23-29`) từ "4 of the 9 imports" → 5.
- **Bẫy lớn nhất:** mock `useI18n` ở `:115-119` là `t: (key) => key` ⇒ assert phải là `screen.getByText('layout.realtime.idle')`, **KHÔNG PHẢI** "Chưa theo dõi"/"Not monitoring"/"Online" như AC1–AC4 (`PLAN...:21-24`). Nếu viết assert theo chuỗi dịch thì 5 test mới sẽ đỏ giả.
- Default mock nên trả `null` để giữ nguyên hành vi 7 test cũ (đang mount không Provider).

---

### O5 — LOW: AC1 là assertion phủ định thuần (L-V04)

- `PLAN...:21` AC1 chỉ yêu cầu "**không** có chuỗi Offline". `docs/LESSONS/verification.md:73-86` (L-V04) cảnh báo assert dạng "không xảy ra" xanh rỗng khi endpoint/fixture hỏng.
- Plan đã có assert màu ở AC2–AC5 (`PLAN...:22-25`) — tốt — nhưng chưa yêu cầu assert **class chấm** cụ thể (`bg-slate-500` / `bg-amber-400` / `bg-emerald-400 live-dot-pulse` / `bg-rose-400`) và **labelKey** cho từng case, kể cả idle.
- Fix: mỗi case assert 2 giá trị dương tính: `getByText(<key>)` + `querySelector('.bg-...')` tồn tại; giữ assert "không có Offline" như lớp bổ sung.

---

### O6 — LOW: hai chi tiết gate chưa có đối chứng

- `PLAN...:82` "git diff --numstat khớp dự kiến" nhưng không ghi con số dự kiến ⇒ không phải gate kiểm chứng được (L-V01). Cần ghi rõ "4 file, ví dụ `12 8 Header.tsx` …" hoặc tối thiểu "4 file, 0 file ngoài SCOPE".
- `PLAN...:26` đếm "4 key" trong khi `PLAN...:54-60` có **5 labelKey** (`idle`, `connecting`, `polling`, `common.online`, `disconnected`) — đã gộp vào O1.

---

## 2. Đáp án 6 câu hỏi kiểm tra

| # | Câu hỏi | Kết quả |
|---|---|---|
| 1 | Mapping 5 trạng thái có khớp mọi giá trị `realtimeStatus`? | **Có, nhưng kèm sai sự thật.** 4 giá trị thật `idle/connecting/polling/live` đều được map (`PLAN...:66-70`); `'connected'` là alias phòng thủ đúng (`Header.tsx:93` cũng check). `disconnected` **không bao giờ được set** — xem O2. |
| 2 | `consumerCount` có đáng tin? Null context thì sao? | Đáng tin: `RealtimeContext.js:87` = `Object.keys(subscriptions).length`, gán vào `:101` `feed.metrics.manager.consumerCount`, spread qua `:96-104`. Trang SOC không consumer ⇒ 0 đúng. Null context ⇒ `undefined`, dẫn tới nhãn `connecting` sai + rủi ro throw — xem O3. |
| 3 | `common.online` có trong cả 2 locale? | **KHÔNG.** 0 hit ở cả 2 `common.js` và toàn `src/i18n`. Phải đổi sang `layout.realtime.online` + thêm key — xem O1. |
| 4 | Test approach khả thi? Cần mock gì? Rủi ro alias? | **Khả thi.** Alias `@` đúng (`vitest.config.ts:19`), chỉ cần thêm 1 mock `useRealtimeContext` + reset. Không rủi ro alias. Rủi ro thực nằm ở mock `t => key` (O4). |
| 5 | Vi phạm quy tắc repo? | Không đụng deny-list (`AGENTS.md`/`package.json`/`package-lock`/`docker-compose*`/`.env*`), không migration, không `package.json`, không dùng `soc.module.css`. Đúng LIMIT tránh barrel i18n nóng. Đúng L-F10 (hằng số cấp module `PLAN...:51-61`). Ghi **CHƯA CHẠY** cho staging/Playwright (`PLAN...:83`) — đúng. Còn: trích dẫn `file:line` sai (O2), assert phủ định (O5), thiếu đối chứng numstat (O6). |
| 6 | Finding nào làm plan chưa implementable? | **O1** (blocker: AC6 không thỏa được trong SCOPE). **O2/O3/O4** phải sửa trước khi code để tránh evidence sai + test đỏ giả. O5/O6 là khuyến nghị. |

---

## 3. Những gì plan làm ĐÚNG (giữ lại khi sửa)

- `PLAN...:11-13,15` đối chiếu `Header.tsx:90-94,331,334` và `RealtimeContext.js:45-50,91-105` — **khớp code thật** (tôi tự mở lại).
- `PLAN...:21-25` phân biệt đúng 5 nhãn/màu; riêng `connected` giữ nguyên `live-dot-pulse` như `Header.tsx:331`.
- `PLAN...:32` baseline gate **đã chạy lại bởi auditor**: `node packages/web/scripts/check-multi-agent.mjs` → `0 lỗi, 0 trùng số migration — PASS`, 206 cảnh báo stale (khớp plan); exit 0.
- `PLAN...:36` claim check **đã verify lại bằng node parse** (`split('|').map(trim)`, cột status): 13 claim `in-progress`, **0** claim giữ `Header.tsx` / `locales/{vi,en}/layout.js` / `Header.component.test.tsx`.
- `PLAN...:45` dùng `locales/*/layout.js` thay vì barrel `i18n/{vi,en}.js` — đúng thực tế barrel (`vi.js:7,110`, `en.js:7,110`) vẫn nạp namespace `layout` nên `t('layout.realtime.*')` resolve được.
- `PLAN...:77` fail-before (test đỏ trước) + `:83` ghi rõ CHƯA CHẠY — đúng quy tắc "không báo PASS giả".

---

## 4. Điều kiện đổi verdict sang AGREE / PASS

| Việc cần làm | Ai đóng | Bước |
|---|---|---|
| Sửa O1: `layout.realtime.online` + thêm 5 key vào 2 file layout locale + đổi AC6 | **Tác giả plan / coordinator** | `PLAN...:26,42-43,58` |
| Sửa O2: đính chính "status thật" + citation đúng; AC5 = defensive-only | Tác giả plan | `PLAN...:14,25` |
| Sửa O3: thêm AC0 null-context + optional chaining `consumerCount` | Tác giả plan | `PLAN...:21,66` |
| Sửa O4: mô tả đủ mock + assert trên key | Tác giả plan | `PLAN...:44` |
| Sửa O5/O6 (khuyến nghị) | Tác giả plan | `PLAN...:21,82` |
| Re-audit sau khi plan sửa | Auditor độc lập | B8 → `docs/evidence/header-status/REAUDIT.md` |

**Auditor KHÔNG chạy** `tsc` / `vitest` / `eslint` / `i18n-scan-strict` — nằm ngoài phạm vi audit chỉ đọc; các con số đó trong plan vẫn là **baseline claim của tác giả plan**, chưa được auditor tự chứng minh (ghi `CHƯA CHẠY` ở phần này).

**Kết luận:** plan đúng về chẩn đoán gốc và khung mapping, nhưng **chưa implementable vì O1** và có 3 objection phải sửa trước dòng code đầu tiên. ⇒ **NEED_REVISION**.
