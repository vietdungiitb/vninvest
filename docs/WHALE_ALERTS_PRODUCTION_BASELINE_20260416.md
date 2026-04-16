# Whale Alerts Production Baseline - 2026-04-16

## 1. Muc tieu

- Dua trang `/whale-alerts/:symbol` len muc production-ready.
- Sua cac loi da audit theo thu tu uu tien root-cause truoc, UI sau.
- Giu nguyen cau truc chart hien tai, nhung bo sung kha nang an/hien indicator `MA20`, `MA50`.

## 2. Quyet dinh da chot voi user

1. RVOL: chon phuong an `1A`
   - Khong giu semantics cu.
   - Se tinh RVOL 15 phut dung nghia dua tren baseline bucket cung khung gio cua 20 phien gan nhat.

2. Localization: chon phuong an `2B`
   - Don dep toan bo text Anh-Viet con sot trong Whale Alerts dashboard scope.
   - Severity `Cực kỳ` doi thanh `Siêu cao`.

3. Dark money chart: `giu nguyen`
   - Khong doi cau truc pane/truc Y trong dot nay.
   - Co them toggle an/hien indicator `MA20`, `MA50`.

## 3. Pham vi bug phai xu ly trong dot nay

### P0 - Contract / correctness

- Whale feed timestamp co the sai do parse aware datetime sai trong backend.
- Whale feed display score bi anh huong vi decay dua tren tuoi event sai.
- RVOL hien tai khong dung nghia nghiep vu nhung dang duoc gan nhan RVOL.
- Dark money history can duoc seal ro metadata don vi gia de tranh drift contract.

### P1 - UX / presentation

- Severity extreme doi thanh `Siêu cao` va thong nhat mot nguon nhan.
- Whale feed can dedupe giua realtime stream va history snapshot.
- Whale Alerts dashboard can viet hoa/localize day du theo tieng Viet co dau.
- DarkMoneyMasterChart can cho phep an/hien `MA20`, `MA50`.

## 4. Thu tu thuc thi

### Slice A - Backend contract hardening

- Sua `_build_whale_order_payload(...)` de parse timestamp dung cho ca datetime aware va time-only.
- Uu tien dung helper parse intraday datetime thong nhat, khong parse thu cong lap lai.
- Dam bao `time` va `ts` cung sinh tu mot source datetime da normalize.
- Bo sung test regression cho whale feed timestamp.

### Slice B - RVOL 15m x 20 session baseline

- Backend `get_rvol(...)` se tinh:
  - `current_volume`
  - `baseline_avg`
  - `rvol`
  - `is_spike`
  - baseline dua tren cung bucket 15 phut cua 20 phien truoc.
- Neu du lieu lich su khong du, payload phai fail-soft minh bach, khong overclaim.
- Frontend doi copy va tooltip theo semantics moi.

### Slice C - Frontend dashboard cleanup

- Dedupe whale realtime va history feed.
- Chuan hoa severity label helper.
- Localize text trong scope Whale Alerts dashboard.
- Them toggle `MA20`, `MA50` cho DarkMoneyMasterChart.

### Slice D - Verify + audit

- Chay test backend/frontend lien quan.
- Manual verify cac path chinh tren Whale Alerts dashboard.
- Cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` voi file list + test evidence.
- Dong bo file list vao tai lieu audit trung tam theo governance.

## 5. Tieu chi done cua dot nay

- Whale orders hien dung gio event.
- Severity `extreme` hien thanh `Siêu cao` o toan bo Whale Alerts dashboard scope.
- Feed khong lap event giua realtime va history.
- Widget RVOL phan anh dung baseline 20 phien cung bucket 15 phut.
- Dark money chart co toggle `MA20`, `MA50` va khong lam vo luong hien tai.
- Audit ledger da cap nhat day du file list va bang chung verify.

## 6. File governance bat buoc khi hoan tat

- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `PROGRESS_DASHBOARD.md` hoac progress log tuong duong cua dot nay
- File audit/bao cao rieng cho Whale Alerts neu pham vi thay doi du lon
