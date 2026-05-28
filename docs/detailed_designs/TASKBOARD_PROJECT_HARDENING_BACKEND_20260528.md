# Taskboard — Project Hardening Backend
**Ngày**: 2026-05-28  
**Status**: Planned

---

## Overview

| Task | Tên | Status | Owner | Note |
|---|---|---|---|---|
| PH00 | Doc-pack lock | DONE | Copilot | 12 tài liệu handoff đã được tạo |
| PH01 | Core backend env bootstrap | TODO | Core Backend | Khóa dependency/env prerequisite cho QG-1 |
| PH02 | Orphan audit + quarantine | TODO | Core Backend | Quét đủ 6 bảng, reject migration khi còn orphan |
| PH03 | Tenant `NOT NULL` migration | TODO | Core Backend | Migration 6 tenant FK mục tiêu |
| PH04 | Legacy DB/container shutdown gate | TODO | Ops + Backend | Chỉ đóng khi cutover evidence hợp lệ |
| PH05 | Rate limiting hardening | TODO | Identity + Infra | Audit auth throttling, thêm gateway throttle |
| PH06 | Backend fat-file refactor | TODO | Identity + Service Ops | Tách `views_auth.py` và `dataops.py` |
| PH07 | Web fat-file refactor | TODO | Package Web | Tách `coreApiAdapter.js`, `AlertCenterPage.js` |
| PH08 | QG-1 closeout | TODO | QA + Tech Lead | Gates pass, evidence đủ |
| PH09 | VNPay/IPN foundation | TODO | Commercial Backend | Payment flow greenfield |
| PH10 | Outbound notification pipeline | TODO | Signal Intelligence | Email/FCM/WebPush delivery |
| PH11 | AI advisory cost control | TODO | Advisory Backend | Quota, cache, router failover |

Legend: TODO | IN PROGRESS | DONE | BLOCKED

---

## Phase gates

### Phase A — Baseline and Safety (PH01, PH02)
- [ ] Core test gate có env bootstrap rõ ràng.
- [ ] Audit orphan quét đủ 6 bảng.
- [ ] Không còn bất kỳ wording nào cho phép auto-map `system_tenant`.

### Phase B — Hardening Core (PH03, PH04, PH05)
- [ ] 6 tenant FK target có migration plan rõ ràng.
- [ ] Legacy shutdown không vượt SSOT roadmap.
- [ ] App + gateway throttling đều có proof.

### Phase C — Refactor Integrity (PH06, PH07)
- [ ] Backend files target được tách responsibility.
- [ ] `packages/web` build lane pass sau refactor.
- [ ] Không có public contract drift ngoài phạm vi đã khóa.

### Phase D — Gate Closeout and Greenfield Launch (PH08, PH09, PH10, PH11)
- [ ] QG-1 close với evidence thật.
- [ ] Payment greenfield reuse đúng foundation `commercial/`.
- [ ] Notification pipeline không sinh truth song song ngoài backend.
- [ ] AI cost control có guardrails và observability.

---

## Mandatory artifacts each task

1. File list changed.
2. Validation commands + outputs.
3. Payload/UI evidence nếu có contract hoặc UI.
4. Residual risk note.
5. Governance updates.

---

## Mandatory slice-exit checklist

- [ ] Focused tests/build PASS cho slice hiện tại
- [ ] Evidence template cập nhật xong
- [ ] Traceability row tương ứng đã link task + validation
- [ ] Ledger/progress/modified-files đã cập nhật
- [ ] `module_tree_full.md` đã regenerate
- [ ] Nếu slice chạm runtime code: `./start_dev.ps1` hoặc lane tương đương đã chạy
