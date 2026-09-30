# Audit — PLAN_ENVELOPE_MIGRATION

verdict: **NEED_REVISION**

Nguồn: `docs/evidence/api02/PLAN_ENVELOPE_MIGRATION.md` (137 dòng, DRAFT) ·
đối chiếu tại `3ebe9424` (HEAD = `3ebe9424`, `git status` sạch ngoài 2 file untracked).
Phương pháp: đọc code thật + **chạy lại script gốc của survey-a** (`%TEMP%\opencode\api02a_scan2.py`, `api02a_pag2.py`) trên cây hiện tại. Không sửa file nguồn, không sinh migration, không cài gì.

---

## Tóm tắt 5 dòng

1. **Tiền đề trung tâm về FE — sai.** Kế hoạch gọi `transport.js:459/490/512/535` + `coreAdapter.js:69` là "5 điểm unwrap". Cả 5 dòng đều là **`return response.json();`** trên fetch `Response` — **không có logic unwrap nào**. Mặt định `res?.data ?? res` thật sự nằm ở **34 chỗ / 23 file production FE**, không phải 5.
2. **Non-goal `/api/*` bị đảo ngược.** `urls.py:62,63,66,68` mount `service_ops`/`identity_access`/`commercial`/`advertising` **dưới `/api/`** — tức **290/583 call site (223 trong số F8+F9 phẳng)** nằm trong `/api/*` và **trong repo**. Chỉ `urls.py:70` catch-all mới ra ngoài repo. B5 không thể vừa bọc 426 site vừa tôn trọng non-goal §2.
3. **591 không phải output của script mà kế hoạch dẫn.** Chạy đúng script được dẫn ở `survey-a` Phụ lục A cho **583**. Chênh 8 được giải thích trọn vẹn bằng các hàng/cơ chế mà script **không sinh ra** (F3 = 12 vì `success_response()` không phải `Response()`; F4b vì `family()` không có nhánh F4b). ⇒ **Gate B1 ("khớp tổng call site ở survey-a") không thể đạt** như đang viết.
4. **Rủi ro tiền thật bị bỏ sót, nặng hơn rủi ro kế hoạch liệt kê.** 6 chỗ server **gọi chính view của nó** bằng `as_view()()` rồi đọc `Response.data` (`stock_mgmt_native_views.py:2635→2639`, `:2764→2768/2776-2778`, `:2913`). Bọc `AdvisoryRefreshView` ⇒ `advisory_id = None` ⇒ rơi về `_latest_ai_record` ⇒ **trả khuyến nghị AI của phiên cũ**. Đây đúng loại P0 "hiển thị khuyến nghị mua/bán cũ" mà `AGENTS.md` Entry 231 ghi là đã từng phải sửa — và nó **không** nằm trong bảng rủi ro §5.
5. **B4 đặt sai phía.** OpenAPI sinh **từ serializer**, mà 282/591 site là dict dựng tay, **không có serializer** (201 `APIView` trần vs 5 generic view có `serializer_class`). Schema sinh ở B4 (trước B5) sẽ mô tả contract cũ rồi bị vô hiệu ngay lần kế tiếp, đồng thời không phủ được phần lớn bề mặt mà nó lẽ ra phải canh.

---

## Kết quả 6 câu hỏi (1..6)

### 1. Phản bác tiền đề: "bọc envelope không được sinh migration"

**Kết luận: tiền đề ĐÚNG, nhưng kế hoạch dùng nó sai chỗ — và nó không phải rào cản thật.**

| Kiểm chứng | Kết quả | Lệnh / file:line |
|---|---|---|
| Có view ghi DB **trong lúc serialize**? | **KHÔNG** | Chỉ 2 `to_representation` trong production, cả hai là transform thuần: `advisory/serializers.py:382-388` (sanitize `before_json`/`after_json`), `identity_access/serializers.py:160-168` (derive `id`/`environment`/`policy_ids`). Không `.save()`/`.create()`/`.update()` nào trong thân serialize. |
| Có template nào đọc `response.data` của DRF? | **KHÔNG — và không thể có** | `settings.py:326-328` `DEFAULT_RENDERER_CLASSES = ['rest_framework.renderers.JSONRenderer']` — không có `BrowsableAPIRenderer` ⇒ không có template HTML DRF nào được render. Thư mục template của dự án chỉ có 6 file email/report: `identity_access/templates/{emails,reports}/*.html`. Không file nào chứa `.data`. |
| Migration có bị sinh? | **KHÔNG** | Bọc dict không đụng model ⇒ `makemigrations --check` = 0. Tiền đề của kế hoạch **giữ nguyên**. |

**Nhưng tiền đề này không phải rào cản, nên kế hoạch đặt nó ở Gate B5 là lãng phí sự chú ý.** Rào cản thật nằm chỗ khác và kế hoạch không nêu:

- **6 chỗ gọi chính view trong process** (bên dưới, câu 3) — mỗi chỗ là một **hard internal contract** trên `Response.data`.
- **2 chỗ mutate `Response.data` sau khi dựng** — `market_data/views.py:117-118` (`response.data['symbol'] = symbol`) và `service_ops/views.py/scheduler.py:268-269` (`response.data['job_key'] = job_key`). Bọc ⇒ ghi sai tầng, **không** ném lỗi.
- `settings.py:88` đã bật `drf-spectacular`; `urls.py:43-44` đã có `/core/v1/schema/`. B4 "chưa từng chạy" là **CHƯA XÁC MINH** trung thực — nhưng nó cũng là bằng chứng B4 không phải blocker.

### 2. Mâu thuẫn plan vs code: họ nào bọc là **sai nghĩa**

| # | Kế hoạch nói | Code nói | file:line |
|---|---|---|---|
| **M1** | §2: "**KHÔNG** đổi schema response của `/api/*` (legacy proxy) — nằm ngoài repo" | `/api/*` **được serve bởi view trong repo**. `urls.py:62` `commercial.public_urls` · `:63` `advertising.api_urls` · `:66` `api/soc/` → `service_ops.urls` · `:68` `identity_access.api_urls`. Chỉ `:70` `path('api/<path:remaining>', legacy_proxy_view)` mới ra ngoài. **Đo: 290/583 site 2xx (49,7%) thuộc app mount dưới `/api/`; 223 site F8+F9 phẳng nằm trong đó.** | `vninvest_core/urls.py:62,63,66,68,70` |
| **M2** | §3 hàng F6: bọc `{data:{results,next,previous}, meta:{}}` | `market_serving` **đã** dùng đúng mẫu flat + `meta` top-level **và đã version hoá**: `{results, server_time, filters, next_cursor, has_more, meta{contract_version:'2.0', source_mix, market_top_tier, pagination}}`. Bọc sẽ tạo **`meta` lồng trong `data` *và* `meta` ngoài** — trùng tên, hai nguồn provenance của pagination. | `market_serving/native_views.py:536-563` (và `:1219-1246` `contract_version:'1.1'`, `:1437-1460`, `:1683`) |
| **M3** | §3 hàng F7/F7x: cùng một luật `{data:{message/ok}, meta:{}}` | **F7x không xác định được tĩnh** — 2 site trả `cache.get(...)`, 1 site **echo nguyên `request.data` của client**. Client sau khi học contract mới sẽ gửi `{data:{...}}` ⇒ echo thành `{data:{data:{...}}}` ⇒ unwrap FE ăn mất 1 tầng. **Bọc F7x là bộ khuếch đại lồng nhầm, không phải chuẩn hoá.** | `market_data/stock_mgmt_native_views.py:2188`, `:2780`; `user_workspace/portfolio_analytics_views.py:2577` |
| **M4** | §3 hàng F3: "giữ nguyên — **đã khớp ý định**" | Giữ F3 = **giữ nguyên xung đột tên `status` ở cấp trên cùng**. Đo: **319 site** có literal `'status': <giá trị nghiệp vụ>` (không phải `status.HTTP_*`) — nhiều hơn nhiều so với "3 nghĩa" mà survey A nêu. F3 đặt `status` ở top-level nên nó **đang tranh chấp tên key với dữ liệu nghiệp vụ**. Mục tiêu §1.2 ("một schema provenance") **không đạt** nếu giữ F3 nguyên vẹn. | `identity_access/views/helpers.py:334` vs `commercial/views.py:275`, `commercial/tasks.py:148,154,207,236,246,283,296,299,449,557,656`, `advertising/tasks.py:79,82,92,222`, `advisory/views.py:230,556` |
| **M5** | §2: "KHÔNG bọc 204 rỗng (21) — không có body để bọc" | **Đúng, đã kiểm đủ 21/21** — tất cả đều `status=204` và không truyền payload. *(Ghi nhận điểm này kế hoạch làm đúng.)* Nhưng có 1 site **204 CÓ body** đếm nhầm sang F7: `dnse_credential_views.py:89` trả `{'detail': 'DNSE credential đã được xoá.'}` kèm 204 — vi phạm RFC 9110, và FE **vứt mất** nó vì `transport.js:489` `if (response.status === 204) return null;`. Luật F7 của kế hoạch sẽ làm nặng thêm. | `identity_access/dnse_credential_views.py:89`; `adapters/core/transport.js:489` |

### 3. Rủi ro bị bỏ sót

Bảng §5 liệt kê 6 rủi ro. Dưới đây là các rủi ro **quan trọng hơn** mà kế hoạch không nêu, xếp theo mức.

#### R1 — CAO, **tiền thật**: contract nội bộ trong process, trả khuyến nghị AI cũ

Server gọi chính view của nó **6 lần** bằng `as_view()()`; **3 chỗ đọc `Response.data`** sau đó:

```
stock_mgmt_native_views.py:2635  refresh_response = AdvisoryRefreshView.as_view()(django_request, symbol=…)
stock_mgmt_native_views.py:2639  advisory_id = refresh_response.data.get('advisory_id') if isinstance(...) else None
stock_mgmt_native_views.py:2641  AdvisoryRecord.objects.filter(advisory_id=advisory_id, ...)   # None ⇒ rỗng
stock_mgmt_native_views.py:2645  return _latest_ai_record(...)   # ← RƠI VỀ PHIÊN CŨ
```
Tương tự `:2764 → :2768, :2776, :2777, :2778` (`payload['task_id']`, `payload['manual_trigger']` — **không có fallback ⇒ thành `None`**), và `:2913 → :2916`.
Ba chỗ còn lại forward thẳng response: `portfolio_analytics_views.py:558, 567, 584` (`AdvisoryLatestView` / `AdvisoryRefreshView`).

**Vì sao là rủi ro tiền thật:** `AdvisoryRefreshView` trả `AdvisoryRecordSerializer(record).data` + `task_id`/`budget`/`manual_trigger` (`advisory/views.py:605-637`). Bọc nó ⇒ `.get('advisory_id')` trả `None` **không ném lỗi** ⇒ `:2641` không match ⇒ `:2645` trả record **mới nhất bất kể `session_date`** ⇒ UI hiện khuyến nghị mua/bán của phiên trước. Đây đúng loại P0 mà `AGENTS.md` Entry 231 ghi là **đã từng phải sửa** (`AdvisorySession` không FK tới `AdvisoryRecord` ⇒ "rủi ro hiển thị khuyến nghị mua/bán cũ"). Không có dòng nào của nó trong §3, §4, §5; cột "FE consumer" của B1 cũng không bắt được (đây không phải consumer FE).

#### R2 — CAO: **double-unwrap** ở FE — B3 chặn sai chỗ

Kế hoạch đặt `unwrapEnvelope` vào 5 chỗ `transport.js`/`coreAdapter.js` rồi coi như xong. Nhưng **23 file production FE đã tự unwrap** (34 hit, xem bảng số bên dưới). Thêm unwrap ở tầng transport ⇒ unwrap **hai lần**. Hậu quả: chỉ khi payload bên trong **không** có key `data` thì `??` mới fallback đúng. Với bất kỳ payload nào có `data` là **field nghiệp vụ**, FE sẽ ăn mất các key anh em.

Và kế hoạch **tự mâu thuẫn ở đây**: §3 nói **tách F5 khỏi đợt này** (`{data, +siblings}` — 4 endpoint mà `data` là field nghiệp vụ, `views_usage.py:140,205`, `native_views.py:216`). Nhưng unwrap ở tầng transport **bẻ F5 theo định nghĩa**. Không thể "hoãn F5" sau khi đã unwrap toàn cục.

#### R3 — CAO: 426 call site, **không CI, không cửa rollback**

§5 tự ghi "Không có CI (GitHub Actions đã tắt)" nhưng §5/§6 **không nêu cơ chế revert**. Một thay đổi 426 site phát ra cùng lúc, không version header, không feature flag, không CI ⇒ khi hỏng thì chỉ còn `git revert` trên `dev`. Đây là quyết định cần owner, không phải chi tiết vận hành — xem câu 6.

#### R4 — TRUNG BÌNH: cắt lô theo **app** là không an toàn

§4 B5: "Chia theo app, mỗi agent một nhóm `file` rời nhau", §7: "chia được 3-4 agent song song". "File rời nhau" **không** đồng nghĩa contract rời nhau: 3 coupling `market_data → advisory` và 3 coupling `user_workspace → advisory` **xuyên app**. Agent giữ `market_data` có thể phá contract của `advisory` mà không đụng file nào của `advisory`. Cần cắt theo **cụm coupling**, không theo app.

#### R5 — TRUNG BÌNH: B4 không phủ được bề mặt nó lẽ ra phải canh

§4 B4 nói "Sinh schema **từ serializer**". Đo: **201 `class X(APIView)`** trần vs **5** generic view có `serializer_class`; `swagger_auto_schema`/`extend_schema_field` = **0**; chỉ có **182 `@extend_schema`** viết tay. 282 site F9 là dict dựng tay ⇒ spectacular **về nguyên tắc không mô tả được**. Gate "schema validate" sẽ xanh trong khi không mô tả phần lớn bề mặt.

#### R6 — THẤP nhưng nên ghi: `survey-a` bảng F2 sai, và nó mâu thuẫn `CONTRACT_DECISION.md`

`survey-a` mục F2 ghi 3 site `market_serving/native_views.py:549, 1235, 1456` là **"lồng" ❌**. Đọc thật: `'meta'` ở `:549` **ngang hàng** `'results'` (`:536`), `'server_time'` (`:537`), `'filters'` (`:538`), `'next_cursor'` (`:547`), `'has_more'` (`:548`) — cùng thụt lề 12, cùng một dict. Tức **`meta` top-level đã tồn tại** ở `market_serving`.
`CONTRACT_DECISION.md:67-68` nói đúng: *"'meta' cấp trên cùng đã là mẫu của cả `market_serving` lẫn `user_workspace`"*. **Hai tài liệu cùng bộ bằng chứng, cùng 3 file:line, nói ngược nhau.** Kết luận `{data, meta}` = 0 site vẫn đúng (không site nào có **cả hai** ở top-level), nhưng **lập luận dùng để bác bỏ mẫu đang có thì sai**.

---

## Phản bác tiền đề của kế hoạch

| # | Kế hoạch nói | Code nói | file:line @ `3ebe9424` |
|---|---|---|---|
| P1 | §0/§4 B3: "**5 điểm unwrap**, `transport.js:459/490/512/535` + `coreAdapter.js:69`" | Cả 5 đều là **`return response.json();`** — parse body trên fetch `Response`, **không có** `res?.data ?? res`, không có kiểm tra envelope nào. Không phải "điểm unwrap". | `adapters/core/transport.js:459, 490, 512, 535`; `adapters/core/coreAdapter.js:69` |
| P2 | §0: "26 file component **không đụng**" | Đo dual-read thật: **34 hit / 23 file** production. Danh sách ở mục số bên dưới. | xem bảng "Số nào tôi tái dẫn được" |
| P3 | §4 B1 gate: "số dòng khớp **tổng call site đếm được ở survey-a**" | Chạy script được dẫn cho **583**, không phải 591 ⇒ gate **không thể đạt** như viết. | `%TEMP%\opencode\api02a_scan2.py` (Phụ lục A, `survey-a:296`) |
| P4 | §2: "KHÔNG đổi schema response của `/api/*` … nằm ngoài repo" | `/api/*` chủ yếu do view **trong repo** phục vụ. 290/583 site. | `vninvest_core/urls.py:62,63,66,68` |
| P5 | §3 hàng F6: bọc kể cả `results/next/previous` | 2 chỗ **mutate `response.data` sau khi dựng** — bọc là ghi sai tầng, không lỗi. | `market_data/views.py:117-118`; `service_ops/views/scheduler.py:268-269` |
| P6 | §3 hàng F7/F7x: chung một luật | F7x = shape runtime, 1 site **echo `request.data`** ⇒ bọc thành lồng kép. | `portfolio_analytics_views.py:2577`; `stock_mgmt_native_views.py:2188, 2780` |
| P7 | §5: 6 rủi ro, không có rủi lo "contract nội bộ" | 6 chỗ `as_view()()` trong process, 3 chỗ đọc `Response.data` ⇒ rơi về advisory phiên cũ. | `stock_mgmt_native_views.py:2635/2639, 2764/2768/2776-2778, 2913/2916`; `portfolio_analytics_views.py:558,567,584` |
| P8 | §4 B4: schema sinh **từ serializer** | 282/591 site không có serializer. 201 `APIView` trần vs 5 generic view có `serializer_class`; 0 `swagger_auto_schema`. | `settings.py:333`; `urls.py:43-44` |

**Điểm kế hoạch làm ĐÚNG (ghi nhận):**
- §0 trích `smart-stats-header-null-value.component.test.js:8` — **đúng dòng**, đúng nội dung `const marketValue = Number(summary?.total_market_value) || 0;`.
- §2 "KHÔNG bọc 204 rỗng" — **đúng 21/21**, đã kiểm từng site.
- §2 "KHÔNG sinh migration" — **đúng** (xem câu 1).
- Giữ F3 là **có tải trọng thật**: `identity_access/tests/test_login_upgrade.py:75` `self.assertIn('request_id', res_data)` đang xanh ⇒ đổi F3 sẽ phá test. (Đây là lý do `survey-a:285` nêu, và kế hoạch đã ghi đúng.)

---

## Số nào tôi tái dẫn được / số nào không

Lệnh dùng chung để tái lập phần AST (không ghi file vào repo):

```powershell
$d="C:\Users\PHAMVI~1\AppData\Local\Temp\opencode\audit"; New-Item -ItemType Directory -Path $d -Force|Out-Null
Copy-Item "$env:TEMP\opencode\api02a_scan2.py" "$d\audit_scan.py" -Force
$env:PYTHONIOENCODING="utf-8"
python "$d\audit_scan.py" "C:\Mujoco Projects\vninvest\packages\core\backend\src"   # KHÔNG pipe qua Select-Object -First
```

| Kế hoạch nói | Tôi đo được | Verdict | Lệnh / bằng chứng |
|---|---|---|---|
| **386/591 response 2xx phẳng** | 591 **không tái dẫn**; script cho **583**. Phẳng = 104 + 284 = **388** (F9 phải là 284 chứ không 282) | **SAI** | `python audit_scan.py …` → `n=284 F9`, `n=104 F8` |
| **10 họ envelope** | 10 họ + 1 nhóm `F? UNRESOLVED` (2 site) | **TÁI DẪN ĐƯỢC (có bổ sung)** | cùng lệnh; `family()` có 12 nhánh |
| **`{data, meta}` = 0 call site** | **0** ✔ | **ĐÚNG** *(lập luận thì sai — xem M2/R6)* | `Get-ChildItem -Recurse -Filter *.py … \| Select-String -Pattern "'meta'\s*:" -Encoding UTF8 \| Measure-Object -Line` → **8**, đọc tay cả 8 |
| **5 điểm unwrap** `transport.js:459/490/512/535` + `coreAdapter.js:69` | Cả 5 là `return response.json();` | **BỊ BÁC BỎ** | `Select-String -Path …transport.js -Pattern "return response\.json\(\)"` → đúng 4 dòng 459/490/512/535 |
| **26 file production FE đọc payload** | **34 hit / 23 file** (dual-read) | **BỊ BÁC BỎ** | lệnh dưới |
| **85 test đỏ** | **CHƯA XÁC MINH** | **CHƯA XÁC MINH** | xem ghi chú dưới |
| **F0 204 rỗng = 21** | **21**, tất cả `status=204` không body | **TÁI DẪN ĐƯỢC** | JSON `families["F0 EMPTY (204 / no body)"]` → 21 |
| **F1 mảng trần = 19** | **18** | **SAI (−1)** | JSON `families["F1 BARE ARRAY…"]` → 18 (chênh nằm ở `legacy_stubs.py:30`, thân helper) |
| **F6 phân trang = 91** | **94** (30 paginator + 64 viết tay) | **SAI (+3)** | JSON `families["F6 LIST-ISH…"]` → 94; trong đó có 2 thân helper: `pagination.py:27`, `legacy_stubs.py:34` |
| **F7/F7x ACK = 53** | 50 + 3 = **53** | **TÁI DẪN ĐƯỢC** | JSON → `F7` 50, `F7x` 3 |
| **F8 = 104** | **104** | **TÁI DẪN ĐƯỢC** | JSON → `F8 FLAT serializer.data` 104 |
| **F9 = 282** | **284** | **SAI (+2)** | JSON → `F9 FLAT domain-object` 284. Chênh đúng 2 = site `operator/views.py:146,161` mà survey A tách ra làm F4b — mà `family()` **không có nhánh F4b** |

**Đối chiếu tổng (chênh đúng 8, giải thích trọn vẹn):**

```
583  script thật @ 3ebe9424
+12  F3 — 12 call site success_response(), KHÔNG phải Response() ⇒ script không thấy
- 2  F4b bị script xếp vào F9 (family() không có nhánh F4b)
+ 2  2 site exceptions.py:225, :449 script xếp "F? UNRESOLVED", survey A đếm sang ERROR
- 1  F1: legacy_stubs.py:30 (thân _empty_list) — survey A loại
+ 3  F6: gồm pagination.py:27 + legacy_stubs.py:34 (thân helper) — survey A loại
-----
591
```
⇒ **591 là tổng lắp tay, không phải output của script mà kế hoạch dẫn làm phương pháp.** Hai điều này phải nói rõ trong kế hoạch, vì Gate B1 đang neo vào nó.

**Về "591" thêm 2 điểm đáng lưu ý về độ tin cậy của script:**
- Script in header `COMMIT : 93764b8c` **hard-code** (`api02a_scan2.py:427`) — chạy ở commit nào nó cũng in commit đó ⇒ **output không tự chứng minh được nó chạy ở đâu**.
- Bảng override thủ công neo theo `file:line` cứng (42 khoá). Tại `3ebe9424`, **2 khoá đã trượt**: `vninvest_core\exceptions.py:215` (nay là dòng trống) và `:439` (nay là `'code': self.code,`) — khớp đúng chênh lệch **244 vs 246** chỗ lỗi literal. Override trượt ⇒ phân loại sai **không báo lỗi**.
- `legacy_stubs.py:33 _empty_paginated()` — grep đệ quy toàn `src/` (kể cả tests): **đúng 1 kết quả, chính dòng định nghĩa. 0 caller ⇒ dead code.** `survey-a:170` đã gọi là dead code và loại khỏi tổng, nhưng nó **vẫn nằm trong script output** ⇒ bất kỳ ai chạy lại script đều nhận 94 chứ không 91.

**Lệnh tái dẫn "5 điểm unwrap" (để thấy bác bỏ):**
```powershell
Select-String -Path "packages\web\src\adapters\core\transport.js" -Pattern "return response\.json\(\)" -Encoding UTF8
# → 459, 490, 512, 535  (không có dòng nào chứa ?.data)
Select-String -Path "packages\web\src\adapters\core\coreAdapter.js" -Pattern "return response\.json\(\)" -Encoding UTF8
# → 69
```

**Lệnh tái dẫn "23 file / 34 hit dual-read" (thay cho "5 điểm"):**
```powershell
$files = Get-ChildItem -Path "packages\web\src" -Recurse -Include *.js,*.jsx,*.ts,*.tsx -File |
  Where-Object { $_.FullName -notmatch '\\(test|tests|__tests__|__mocks__)\\' -and $_.Name -notmatch '\.(test|spec)\.' }
$hits = $files | Select-String -Pattern '(\?\.\s*data\s*(\?\?|\|\|))|(\.data\s*(\?\?|\|\|))' -Encoding UTF8
$hits.Count                                                     # → 34
($hits | Select-Object -ExpandProperty Path -Unique).Count      # → 23
```
23 file: `adapters/chartAdapter.js` · `components/advisory/RecommendationHistoryMini.js` · `components/dashboard/PortfolioHeatmap.js` · `components/soc/SocDnseBackfillPanel.tsx` · `components/soc/SocSignalsPanel.tsx` · `components/workstation/hooks/{useOrderBook,useSessionFacts,useTradeLog}.js` · `components/WhaleBubbleChart.jsx` · `hooks/{useAlertCenterData,useRealtimeFeedCore}.js` · `pages/admin/AdminCore{AuditTrace,Billing,Jobs,Overview,PATs,ServiceAccounts,Tenants,Usage}Page.tsx` · `pages/auth/Auth{Register,VerifyEmail}Page.tsx` · `pages/tenant-admin/TenantAdminBillingPage.tsx` · `pages/SupportPage.tsx`

**Mẫu nguy hiểm nhất — probe theo cấu trúc, không phải `?.data`** (`useAlertCenterData.js:87-89`):
```js
const payloadObj = (feedData && feedData.results)
  ? feedData
  : { results: Array.isArray(feedData) ? feedData : [], next: null, previous: null };
```
Bọc mà **không** unwrap ở đúng tầng ⇒ `feedData.results` thành `undefined` ⇒ nhánh else ⇒ `results: []` ⇒ **bảng tin cảnh báo rỗng, không báo lỗi**. Đây là biến thể "0 giả" mà §5 cảnh báo, nhưng nó **không** nằm trong 5 chỗ của B3.

### Ghi chú về "85 test đỏ" — **CHƯA XÁC MINH, và số này mâu thuẫn chính nó**

Tôi **không** chạy được suite: `CORE_DATABASE_URL` chưa set, `DJANGO_DEBUG` chưa set; Postgres `127.0.0.1:5433` **có** mở, nhưng `run_tests.py:22-23` ghi rõ migration `9000_auth_user_email_ci_unique` dùng `array_agg` ⇒ **không chạy trên SQLite**, và `AGENTS.md` yêu cầu DB riêng mỗi agent — tác vụ này không cho phép tôi tạo DB. Nên:

- **`85` = CHƯA XÁC MINH.** Theo đúng yêu cầu của đề bài, đây **không phải finding** — nó là số chưa xác minh.
- **Nhưng nó là finding ở dạng khác:** con số này **không có nguồn trong repo**, và **hai con số đo được trong chính thư mục evidence này nói ngược lại**:
  - `survey-b-error-envelopes.md:16, 179, 289, 300` — đo thật: `Ran 229 tests … FAILED (failures=47, errors=0)` = **47 đỏ** trong app `vninvest_core`.
  - `docs/OPEN_WORK_20260927.md:38, 150` — baseline BE: **`602 test — failures=10, errors=3`** = **13 đỏ**.
- **Và quan trọng cho quyết định thứ tự:** 47 lỗi đã được phân loại (23 sai URL slug · 12 sai format · 5 tiền đề lỗi thời · 7 ngoài phạm vi) và **không cái nào chạm success envelope** — chúng là assertion về *error* envelope / URL / header. B5 chỉ đổi shape 2xx. ⇒ 47 lỗi đo được **không phải rào cản B5**. Phần chưa rõ là 85 − 47 = 38 lỗi còn lại, thuộc app nào, có chạm success shape không.
- `2746` **truy được về nguồn**: `run_tests.py:5-6` — "642 test" (`backend/tests/`) + "2104 test" (`src/*/tests/`) = 2746. Đây là **docstring, không phải log chạy**; tôi đếm được 2091 `def test_` trong `src` (chênh 13, chưa rõ do gì). Nên `2746` = *truy được về nguồn*, chưa xác nhận là số đo tại `3ebe9424`.

---

## Rủi ro bị bỏ sót

Xếp theo mức, tất cả đều **không** có trong §5:

| ID | Mức | Rủi ro | Bằng chứng |
|---|---|---|---|
| **R1** | **CAO — tiền thật** | Contract nội bộ trong process. Bọc `AdvisoryRefreshView` ⇒ `advisory_id=None` ⇒ rơi về `_latest_ai_record` ⇒ **khuyến nghị AI phiên cũ**, không lỗi, không cảnh báo | `stock_mgmt_native_views.py:2635,2639,2641,2645,2764,2768,2776-2778,2913,2916`; `portfolio_analytics_views.py:558,567,584`; `advisory/views.py:605-637` |
| **R2** | **CAO** | **Double-unwrap**: unwrap ở tầng transport + 23 file FE đã unwrap sẵn. Payload có `data` là field nghiệp vụ ⇒ ăn mất key anh em. Và §3 "tách F5" **không tương thích** với unwrap toàn cục | 34 hit/23 file (lệnh ở trên); F5: `views_usage.py:140,205`, `native_views.py:216` |
| **R3** | **CAO** | 426 site / không CI ⇒ **không có cửa rollback** nào ngoài `git revert` trên `dev`. Không version header, không feature flag | §5 tự ghi "GitHub Actions đã tắt" nhưng không nêu cơ chế |
| **R4** | TRUNG BÌNH | Cắt lô theo app ⇒ contract xuyên app vẫn đứt. "File rời nhau" ≠ "contract rời nhau" | 6 `as_view()()` xuyên app (`market_data`→`advisory`, `user_workspace`→`advisory`) |
| **R5** | TRUNG BÌNH | B4 không mô tả được phần lớn bề mặt ⇒ gate "schema validate" xanh giả | 201 `APIView` trần vs 5 generic có `serializer_class`; 0 `swagger_auto_schema`; 182 `@extend_schema` |
| **R6** | THẤP | `survey-a` bảng F2 phủ định `meta` top-level ở `market_serving` — **sai**, và mâu thuẫn `CONTRACT_DECISION.md:67-68` | `market_serving/native_views.py:536-549` (`meta` ngang hàng `results`/`filters`/`next_cursor`/`has_more`) |
| **R7** | THẤP | 204 **có body** bị FE vứt: `dnse_credential_views.py:89` trả `{'detail':…}` + 204; `transport.js:489` `if (response.status === 204) return null;` ⇒ mất thông báo xoá DNSE credential | `identity_access/dnse_credential_views.py:89`; `adapters/core/transport.js:489` |

---

## Đồng ý / bất đồng với thứ tự B1..B6

| Bước | Quan điểm | Lý do (kèm file:line) |
|---|---|---|
| **B1** bản đồ | **ĐỒNG Ý (nhưng gate phải viết lại)** | B1 là đúng và phải trước mọi thứ. **Nhưng** gate hiện tại — "số dòng khớp tổng call site đếm được ở survey-a" — **vô hiệu**: mục tiêu 591 không phải output máy (mục số ở trên). Phải neo gate vào **một con số AST tự nhất quán** và **thêm cột `consumer nội bộ`** cho 6 coupling R1. |
| **B2** chữa nền test trước B5 | **BẤT ĐỒNG — over-serialised** | Lập luận "không có nền xanh thì không phân biệt hỏng-vì-migrate với hỏng-sẵn" là **đúng**, nhưng kế hoạch biến nó thành **blocker** khi chỉ cần một **baseline snapshot**. Cụ thể: 47 lỗi đo được đã phân loại và **không cái nào chạm success envelope** (`survey-b:16`); B5 chỉ đổi shape 2xx. Triage đầy đủ 85 lỗi là **ticket riêng**, không phải tiền đề. **Thêm nữa, kế hoạch tự mâu thuẫn:** §2 non-goal nói "**KHÔNG** sửa 85 test đỏ trong một cùng PR. Tách ticket." nhưng §4 B2 gate nói "Mọi `REAL_BUG` **sửa** hoặc ghi ticket" và §5 nói "B2 trước B5 — đây là lý do đảo thứ tự". Không thể vừa "tách ticket" vừa "B2 là điều kiện tiên quyết". **Đề xuất:** B2 rút còn "chạy 1 lần, lưu log, ghi số đỏ + danh sách vào commit" (không triage) — đủ để chẩn đoán hậu-migrate, và **không** chặn. |
| **B3** unwrap FE | **ĐỒNG Ý — nhưng phảI sửa chỗ** | Đây là bước **đáng giá nhất** trong kế hoạch. Nhưng 5 dòng được nêu **không phải điểm unwrap** (P1), và gate B3 chỉ kiểm *helper*, **không** kiểm **tương tác double-unwrap** với 23 file sẵn có (R2), **không** kiểm probe theo cấu trúc như `useAlertCenterData.js:87-89`. Gate B3 cần bổ sung 2 test: (i) endpoint F5 (`{data, +siblings}`) qua transport rồi qua hook ⇒ **không** mất key anh em; (ii) payload có `data` **lồng** ⇒ unwrap đúng 1 tầng. |
| **B4** OpenAPI trước B5 | **BẤT ĐỒNG — sai phía** | Schema sinh **từ code**. Sinh ở B4 (trước B5) = mô tả contract cũ, bị vô hiệu ngay lần kế tiếp. Và R5: nó không mô tả được 282 dict dựng tay. **Thứ tự đúng:** B4 **sau** B5 (schema là **bằng chứng** B5 đúng, không phải bước chuẩn bị). Nếu muốn baseline thì chạy 2 lần: 1 lần trước (snapshot), 1 lần sau (verify) — chứ không đặt B4 làm chặn cho B5. |
| **B5** migrate, "chia theo app, file rời nhau" | **BẤT ĐỒNG về cách cắt lô** | R4: 6 coupling xuyên app ⇒ "file rời nhau" **không** đảm bảo an toàn. Phải cắt theo **cụm coupling** (`advisory` + `market_data` + `user_workspace` phải chung một lô hoặc phải có contract test nối). Ngoài ra nếu giữ non-goal §2 `/api/*` (M1) thì scope **tụt từ 426 xuống ~203**, phải sửa §7. |
| **B6** dọn fallback | **ĐỒNG Ý** | Đúng và cần thiết — nhưng phải thêm điều kiện: **chỉ dọn sau khi tất cả consumer nội bộ (R1) cũng đã được xử lý**, không chỉ consumer FE. |

**Tóm lại về §0 "đảo thứ tự":** kế hoạch chỉ đảo 1 thứ (B2 lên trước B3) và **đảo sai chỗ đó**. Nó bỏ sót hai đảo chính đáng làm hơn: **B4 xuống sau B5**, và **B2 hạ xuống thành baseline snapshot** thay vì blocker.

---

## Câu hỏi cần làm rõ

**3 quyết định kế hoạch đã nêu (chưa phản bác, nhưng cần chỉnh):**
1. `meta` bắt buộc hay tuỳ chọn? — Vẫn treo đúng. Bổ sung: kế hoạch tự ghi "chưa đo được" (§5) rằng `meta:{}` rỗng ở hơn nửa số endpoint là hình thức. **Gợi ý:** với dữ liệu đã đo (F8 104 + F7 53 + F0 21 = 178/583 ≈ 31% không có gì để đưa vào `meta`), "bắt buộc" sẽ sinh ~178 `{}` rỗng ngay lô đầu.
2. `CursorPagination` không có `count` (91→94 response)? — Vẫn treo đúng. `settings.py:316` xác nhận. **Ghi chú thêm:** `market_serving` **đã** tự giải quyết vấn đề này bằng `meta.pagination` + `meta.contract_version` (`native_views.py:550, 559-563`) — tức đã có 1 mẫu paginated-with-provenance đang chạy thật; kế hoạch không nhắc tới nó.
3. Có làm B5 không? — Đồng ý với kết luận "nên làm, nhưng không phải ngay", nhưng **điều kiện tiên quyết phải sửa**: không phải B2-triage, mà là (a) map có cột consumer nội bộ, (b) quyết định 4 dưới đây.

### Quyết định thứ 4 mà kế hoạch bỏ sót: **xử lý `meta` trùng tên với contract đang chạy**

> Repo **đã có** một họ contract phân trang đã version hoá, đã chạy thật, dùng **payload phẳng + `meta` top-level**:
> `{results, server_time, filters, next_cursor, has_more, meta{contract_version, source_mix, market_top_tier, pagination}}`
> — `market_serving/native_views.py:536-563` (`contract_version:'2.0'`), `:1219-1246` (`'1.1'`), `:1437-1460` (`'1.0'`), `:1683` (`'1.0'`); thêm `user_workspace/portfolio_analytics_views.py:1433, 1700` (`'core-whale-compat-v1'`).
>
> §3 bọc F6 thành `{data:{...}, meta:{}}` ⇒ `meta` cũ **rơi vào trong `data`** (`data.meta.pagination`) **và** `meta` mới ở ngoài ⇒ **hai nguồn provenance của pagination**, cùng tên, cùng endpoint. Không ai ở §2–§6 nói tới chuyện này.

Ba lựa chọn phải chốt (tôi không tự chọn):
- **(a)** `market_serving` là ngoại lệ, giữ nguyên, ghi rõ trong OpenAPI — nhưng khi đó có **2 hợp đồng paginated** ⇒ mục tiêu §1.1 ("một quy tắc") không đạt.
- **(b)** Chuẩn hoá **theo** mẫu đang có: payload phẳng + `meta` top-level tuỳ chọn — tức **`{data, meta}` bị bỏ**, đúng như `CONTRACT_DECISION.md` §3 đã quyết, và kế hoạch này **đi ngược quyết định đã có** mà không nói ra.
- **(c)** Bọc `{data, meta}` và **nâng `contract_version`** — nhưng `data.meta` bên trong là payload nghiệp vụ, đặt provenance của *transport* lẫn của *nghiệp vụ* vào hai tầng khác nhau ⇒ phải định nghĩa lại `meta` là provenance gì.

**Quyết định thứ 5 (kèm theo, cũng chưa có trong §6): ai chịu trách nhiệm contract nội bộ?** 6 `as_view()()` + 2 mutate `Response.data` (`market_data/views.py:117-118`, `service_ops/views/scheduler.py:268-269`) cần một quyết định: refactor chúng trả domain object thay vì `Response` (sạch, nhưng đụng ngoài envelope), hay ghi rõ chúng là **ngoại lệ được phép phá** và thêm test khoá. B1 không có cột nào cho chúng.

### Câu hỏi nhỏ cần làm rõ
- `survey-c` (triage 85) đã bị hủy sau ~55 phút. **85 con số này từ đâu ra?** Không có trong bất kỳ tài liệu evidence nào. Cần nguồn trước khi đặt làm gate.
- 38 lỗi còn lại (85 − 47) thuộc app nào, và có chạm success shape không? Đây mới là phần thực sự quyết định B2 có cần làm trước không.
- Có `X-Api-Version` / feature flag nào để rollout 426 site dần không? (grep chưa thấy; cần owner xác nhận.)

---

## confidence: **medium**

**Cao (chắc, vì đọc code thật + chạy script thật):**
- Bác bỏ "5 điểm unwrap" — 5 dòng đều là `return response.json();`, đọc trực tiếp.
- 23 file / 34 hit dual-read ở FE — đếm bằng `Select-String`, có lệnh dẫn lại.
- 6 `as_view()()` + 3 chỗ đọc `Response.data` + 2 chỗ mutate `response.data` — đọc từng dòng.
- `/api/*` phần lớn trong repo; 290/583 site thuộc app mount dưới `/api/` — đếm bằng script + đọc `urls.py`.
- F0 = 21 đều 204 rỗng; F7x = 3; F7 = 50; F8 = 104; F5 = 3; F4 = 4.
- `settings.py:316` `DEFAULT_PAGINATION_CLASS = CursorPagination`; `settings.py:326-328` chỉ `JSONRenderer`; không có template DRF.
- `meta` ở `market_serving/native_views.py:549` là **top-level**, ngang hàng `results`/`filters`/`next_cursor`.
- Hai bản `success_response` giống hệt nhau; `test_login_upgrade.py:75` khoá `request_id`.
- 201 `APIView` trần vs 5 generic có `serializer_class`; 0 `swagger_auto_schema`.
- `_empty_paginated()` (`legacy_stubs.py:33`) **0 caller** — dead code, grep đệ quy toàn `src/`.

**Trung bình (nêu là "không tái dẫn" thay vì khẳng định):**
- **591** — tôi chạy script được **583** và giải thích đúng 8 bằng cơ chế cụ thể có kiểm chứng, nhưng **không tái dẫn được con số 591 như một output máy**. Kết luận chắc là "591 = lắp tay, không phải output script"; còn phần dư +1/−3 giữa F1/F6 tôi **không** quy được là do code đổi hay do số học tay.
- **85 / 2746** — `85` **CHƯA XÁC MINH** (không nguồn, mâu thuẫn 47 và 13 trong chính repo). `2746` truy về được docstring `run_tests.py:5-6` nhưng tôi chưa xác nhận bằng log chạy.
- **"26 file FE đọc payload"** — tôi bác bỏ con số 26 **dưới định nghĩa dual-read** (23 file). Nếu ý kế hoạch là "file nào chạm `.data` bất kỳ kiểu nào" thì đó là **tiêu chí khác** và con số 26 có thể đúng — tôi **ƯỚC LƯỢNG** là không, vì không có lệnh nào trong tài liệu định nghĩa "đọc payload".
- Bốn `meta`/`as_of`/`stale` provenance: kế hoạch §1.2 nói "8 chỗ tự phát minh tên key". Tôi **không** đếm lại được con số 8 này theo định nghĩa đó (grep `contract_version` cho 15 site, `stale`/`source` cho hàng trăm, chồng lấn) ⇒ **ƯỚC LƯỢNG, không dùng làm finding**.

**Thấp (mang tính định hướng, tôi nói rõ là suy luận):**
- R3 (không có cửa rollback) tôi suy từ "không có CI" mà **chưa** kiểm tra kỹ có CI config nào khác (n8n/cron/pre-commit hook chạy test) hay không. Nên mạnh hơn: kế hoạch **không nêu** cơ chế rollback nào, đó là điểm chắc; còn "tuyệt đối không có CI" thì tôi chỉ dựa vào chính §5 của kế hoạch.
- R4 (cắt lô theo app) là đánh giá thiết kế quy trình, không phải lỗi code — tôi đưa vào vì §4/§7 cam kết "3-4 agent song song" như một ước lượng cỡ, và cam kết đó không đứng vững với coupling R1.

**Không làm gì:** không sửa file nguồn, không sinh migration, không `pip install`/`npm install`, không chạy test (cần DB riêng chưa được cấp), không delegate. Hai script sao chép nằm ở `%TEMP%\opencode\audit\` — **ngoài repo**, theo đúng cách `survey-a` Phụ lục A làm.
