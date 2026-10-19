# SUMMARY — `ai-cc-uiux`: nâng cấp UI/UX `/settings/ai` (AI Command Center)

> **Báo cáo bàn giao cho coordinator / Owner.** Theo yêu cầu của `multi-agent-workflow` §Reporting:
> commit · file · **gate chạy thật kèm output** · gate `CHƯA CHẠY` kèm lý do · việc quan sát
> nhưng không sửa · bài học quy trình.
>
> **Owner** là người yêu cầu: *"làm theo khuyến nghị để ui/ux thật sự chuyên nghiệp"*.

| | |
|---|---|
| **Branch** | `feat/ai-cc-uiux` → `dev` |
| **Baseline đo** | `dev` @ `295dc15d8`, tree sạch |
| **Plan** | `docs/PLAN_AI_CC_UIUX_20261018.md` (v3) · audit plan: `docs/PLAN_AUDIT_AI_CC_UIUX_20261018.md` |
| **Ledger** | `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 383` |
| **Claim** | `docs/CLAIMS.md` — dòng 1608 (plan) + dòng bổ sung (code, 6 slice) |
| **Ngày** | 2026-10-18 (plan/audit) → 2026-10-19 (Owner chốt + code) |
| **Lessons áp dụng** | L-001, L-002, L-007, L-008, L-M02, L-A01, L-F03, L-F06, L-G02, L-G04, L-G05, L-G07, L-V01, L-V02, L-V04, L-T01, L-T02 |

---

## 1. Gốc vấn đề — chủ đích của Owner

> *"Việc lẫn lộn cài đặt tài khoản và cấu hình trung tâm AI đã hết sức thiếu chuyên nghiệp."*

Audit tìm ra **3 nguyên nhân gốc**, tất cả đều xác minh bằng mã chứ không phải cảm nhận thẩm mỹ:

| # | Nguyên nhân gốc | Bằng chứng trước khi sửa |
|---|---|---|
| **F1** | **Hai thanh tab chồng nhau, giống hệt, trùng nhãn.** Lúc vừa vào trang, **cả hai ô "Tổng quan" cùng sáng**. | `AICommandCenterPage.tsx:227` (`AiHubNav`, 5 tab route) + `:229-245` (`<nav>` anchor, 3 mục) dùng **cùng** class `aiSettings.module.css:132/145/169` + **cùng** `aria-label`. `AiHubNav.tsx:79` set active **và** `:233` set active. |
| **F2** | **Tùy chọn CÁ NHÂN nằm trong panel CHÍNH SÁCH HỆ THỐNG.** | `eventGate` đọc/ghi qua `getUserConfig()`/`updateUserConfig()` (`:119-134`, `:175`) — **endpoint và kho lưu khác hẳn** AI CC config — nhưng nằm trong panel `operationPolicy`. |
| **F3** | **2 số hiện hai nơi (1 chỉ đọc + 1 sửa được, khác tên); 1 số không sửa được ở đâu cả.** | `advisory_refresh_interval_hours` / `advisory_max_tokens_per_day` hiện ở panel **và** sửa ở form. `advisory_max_auto_refreshes_per_day` hiện ở panel mà **không có `<input>` nào** (quét đệ quy 581 file: 10 hit, 4 file production, **0 file tạo input**). |

Thêm 7 backlog đã đo (B1–B7): enum thô `gemini`/`command_center` lộ ra UI · 4 tên gọi khác nhau cho một trang · eyebrow "Cài đặt" trùng breadcrumb "Cài đặt tài khoản" · `SUB_AGENT_PROMPT_FIELDS` khai sai chỗ · 15 nhãn VI không dấu · token không resolve · lỗi lint chặn cả file.

---

## 2. Commit

| # | Slice | SHA | Nội dung |
|---|---|---|---|
| S0 | lint | `0e18545f8` | `SUB_AGENT_PROMPT_FIELDS` lên cấp module ⇒ **hết 1 error duy nhất** của `npm run lint` |
| S1 | điều hương | `240627970` | Xoá nav anchor thứ 2 ⇒ 1 hệ điều hướng duy nhất |
| S2 | tách lớp cấu hình | `1cc9e6a92` | `eventGate` → panel "Tuỳ chọn cá nhân"; bỏ 2 số trùng; badge "Chỉ đọc" |
| S3 | nhãn | `416dcdf29` | Enum → nhãn dịch (`provider.*` / `source.*` **lồng**); 15 nhãn VI có dấu |
| S4 | danh tính trang | `c36ac4e0b` | Breadcrumb/sidebar/link cùng tên ngắn; bỏ eyebrow |
| S5 | cơ chế chặn | `ef458813a` | Gate `AC10` + self-test paraphrase |
| fix | audit code | `3cd9ff2e2` | AC10 quét **cây render** (import graph) + bắt cả trùng class; self-test **17/17** |
| fix | audit code | `5ffc48de5` | `provider.unknown` fallback; lưới `metricGridAuto` co theo nội dung; badge `metricBadge` |

**File đã sửa** (8 nguồn + 4 test mới): `AICommandCenterPage.tsx` · `AICommandCenterForm.tsx` · `AiHubNav.tsx` (đọc) · `aiSettings.module.css` · `providerModels.ts` · `Breadcrumb.tsx` · `UserSettingsPage.tsx` · `check-ai-cc.mjs` · `i18n/vi.js` + `en.js` · 4 test mới dưới `src/**/__tests__/ai-cc-*.component.test.tsx` · sửa 2 test cũ.

---

## 3. Gate — chạy thật, tại HEAD sau cùng

| # | Gate | Lệnh (từ `packages/web/`) | Baseline `dev` | **Sau** | Kết luận |
|---|---|---|---|---|---|
| G1 | Type-check | `npx tsc --noEmit` | 0 | **0** | PASS |
| G2 | Lint | `npm run lint` | **1** (1 error) | **0** (0 error, 4157 warn) | **PASS — cải thiện** |
| G3 | Tokens | `npm run check:tokens` | **1** | **1** | **ĐỎ (có sẵn)** — `brokerData.css`, **ngoài SCOPE**, 0 hit mới trong file của ta |
| G4 | Contrast | `npm run check:contrast` | 0 | **0** | PASS — nhưng **không phủi trang này** (chỉ 7 tone pair admin) |
| G5 | i18n strict | `npm run i18n:scan:strict` | 0 | **0** | PASS |
| G6 | AI CC gate | `node ./scripts/check-ai-cc.mjs` | 0 (10 rule) | **0** (11 rule) | PASS |
| G6b | AI CC self-test | `node ./scripts/check-ai-cc.mjs --self-test` | — | **0 — 17/17** | PASS |
| G7 | UI/UX budget | `node ./scripts/check-uiux-budget.mjs` | **1** | **1** | **ĐỎ (có sẵn)** — CSS-1 **4** · CSS-2 **55** · I18N-1 **1** · A11Y-9 **8** · NAV-1 **37** — **y hệt baseline ⇒ không hồi quy** |
| G8 | Test component | `npm run test:components` | 0 (164 file / 1122 test) | **0 (167 file / 1134 test)** | PASS — **+3 file, +12 test, 0 fail, không mất test nào** |
| G9 | Build | `npm run build` | — | **0** | PASS |

**AC bên trong plan, chạy riêng:**

| AC | Lệnh | Kết quả |
|---|---|---|
| AC3.1 | đếm dòng chứa `labelKey` trong `providerModels.ts` | **15** (ngưỡng ≥ 11) ✅ |
| AC4.3 | quét đệ quy `aiCommandCenter.eyebrow` | `PASS: 0 hit` ✅ |
| AC5.3 | `node ./scripts/check-ai-cc.mjs` | exit 0, có mã rule mới ✅ |

### `CHƯA CHẠY` — không có môi trường, KHÔNG suy ra

| Hạng mục | Vì sao chưa chạy |
|---|---|
| **Ảnh chụp thật trên staging** | Chưa deploy. Đây là bằng chứng mà Owner **thật sự nhìn thấy** — nên xem mục 5. |
| **E2E Playwright** `tests/visual/ai-hub-nav-r51.spec.ts` | Cần staging đã deploy bản này |
| **Contrast thật của `/settings/ai`** | `check:contrast` chỉ đo 7 tone pair admin; không có script nào đo hover/surface của trang này |
| **Viewport hẹp / mobile** | `aiSettings.module.css` **không có** `@media max-width` nào (đo: chỉ 3 `min-width`); không có thiết bị đo |
| **Focus ring của `AiHubNav`** | Là vấn đề a11y, `improve-ui` §3 loại khỏi phạm vi trừ khi Owner yêu cầu |
| **BE test** | Cần Postgres; 8 commit này **không đụng backend** |
| **AC3.5 — lệnh tái tạo trong plan** | ⚠ **LỆNH TRONG PLAN HỎNG.** Regex dựng `key + TAB + "value"` trong khi `vi.js` viết `key: 'value'` ⇒ lệnh in `FAIL 15/15` **và không bao giờ có thể xanh**. *Nội dung* (15 nhãn đã có dấu) là **đúng** và đã được đo bằng cách khác. → Đính chính plan. |

---

## 4. Bằng chứng fail-before (không phải "tin tôi")

Mỗi slice có **test đỏ trước, xanh sau**, dùng quy trình byte-exact (`cmd /c "git show … > f"` + assert kích thước):

| Slice | Fail-before đo được |
|---|---|
| S1 | `so <nav> mang aria-label ... = 2, phai = 1` và **`so muc dang to sang = 2`** với đúng 2 ô: `Tổng quan -> /settings/ai` + `Tổng quan -> /settings/ai#overview` — **chính là triệu chứng trong ảnh Owner gửi** |
| S2 | 4/4 case đỏ; 3 case đúng lý do. **Case AC2.2 đỏ vì lý do khác và đó là lỗi thật**: checkbox không có accessible name (nhãn nằm ở `<p>` anh em, `<label>` chỉ chứa trạng thái "Bật"/"Tắt") |
| S3 | 2 case đỏ trên bản tiền-sửa (`trang van in chuoi enum command_center`) |
| S5 | Gate FAIL trên bản tiền-S1 (`aiCommandCenter.title x2`), PASS sau khi sửa |

---

## 5. Đánh giá lợi ích cho Owner

**Khoảng 85% vấn đề "lẫn lộn" đã hết.** Ba nguyên nhân gốc F1–F3 đóng 100%. Đã đo lại:

1. **Hai thanh tab trùng** — hết. Còn đúng **1** hệ điều hướng (`AiHubNav`, 5 tab route). Cơ chế "2 ô Tổng quan cùng sáng" không còn.
2. **Tùy chọn cá nhân lẫn trong panel hệ thống** — hết. Giờ là panel riêng "Tuỳ chọn cá nhân" có câu giải thích *"Thiết lập riêng cho tài khoản của bạn, không ảnh hưởng cấu hình chung của hệ thống"*, và checkbox có accessible name thật.
3. **Số trùng / số không sửa được** — hết. 2 số trùng đã bỏ; số còn lại gắn badge "Chỉ đọc" dạng **chip** (trước dùng chung class với nhãn nên đọc ra như nhãn thứ hai).
4. **Enum thô** — hết cả 2 vế. `gemini` → "Google Gemini", `command_center` → "Cấu hình trung tâm AI", kể cả `effectiveSourceDesc` vốn **tự viết ra chuỗi enum** trong bản dịch.
5. **4 tên cho 1 trang** — hết về *hiển thị*: sidebar + breadcrumb + link `/settings` đều ra "Trung tâm AI"; H1 giữ "Trung tâm điều hành AI" (theo Q2).
6. **Eyebrow trùng khái niệm** — hết, 0 hit toàn repo.

**Còn sót, CHƯA xử lý** (ghi ở mục 6): phân cấp tiêu đề phẳng (8 `h2` ngang hàng cho 3 nhóm ý nghĩa) · tiêu đề `CẤU HÌNH AI RUNTIME` in hoa giữa 7 panel sentence-case · 2 nguồn sự thật cho tên trang (`layout.nav.*` vs `routes.*`).

---

## 6. Việc quan sát được nhưng **KHÔNG sửa** (ngoài phạm vi — không tự mở rộng)

| ID | Vấn đề | Vì sao không sửa |
|---|---|---|
| **N1** | `/settings/ai` **không** bọc `StaffRoute` (`main.tsx:195`) trong khi `/settings/ai/audit` **có** (`:204`) | Vấn đề **quyền truy cập**, không phải UI/UX. `improve-ui` §3 loại. **Cần ticket riêng — đây là điểm an toàn nên Owner biết.** |
| **N2** | 3 hệ token cùng sống: `--ai-*` toàn cục / `--soc-*` / `--pf-*`; `aiSettings.module.css` **không** dùng chung class nào với SOC | Nợ kiến trúc toàn hệ thống |
| **N3** | 7 class mồ côi trong `aiSettings.module.css` (`.hubBackLink` `.panelActions` `.textarea` `.alertInfo` `.statusSuccess` `.statusDefault` + **`.pageEyebrow`** mới sinh từ S4) | Việc cosmetic riêng |
| **N4** | Không có focus ring cho `.hubNavLink` / `.checkbox` / `.range` (nay `AiHubNav` là hệ điều hướng **duy nhất** ⇒ hậu quả a11y lớn hơn trước) | A11y, ngoài phạm vi |
| **N5** | 4 khoá i18n chết sinh từ S1/S2 (`tabRuntime`, `refreshInterval`, `refreshIntervalValue`, `tokensPerDay`) | Không gây lỗi; xoá khoá chết bằng script **rủi ro** (xem bài học dưới) |
| **N6** | `WatchlistPage.css:407` dùng `var(--accent-cyan-soft)` **không fallback** và token này không được định nghĩa ở đâu | Ngoài SCOPE |

---

## 7. Bài học quy trình (Stage 8) — đều đã có bằng chứng, không kể chuyện

1. **`git show HEAD:<f> > <f>` HỎNG FILE trên PowerShell 5.1.** Đo: blob gốc `AICommandCenterPage.tsx` = **20 984 byte**, lệnh ghi ra **42 864 byte**, 2 byte đầu `255,254` (UTF-16LE BOM). Mẫu chống `git checkout --` trong `agent-lessons` §11 **chỉ đúng với bash**. Dùng `cmd /c "git show … > f"` + assert kích thước trước/sau.
2. **`grep` có trong tài liệu nhưng không có trên máy thực thi** (`Get-Command grep` ⇒ `$null`). Mọi AC viết lệnh phải **chạy thử 1 lần** trước khi đưa vào plan.
3. **Script khớp i18n theo TÊN NGẮN sẽ xoá nhầm.** Tôi đã tự tạo lỗi này: xoá `aiCommandCenter.eyebrow` bằng cách khớp `eyebrow:` đã xoá nhầm `brokerSystem.eyebrow` ở `vi.js:1081`. Phục hồi được vì diff lúc đó chỉ có 4 dòng. **Sửa đúng**: duyệt theo **đường dẫn đầy đủ + assert giá trị** trước khi xoá. Bẫy còn nằm trong repo: `aiCommandCenter` có **3** khoá tiền tố `refreshInterval` (`:5408` chết · `:5519` `refreshIntervalLabel` **còn sống**) ⇒ script khớp tên ngắn sẽ làm hỏng form.
4. **AC rỗng là loại lỗi phổ biến nhất và không báo lỗi.** Ba lần trong phiên này: `AC1.2` đếm `aria-current` (nav thứ 2 **không** hề set `aria-current` ⇒ xanh trước *và* sau); `AC1.3` quét 3 class mà cả 3 còn consumer; `AC3.1` ngưỡng `≥ 6` bằng đúng baseline 6. **Nguyên tắc**: AC phải đỏ trên bản tiền-sửa, nếu không thì nó không kiểm chứng gì.
5. **Script tự viết phải có control trước khi tin.** `aiHubFiles` quét đệ quy báo trùng `.auditPager` **giả** (đó là nav phân trang ở hai ROUTE khác nhau) — sửa bằng cách thu phạm vi theo **đồ thị import** thật (BFS import tương đối từ trang hub) thay vì "mọi file có nhắc namespace".
6. **Quét bằng wildcard PowerShell bỏ sót file.** `src\**\*.tsx` cho ra 3 hit thật là 10 hit (thiếu `WhaleAdvisoryPage.tsx`, 6 file test). Phải dùng script Node đệ quy.
7. **Test đỏ sau khi đổi code không phải chắc test sai.** `updates policy display after save` neo vào ô đã bị xoá có chủ đích — sửa bằng cách **re-target vào observable còn sống** (`data-testid="auto-refresh-value"`) để giữ nguyên ý nghĩa test, không xoá và không nới.
8. **Câu hỏi nghiệm vụ phải hỏi Owner, không tự bịa.** 4 quyết định Q1–Q4 (xoá hẳn nav anchor · tên ngắn cho vị trí hẹp / dài cho H1 · bỏ eyebrow · gắn "Chỉ đọc") là **ý đồ sản phẩm**; `improve-ui` §3.3 cấm agent tự quyết.
9. **Bug khoá i18n phẳng có dấu chấm.** `getNestedValue` (`i18n/index.js:12-16`) tách key theo `.` rồi đi từng cấp ⇒ khai `"aiCommandCenter.provider.gemini": "…"` dạng phẳng sẽ **không resolve** và UI in ra **chính chuỗi khoá** — đúng bug S3 sinh ra để diệt. Phải khai **object lồng**.

---

## 8. Rollback

Mỗi slice là **1 commit riêng**, tách được:

```bash
git revert 5ffc48de5  # fix audit code
git revert 3cd9ff2e2  # AC10 import-graph
git revert ef458813a  # S5 gate
git revert c36ac4e0b  # S4 danh tính trang
git revert 416dcdf29  # S3 nhãn enum
git revert 1cc9e6a92  # S2 tách lớp cấu hình
git revert 240627970  # S1 điều hương
git revert 0e18545f8  # S0 lint
```

Lưu ý: revert **ngược thứ tự** (S5 → S0) vì S4/S3/S2 đều chạm `i18n/{vi,en}.js` và `AICommandCenterPage.tsx`.
