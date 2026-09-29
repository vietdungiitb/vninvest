# VNInvest DSS Upgrade Plan (2026-04-05)

## 1) Muc tieu 6 thang
1. Khep kin vong lap quyet dinh: Tin hieu -> Khuyen nghi -> Thuc thi mo phong/that -> Do hieu qua -> Cai thien mo hinh.
2. Tang do tin cay cua AI Advisory bang du lieu hau kiem dinh luong.
3. Mo rong tu tu van ma le sang quan tri danh muc cap portfolio.
4. Chuan bi nen cho Brokerage Integration va Mobile MVP theo huong hanh dong nhanh.

## 2) Nguyen tac uu tien
1. Uu tien tinh nang tao bang chung hieu qua truoc tinh nang giao dien.
2. Uu tien kha nang kiem dinh va audit trail truoc tu dong hoa dat lenh.
3. Thiet ke mo du lieu ngay tu dau de tranh bi khoa boi mot nguon data.
4. Moi hang muc phai co KPI van hanh va KPI kinh doanh di kem.

## 3) Lo trinh 24 tuan (6 giai doan)

### Giai doan 0 (Tuan 1-2): Chuan hoa nen do luong
- Viec can lam:
  - Thiet ke bo su kien chuan cho lifecycle khuyen nghi.
  - Chuan hoa logging cho advisory, signal, execution simulation, user action.
  - Xay dashboard noi bo theo doi do tre, do chinh xac canh bao, ti le tuong tac.
- Ket qua ban giao:
  - Schema su kien thong nhat.
  - Dashboard van hanh dung duoc cho Product va Engineering.
  - Tai lieu dinh nghia KPI chuan.
- Exit criteria:
  - 100% khuyen nghi moi co ID theo doi xuyen suot.
  - Theo doi duoc conversion tu tin hieu sang hanh dong nguoi dung.

### Giai doan 1 (Tuan 3-6): Trading Journal tu dong + AI Scorecard
- Viec can lam:
  - Tu dong luu moi khuyen nghi AI kem ngu canh.
  - Tu dong chup ket qua T+1, T+3, T+5.
  - Xay scorecard: win rate, expectancy, max adverse excursion.
  - Phan tach hieu qua theo nganh, von hoa, trang thai thi truong.
- Ket qua ban giao:
  - Trading Journal tra cuu theo ma/chien luoc/thoi gian.
  - Bao cao do tin cay AI theo tung khung T+n.
- Exit criteria:
  - >=95% khuyen nghi co du lieu hau kiem.
  - Product tra loi ro nhom tin hieu hieu qua nhat/kem nhat.

### Giai doan 2 (Tuan 7-10): Dynamic ADV Thresholds + Screener nang cao
- Viec can lam:
  - Thay nguong co dinh bang nguong dong theo ADV 10 phien va bien dong tung ma.
  - Bo sung Screener theo RSI, MACD, breakout volume, cau truc xu huong.
  - Tao bo preset chien luoc de ap dung nhanh.
- Ket qua ban giao:
  - Giam canh bao rac o ma thanh khoan thap.
  - Tang ti le tin hieu co gia tri hanh dong.
- Exit criteria:
  - Giam >=30% false positive o nhom midcap/penny.
  - Tang ti le click vao tin hieu co xac suat thanh cong cao.

### Giai doan 3 (Tuan 11-14): Backtest UI ban thuc dung
- Viec can lam:
  - Cho tao rule tu dieu kien ky thuat pho bien.
  - Chay backtest va xuat KPI: CAGR, Max Drawdown, Win rate, Sharpe.
  - So sanh voi benchmark VNINDEX.
- Ket qua ban giao:
  - Backtest UI du dung cho nha dau tu ban chuyen.
  - Template chien luoc: trend, mean reversion, breakout.
- Exit criteria:
  - Tao va luu duoc 1 chien luoc trong <10 phut.
  - Ket qua backtest tai lap on dinh tren cung bo du lieu.

### Giai doan 4 (Tuan 15-18): Portfolio Rebalancing + Symbol Events Feed
- Viec can lam:
  - Engine goi y tai can bang danh muc theo rang buoc thi truong Viet Nam.
  - Rang buoc: ty trong toi da moi ma, thanh khoan, phi giao dich, gioi han vong quay.
  - Bo sung luong su kien theo ma: co tuc, DHDCD, tin tuc trong yeu.
- Ket qua ban giao:
  - Khuyen nghi portfolio cap quy va cap thang.
  - Co giai thich ly do tang/giam ty trong tung ma.
- Exit criteria:
  - >=90% quyet dinh phan bo co kha nang giai thich.
  - Xem duoc tac dong rui ro truoc/sau tai can bang.

### Giai doan 5 (Tuan 19-24): Sentiment + Broker Pilot + Mobile Decision MVP
- Viec can lam:
  - Sentiment Gauge tu tin tuc/dien dan, chuan hoa thanh chi so canh bao.
  - Broker pilot voi 1 doi tac theo mo hinh advisor-assisted (chua full auto).
  - Mobile MVP tap trung canh bao hanh dong, checklist truoc lenh, theo doi ket qua.
- Ket qua ban giao:
  - Decision cockpit tren mobile.
  - Luong dat lenh thi diem co audit day du.
- Exit criteria:
  - Giam thoi gian tu canh bao den hanh dong.
  - Khong phat sinh loi tuan thu trong pilot.

## 4) Workstream theo doi
1. Product/Quant:
   - Taxonomy tin hieu, gia thuyet chien luoc, tieu chi loai bo tin hieu yeu.
2. Data/Platform:
   - Data source abstraction, quality controls, replay test cho backtest.
3. Backend/AI:
   - Journal, scorecard, rebalancing service, explainability, feedback loop.
4. Frontend Web/Mobile:
   - UX quyet dinh va kiem dinh, toi gian thao tac.
5. Security/Compliance:
   - Song song Mail OAuth2, policy audit trail, danh gia phap ly broker.

## 5) KPI cap chuong trinh
1. Advisory credibility:
   - Ty le khuyen nghi co hau kiem T+1/T+3/T+5.
   - Win rate theo nhom tin hieu.
   - Expectancy on dinh theo che do thi truong.
2. Decision effectiveness:
   - Thoi gian tu tin hieu den hanh dong.
   - Ty le nguoi dung backtest truoc khi ap dung.
   - Ty le chap nhan khuyen nghi rebalancing.
3. System quality:
   - Do tre realtime p95 giu duoi nguong muc tieu.
   - Ty le loi pipeline du lieu va MTTR.
   - Ty le false positive canh bao dong tien.
4. Business outcomes:
   - Retention nguoi dung chu dong dau tu.
   - Ti le chuyen doi tinh nang DSS nang cao.
   - Muc do su dung Mobile Decision MVP hang tuan.

## 6) Rui ro va giam thieu
1. Rui ro chat luong du lieu:
   - Data contracts, monitoring drift, replay test dinh ky.
2. Rui ro overfit chien luoc:
   - Walk-forward validation, out-of-sample, benchmark bat buoc.
3. Rui ro phap ly broker:
   - Pilot gioi han chuc nang, xac nhan nhieu buoc, audit day du.
4. Rui ro qua tai pham vi:
   - Release theo capability nho, do duoc, lap nhanh.

## 7) Moc quyet dinh quan tri (Go/No-Go)
1. Cuoi Tuan 6: Mo rong AI Advisory dua tren scorecard thuc te.
2. Cuoi Tuan 10: Mo rong Screener cho toan bo nguoi dung.
3. Cuoi Tuan 14: Thuong mai hoa Backtest ban dau.
4. Cuoi Tuan 18: Mo pilot Rebalancing.
5. Cuoi Tuan 24: Mo rong Broker pilot.

## 8) Ghi chu van hanh
- Hang tuan cap nhat tinh trang theo 3 nhom: tien do, rui ro, quyet dinh can chot.
- Moi sprint ket thuc can co 1 trang ket qua: da dat, chua dat, hanh dong khac phuc.
- Dam bao tai lieu nay la tai lieu song, cap nhat lien tuc khi co thay doi roadmap.
