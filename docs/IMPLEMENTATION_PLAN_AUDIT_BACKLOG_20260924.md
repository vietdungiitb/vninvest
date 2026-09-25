# KẾ HOẠCH TRIỂN KHAI — Audit Backlog theo Pha (Bước B3)

> Đầu vào: `docs/BACKLOG_AUDIT_CONSOLIDATED_20260924.md` (24 items BL-01→BL-24) từ `docs/COMPREHENSIVE_AUDIT_CONSOLIDATED_20260924.md`.
> Nguyên tắc: đo trước làm sau; severity đi với confidence; xong item nào nộp `docs/evidence/audit-bl/<ID>/gates.md` item đó; cấm solution-first (§7).

## 0. Quy trình 4 bước (đã thực hiện)

- **B1 — Kiểm kê**: trích findings từ audit (SEC-A→H, R-01→R-10, C1–C9) thành danh sách đóng, mỗi finding có `file:line`.
- **B2 — Phân rã backlog**: mỗi finding → 1+ BL item với Yêu cầu/DoD/Phản biện/Minh chứng/Ước lượng/Vai trò/Phụ thuộc (file backlog).
- **B3 — Kế hoạch pha** (file này): sắp xếp theo DAG phụ thuộc + risk, gates mỗi pha, RACI, deny-list.
- **B4 — Bàn giao**: checklist + ledger; đội code chỉ cần đọc file này + file backlog.

## 1. DAG phụ thuộc

```
BL-10 ──┐ (topology/headers quyết định BL-20, R-05)
BL-02 ─► BL-11 (biến mới cần preflight)
BL-05 ─► BL-13 (soak/load qua pooler)
BL-03 ─► BL-14 (số liệu traffic dùng chung 2 chiều: whitelist BL-03, deprecate BL-14)
BL-04 ─► BL-17b DR-test định kỳ (sau khi có backup lịch)
BL-12 ─► BL-16 (E2E xanh mới dám bật coverage gate nghiêm)
BL-13 ─► BL-21/22/23 (số liệu mở khóa P3)
BL-24 ─► mọi feature product mới (mở khóa Product/Business scoring)
Độc lập, làm bất cứ lúc nào: BL-01, BL-06, BL-07, BL-08, BL-09, BL-15, BL-18, BL-19, BL-20
```

## 2. Pha P0 — 30 ngày (đóng lỗ hổng + sống còn)

| Tuần | Items | Song song tối đa | Gate cuối tuần |
|---|---|---|---|
| W1 | BL-06, BL-07, BL-08 (mỗi 0.5d) + BL-09 (2–3d) + BL-10 (1–2d) + khởi động BL-01, BL-04 | 3 luồng (BE / DevOps / Security) | gates.md BL-06/07/08/09/10 nộp đủ |
| W2 | BL-02, BL-03, BL-05 (+soak 24h), BL-11 | 3 luồng | boot-fail matrix xanh; MITM test đỏ-đúng; pooler có client |
| W3–W4 | BL-01 (1–2w), BL-04 (1–2w) | 2 luồng | SAML giả mạo bị từ chối; restore drill thành công + RTO/RPO số |

**Gate ra P0 (tất cả phải đạt)**: `npx tsc --noEmit` 0 · `npm run build` PASS · `npm run lint` 0 errors · `manage.py check` 0 · BE tests suite liên quan xanh · `gates.md` đủ 11 items P0 · phản biện viên tick hết mục "Phản biện" mỗi item.

## 3. Pha P1 — 90 ngày (reliability)

| Đợt | Items | Gate |
|---|---|---|
| Tháng 1 | BL-12 (E2E CI) + BL-15 (JSON logging) | 3 lần xanh liên tiếp; log JSON verify |
| Tháng 2 | BL-13 (k6 + saturation, sau BL-05) + BL-16 (coverage gate) | report p95/p99 + verdict; coverage không tụt |
| Tháng 3 | BL-14 (sunset, có số traffic) + BL-17 (MFA verify + rotation + doc) | 0 importer; quyết định MFA đóng/mở |

**Gate ra P1**: E2E xanh 2 tuần liên tiếp · loadtest có baseline số · proxy/compat xóa hoặc có deadline xóa · coverage gate bật.

## 4. Pha P2 — 6 tháng (maintainability)

BL-18 (warnings −15%/sprint, đo bằng count mỗi sprint) · BL-19 (tracing nếu BL-15 chưa đủ debug) · BL-20 (editorial audit + headers nếu BL-10 mở follow-up).
**Gate ra P2**: warnings giảm 2 kỳ liên tiếp · không mass `eslint-disable` (grep count không tăng).

## 5. Pha P3 — có điều kiện (chỉ khi đo)

BL-21/22/23 mở khóa **khi và chỉ khi** BL-13 chứng minh ngưỡng vượt (ghi ngưỡng trong gates.md BL-13 trước khi chạy). BL-24 mở khóa roadmap product. Không ai được tự ý làm P3 khi chưa có số.

## 6. RACI

| Vai trò | Chịu trách nhiệm chính | Tham gia |
|---|---|---|
| Senior Backend | BL-01, 02, 03, 06, 07, 08, 14, 15 | BL-09, 11, 13 |
| DevOps | BL-04, 05, 09, 10, 11, 13 | BL-01, 17 |
| Security | BL-10, phản biện BL-01/02/03 | BL-09, 17 |
| QA Lead | BL-06, 12, 16, gates các pha | mọi DoD |
| Frontend | BL-12, 18 | BL-09 |
| Performance | BL-13, 19 | BL-05 |
| CTO | gate ra mỗi pha + P3 unlock | deny-list enforce |

## 7. Deny-list (cấm đưa vào kế hoạch khi chưa có số liệu đo)

Microservices toàn phần · Kafka thay Celery · K8s (trừ khi multi-node/autoscale thật) · Next.js/RSC/SSR đại trà · GraphQL · NFT/blockchain · rewrite module khi chưa có failing test. Vi phạm = trả về, không review tiếp.

## 8. Checklist bàn giao B4 (đội code tự tick, không cần hỏi)

> Trạng thái handover (2026-09-24): B1–B3 file đầy đủ; B2 bổ sung BL-15→BL-24 + BL-17b (25 header / 24 ID); evidence dir `docs/evidence/audit-bl/` tạo; phụ thuộc BL-02/03/05 đối chiếu DAG đã sửa. Checklist dưới đây là **standing procedure cho từng BL item** — implementer tick khi làm item đó.

- [ ] Đọc file backlog item được giao (Yêu cầu → DoD → Phản biện → Minh chứng).
- [ ] Implement đúng scope, không lan man sang item khác.
- [ ] Tự trả lời hết mục "Phản biện" bằng bằng chứng trong `gates.md` (lệnh + output, không kể chuyện).
- [ ] Chạy gate chuẩn pha (§2/§3) và dán output vào `gates.md`.
- [ ] Nộp `docs/evidence/audit-bl/<ID>/gates.md` + diff; chờ tick phản biện độc lập.
- [ ] Ghi 1 dòng ledger theo mẫu Entry 197 (`docs/CODE_CHANGE_AUDIT_LEDGER.md`).

**Tick tổng (B4 handover — audit team, 2026-09-24)**:

- [x] Backlog 24 ID (BL-01…BL-24 + BL-17b) đủ 9 trường/quy ước.
- [x] Plan DAG / pha / RACI / deny-list / gates đối chiếu xong; 3 edge phụ thuộc ngược đã sửa trong backlog.
- [x] `docs/evidence/audit-bl/` tồn tại (README mẫu gates.md).
- [x] Ledger summary row 198 + Entry 212 (B2 complete + B4).
