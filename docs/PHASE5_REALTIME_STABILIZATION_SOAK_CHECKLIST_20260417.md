# Checklist Phase 5 - Realtime Stabilization Soak Test (2026-04-17)

## 1) Muc tieu
- Xac nhan canary cua Native Ticker Path + Pending Reclaim on dinh tren dev/staging.
- Chung minh giam pressure CPU/DB va khong gay regression contract payload.
- Chot gate release theo tieu chi pass/fail ro rang.

## 2) Pham vi canary
- Flag 1: REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED=True
- Flag 2: REALTIME_STREAM_PENDING_RECLAIM_ENABLED=True
- Muc tieu metrics theo dõi:
  - pending_depth (gauge theo consumer group)
  - reclaim_total (counter theo consumer group)
  - reclaim_errors_total (counter theo consumer group)

## 3) Chuan bi moi truong
- Dev:
  - Da set trong compose.dev.env:
    - REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED=True
    - REALTIME_STREAM_PENDING_RECLAIM_ENABLED=True
- Staging:
  - Neu chua co env file rieng, set 2 bien tren trong secret/env cua stack backend + worker.
  - Restart backend + stream worker sau khi cap nhat env.

## 4) Endpoint monitor
- JSON snapshot:
  - GET /api/realtime/ops/metrics/?output=json
- Prometheus text:
  - GET /api/realtime/ops/metrics/?output=prometheus
- Chuoi metrics can xac nhan:
  - vninvest_realtime_stream_pending_depth{group="db-writer|ws-broadcaster|alert-engine"}
  - vninvest_realtime_stream_reclaim_total{group="db-writer|ws-broadcaster|alert-engine"}
  - vninvest_realtime_stream_reclaim_errors_total{group="db-writer|ws-broadcaster|alert-engine"}

## 5) Quy trinh soak test (toi thieu 60 phut)
1. Warm-up 5 phut:
- Dam bao producer + 3 consumer groups dang chay.
- Xac nhan ticker WS van day du payload.

2. Load phien giao dich gia lap 45 phut:
- Bat websocket client fanout (nhieu symbol + nhieu user).
- Duy tri intraday tick ingestion lien tuc.
- Theo doi metrics moi 1-2 phut.

3. Fault injection 10 phut:
- Kill 1 stream worker trong luc co pending messages.
- Khoi dong lai worker.
- Xac nhan reclaim_total tang len, pending_depth giam ve muc on dinh.

## 6) Tieu chi pass/fail
- PASS khi tat ca dieu kien sau dung:
  - Khong co 500 moi tren endpoint realtime hot-path.
  - WS ticker payload contract khong thay doi schema.
  - pending_depth co xu huong hoi phuc sau fault injection.
  - reclaim_total tang khi co worker crash/restart.
  - reclaim_errors_total = 0 (hoac rat thap, co giai trinh ro rang).
  - CPU worker + Redis khong co dau hieu runaway.

- FAIL khi mot trong cac dieu kien sau xuat hien:
  - Tang dot bien 500/timeout trong canary window.
  - Reclaim khong hoat dong (reclaim_total khong tang du duoc fault injection).
  - pending_depth tang lien tuc, khong hoi phuc.
  - Regression payload/WS disconnect tang bat thuong.

## 7) Rollback nhanh
- Tat 2 flags canary:
  - REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED=False
  - REALTIME_STREAM_PENDING_RECLAIM_ENABLED=False
- Restart backend + stream workers.
- Xac nhan metrics va error-rate quay lai baseline.

## 8) Bang ghi ket qua (dien sau khi chay)
- Moi truong: dev / staging
- Thoi gian bat dau:
- Thoi gian ket thuc:
- So luong user/symbol gia lap:
- pending_depth (max/avg):
- reclaim_total (delta):
- reclaim_errors_total (delta):
- 500-rate:
- Ket luan: PASS / FAIL
- Ghi chu audit:
