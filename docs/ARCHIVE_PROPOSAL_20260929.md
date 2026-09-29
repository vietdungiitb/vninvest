# Đề xuất archive tài liệu .md (CHƯA xoá gì)

Ngày 2026-09-29. Tình hình trên `origin/dev` = `966b4ec2`.

**Không có file nào bị xoá ở tài liệu này.** Đây là đề xuất để owner duyệt trước.

Chạy lại: `node docs/scripts/classify-md.mjs`

## 1. Phân loại 1697 file .md

| Nhóm | Số file | Ý nghĩa |
|---|---|---|
| `keep` | 144 | tài liệu đang dùng hoặc cần cho workflow |
| `blocked` | 90 | **được code/CI/compose tham chiếu** — xoá sẽ làm hỏng |
| `archive candidate` | 1463 | không có tham chiếu inbound nào |

## 2. Vì sao "không có tham chiếu" CHƯA ĐỦ để xoá

Ba lý do khiến 1463 file này có thể vẫn cần giữ:

1. **Tài liệu đọc cho người, không phải cho máy.** `QUICKSTART_MULTI_TIMEFRAME.md`,
   `DEMO_DATASET_GUIDE.md`, `PORTAINER_DEPLOY_GUIDE.md` không có code nào trỏ tới, nhưng người
   mới cần. Tôi chỉ đánh dấu `blocked` khi có tham chiếu từ file code.
2. **Trùng basename.** Script đếm theo basename, nên một basename dùng bởi 3 file sẽ tính là
   "có tham chiếu" cho cả 3. Giới hạn của phương pháp, không phải kết luận.
3. **Lịch sử quyết định.** Nhiều `AUDIT_*` là bằng chứng cho finding đang mở trong
   `docs/CLAIMS.md` và `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

## 3. Phân bố 1463 ứng viên

| Khu vực | Số file |
|---|---|
| `docs/` (phẳng) | 1243 |
| `docs/evidence` | 58 |
| root repo | 53 |
| `docs/plans` | 35 |
| `docs/detailed_designs` | 29 |
| `docs/feedback` | 10 |
| `docs/watchlist_audit` | 7 |
| `docs/ai-ssot` | 6 |
| `docs/pr_drafts` | 6 |
| `quality/` | 6 |
| `docs/handoff` | 4 |
| `.copilot/` | 2 |
| `.opencode/` | 1 |

## 4. 90 file `blocked` — giữ nguyên, không xoá

Bị code/CI tham chiếu:

- `README.md`, `AGENTS.md`
- `docs/AGENT_PROTOCOL.md`, `docs/CLAIMS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `docs/ARCHIVE_AGENTS_PROGRESS.md`, `docs/OPEN_WORK_20260927.md`
- `docs/DOM_LAYOUT_CONTRACT.md`, `docs/ADVISORY_OBSERVABILITY_ARCHITECTURE.md`
- 7 file `docs/IMPLEMENTATION_PLAN_*` — trong đó `AI_COMMAND_CENTER_COMMERCIAL_20260925.md`
  và `MANDATORY_AGENT_WORKFLOW_20260927.md` đang là nguồn sự thật của OPEN P0
- 7 file `docs/OPEN_CORE_*` (feature boundary, numeric lock, entitlement quota)
- `.github/workflows-disabled/README.md`
- `PROGRESS_DASHBOARD.md`, `docs/CORE_API_FIX_CHECKLIST_20260513.md`

## 5. Đề xuất 3 đợt, mỗi đợt một PR

**Đợt A — chắc chắn an toàn (~30 file).** Chỉ file có dấu hiệu rõ là rác:

- `DAY1_COMPLETE.md`, `SPRINT12_BUOC16_READY.md` (trạng thái sprint đã đóng)
- `README_DRAFT.md` (bản nháp thay `README.md`)
- `FINAL_*_20260514.md` (bản "FINAL" bị audit sau đó phủ định)
- `docs/audit reports/`, `docs/planning/` (thư mục 1 file, sai quy ước)

**Đợt B — chuyển theo nhóm, giữ nguyên file (~600 file).** Với mỗi cụm chủ đề
(`AUDIT_*SOC*`, `AUDIT_*WATCHLIST*`, `AUDIT_*ALERT_CENTER*`, `BACKEND_DESIGN_*`),
chuyển vào `docs/archive/<nhóm>/` **không xoá**. Giảm nhiễu ở `docs/` mà vẫn giữ bằng chứng.

**Đợt C — xoá thật.** Chỉ sau khi owner đọc và **sau khi** purge git history.
Xem claim `sec01-defer-rotate` trong `docs/CLAIMS.md`: lịch sử vẫn còn credential.

## 6. Cần owner quyết

1. **Duyệt Đợt A** — tôi chưa liệt kê chi tiết 30 file vì cần đọc từng file
2. **B hay C trước?** Tôi đề xuất **B trước**: di chuyển rủi ro thấp, xoá thì không hoàn tác được
3. **90 file `blocked`** — có file nào muốn giữ thêm không? Tôi đang giữ toàn bộ

## 7. Phương pháp và giới hạn

- Đếm tham chiếu theo **basename** → bảo thủ (chỉ có thể giữ thừa, không xoá nhầm)
- `keep` = có tham chiếu từ `.md` khác, hoặc thuộc `packages/` `.github/`, hoặc là process doc cố định
- **Giới hạn thật:** script không đọc nội dung, không hiểu tài liệu nào còn giá trị domain.
  "Không có tham chiếu" **không đồng nghĩa** "không ai cần".
