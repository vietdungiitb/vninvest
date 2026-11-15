# Audit độc lập — `PLAN_CONTINUATION_20261115`

> **Ngày:** 2026-11-15 · **Phạm vi:** plan + evidence của slice `continuation-plan-20261115` (doc-only).
> **Người audit:** subagent **khác** người viết plan, chế độ **chỉ đọc**.
> **Trạng thái independence: HẠN CHẾ** — xem §1.

---

## 1. Phương pháp (và giới hạn)

| Bước | Kết quả |
|---|---|
| B3 đầy đủ bằng agent `general` (đọc plan, tự đo lại, phản biện) | **THẤT BẠI** — `Free usage limit reached` (session `ses_e221950deffel4YNiy0cNi2Wi4`). Không có verdict. |
| Phương án thay thế: agent `explore` **read-only**, kiểm từng citation + số đếm + git state | **HOÀN TẤT** (session `ses_e2214fd0cffe4w0bHjpvyGini9`), 16/16 mục |
| Tự kiểm của người viết (không tính là audit độc lập) | đã chạy `check-multi-agent`, `scan-secrets`, `pre-push-gate` — ghi ở §5 |

**Giới hạn phải nói rõ:** audit này **không** phải B3 đầy đủ. Nó xác minh **citation và số liệu** nhưng **không** tự đo lại log staging (không chạy SSH) và **không** phản biện định hướng chiến lược của plan. Vì vậy:
- **Được dùng** để chuyển tiếp slice **doc-only** này.
- **KHÔNG được tái sử dụng** làm B3/B8 cho bất kỳ slice sửa code nào (C-01 trở đi phải có auditor độc lập thật, tự đo lại).

---

## 2. Verdict

**`AGREE`** — không có objection BLOCKER/MAJOR; 2 objection MINOR đã được đưa vào plan trước khi commit; 2 reservation về phạm vi independence.

---

## 3. Đối chứng số liệu (auditor đo lại)

| Claim trong plan | Auditor đo lại | Khớp? |
|---|---|---|
| Local `dev` = `origin/dev` = `54a401b80`, cây sạch | `54a401b807c66481af3b822ed8e366d81a243e06` cho cả hai; branch `feat/continuation-plan-20261115` | **CÓ** |
| `useAlertCenterStream.ts:43-44` nhét token vào query | đúng nguyên văn `qs.set("token", token)` | **CÓ** |
| `views.py:803-817` nhận `?token=` | đúng, kèm comment "EventSource không gửi được Authorization header" | **CÓ** |
| `useSignalStream.component.test.tsx:141` ghim `token=` | `expect(url).toContain("token=test-pat-token")` | **CÓ** |
| `useRealtimeFeedCore.js:18,25,30` dùng `?ticket=` | đúng cả 3 dòng | **CÓ** (kèm cảnh báo M-02) |
| `pre-push-gate.mjs:363-370/397-399/441-444` | đúng logic resolve + regex `No module named` | **CÓ** |
| `freshness-report.md:12` ghi 137 | `\| migrations \| 137 \| C-003 \|` | **CÓ** (giá trị stale) |
| `check-system-design.mjs:146` regex `migrations/0*` | đúng, bỏ sót file bắt đầu bằng `9` | **CÓ** |
| `9000_auth_user_email_ci_unique.py:75` có `class Migration` | đúng; file tracked | **CÓ** |
| `AIAdvisorAlertPanel.js:67-68` timeout 10s | đúng `AbortController` + `10000` | **CÓ** |
| Handoff `:29-34` có 4 việc dở | đúng 4 mục | **CÓ** |
| `PERF_BASELINE_20261113.md:12-13` echarts 711.5 / i18n 564.1 KB | đúng | **CÓ** |
| Đếm migration: doc 137, gate 138, thực tế 139 | auditor đếm độc lập: **139** file (138 bắt đầu `0`, 1 bắt đầu `9`) | **CÓ** |
| Claim `continuation-plan-20261115` tồn tại, `in-progress`, branch khớp | `docs/CLAIMS.md:1980`, branch `feat/continuation-plan-20261115 -> dev` | **CÓ** |

---

## 4. Objections

### M-01 — MINOR (đã nằm trong plan, không cần sửa thêm)
`docs/system-design/_meta/freshness-report.md:12` ghi **137**, trong khi bộ đếm hiện tại ra **138** và sự thật là **139**. Plan đã xử lý ở **F-05/C-05** với yêu cầu sửa **cả** regex **và** doc. Auditor xác nhận: sửa doc 137→138 là **vẫn sai**, phải là 139.

### M-02 — MINOR (đã đưa vào plan)
`packages/web/src/hooks/useRealtimeFeedCore.js:9-10`: `getRealtimeWebSocketUrl(token)` fallback `localStorage.getItem('access_token')`. Hiện **không có call site nào** rơi vào fallback (`:1011` guard `wsTicket ? … : null`), nên **không phải lỗ đang hoạt động**. Nhưng đây là bẫy: caller tương lai gọi không tham số sẽ đẩy PAT vào `?ticket=`. **Đã bổ sung** vào C-01 mục "Gia cố kèm theo".

### R-01 — RESERVATION (phạm vi)
Các số liệu staging (283 token/24h, 277 WS + 7 SSE, 502 0/0/4/108, 23 PAT, disk 79%, 2 worktree, 5 DB) **không được auditor đo lại** — auditor chỉ kiểm rằng plan **có lệnh tái hiện** và các con số **nhất quán nội bộ** giữa plan và evidence. Người merge nên chạy lại §10 của `MEASUREMENTS_20261115.md` nếu cần kết luận hạ tầng.

### R-02 — RESERVATION (thẩm quyền)
Audit này **không** xác nhận định hướng sản phẩm (C-15) và **không** thay thế B3 cho code. C-01 (P0 kế tiếp) bắt buộc có auditor độc lập tự đo lại trước khi code.

---

## 5. Điểm đã xác nhận đúng

- **L-G02 (không PASS khống):** plan ghi `CHƯA CHẠY` cho full suite, cho 2 gate UI phụ thuộc staging, và nêu rõ 3 FAIL do môi trường. Không có mục nào báo PASS mà chưa chạy.
- **L-G04 (số đếm ≠ số lỗi):** 502 được tách theo vhost/path và có ghi chú "108 không phải 108 lỗi vninvest".
- **L-002/L-M02:** claim commit riêng **trước** khi viết plan; branch khớp đúng tên claim.
- **Deny-list:** các file claim khai (`docs/PLAN_…`, `docs/evidence/…`, `docs/CLAIMS.md`, ledger) **không** thuộc §2 `AGENT_PROTOCOL.md`.
- **Handoff verdicts:** cả 4 mục được đối chiếu bằng số đo, không lặp lại việc đã xong (AI 10s timeout).
- **P0 mới (SSE token):** có đủ 3 mảnh bằng chứng (FE, BE, test) + log hit sau rebuild.

---

## 6. Kết luận

Plan và evidence **đủ tin cậy để làm tài liệu tiếp tục**, với 2 điều kiện đã ghi trong plan:
1. C-01 phải xử lý **cả** SSE token **và** fallback PAT tiềm ẩn ở `useRealtimeFeedCore.js:10`.
2. C-05 phải sửa **cả** regex đếm migration, không chỉ con số trong doc.

**Verdict: `AGREE`.** Không có BLOCKER/MAJOR. Independence bị hạn chế như §1 — không dùng lại cho slice code.

---

*GHI LESSON MỚI: không — không có lỗi nào gây tốn thời gian/chặn build trong slice này; việc B3 bị chặn là giới hạn hạn mức công cụ, đã ghi minh bạch ở §1.*
