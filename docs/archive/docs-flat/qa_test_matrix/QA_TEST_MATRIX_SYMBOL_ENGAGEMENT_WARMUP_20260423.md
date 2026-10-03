# QA Test Matrix - Symbol Engagement Warm-up (2026-04-23)

## 1) Muc tieu test
Xac nhan warm-up chi la lop dem an toan den scheduler cycle tiep theo, va hanh vi them symbol la dong nhat giua tracked/watchlist/holdings.

## 2) Test cases bat buoc

### TC01 - Tracked create khi chua co IntradayTick
- Precondition: Symbol X khong co IntradayTick phien hien tai.
- Action: Tao tracked symbol X.
- Expected:
  - enqueue warm-up task.
  - warm-up chay 1 lan.
  - co IntradayTick moi hoac co fail reason ro rang.

### TC02 - Watchlist create cung symbol ngay sau tracked
- Precondition: TC01 vua chay.
- Action: Them symbol X vao watchlist.
- Expected:
  - warm-up skip do lock hoac do fresh.
  - khong co task duplicate chay song song.

### TC03 - Holdings create khi symbol da fresh
- Precondition: Symbol X da co ticks fresh.
- Action: Mo vi the holdings cho X.
- Expected:
  - warm-up skip do fresh.
  - metrics tang vao nhom skipped_fresh.

### TC04 - Nhieu user add cung symbol dong thoi
- Precondition: Symbol Y stale/missing.
- Action: 5 requests create engagement dong thoi.
- Expected:
  - toi da 1 warm-up execution cho symbol/day.
  - cac request con lai skip lock.

### TC05 - Provider timeout
- Precondition: Gia lap loi provider intraday.
- Action: Tao engagement cho symbol Z.
- Expected:
  - task retry theo policy.
  - sau max retry, ghi failed voi reason.
  - khong anh huong transaction API create.

### TC06 - Scheduler handoff
- Precondition: Warm-up da chay thanh cong cho symbol X.
- Action: Cho scheduler cycle tiep theo chay.
- Expected:
  - scheduler tiep quan binh thuong.
  - khong duplicate storm.

### TC07 - Delete engagement
- Precondition: Symbol X dang duoc engage boi nhieu source.
- Action: Xoa 1 source engagement.
- Expected:
  - khong trigger warm-up nguoc.
  - hanh vi scheduler/universe on dinh.

### TC08 - Audit/observability completeness
- Action: Lay metrics + logs sau bo test.
- Expected:
  - co du counter cho activated/enqueued/skipped/success/failed.
  - logs co symbol, source, reason, result.

## 3) Non-functional checks
- Queue latency khong tang dot bien.
- Database writes khong co duplicate bat thuong.
- Khong co memory leak do lock key treo.

## 4) Mau bao cao ket qua
- Build version:
- Test environment:
- Tester:
- Run date:
- TC PASS:
- TC FAIL:
- Defects:
- Ket luan go/no-go:
