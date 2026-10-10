# Admin UI Implementation Steps (Sprint 10)

Muc tieu:
- Trinh bay Trang quan tri Django theo so do chuc nang he thong.
- Tang tinh truc quan de PM/BA/Dev co the nhin ngay trang thai va du lieu van hanh.
- Dam bao quy trinh: luu cac buoc truoc khi viet code.

## Pham vi

Backend:
1. Chuan hoa admin registrations theo module chuc nang.
2. Them custom context cho dashboard admin.
3. Xu ly tong hop du lieu bang Pandas cho cac insight card.

Frontend (Django admin template):
1. Tao bo cuc card chuc nang.
2. Hien thi quick stats va data insights.
3. Toi uu theo luong su dung van hanh.

## Nhat ky buoc da thuc hien

### Buoc 1 - Audit hien trang admin
- Doc models va admin registrations.
- Phat hien khai bao inline trung lap va mot so model chua duoc uu tien hien thi theo flow nghiep vu.

Ket qua:
- Xac dinh danh sach model can sap xep theo 3 nhom: Portfolio Tracker, Market Watch, Data Hub.

### Buoc 2 - Refactor admin.py theo so do chuc nang
- Don dep code dang ky admin.
- Bo sung registration cho cac model van hanh quan trong.
- Dat site_header/site_title/index_title ro nghia quan tri he thong.

Ket qua:
- Admin menu ro rang, nhat quan theo flow nghiep vu.

### Buoc 3 - Tao admin index map truc quan
- Tao template `portfolio/templates/admin/index.html`.
- Them card dieu huong nhanh theo module chuc nang.

Ket qua:
- Trang chu admin tro thanh ban do chuc nang, khong chi la danh sach model mac dinh.

### Buoc 4 - Bo sung quick stats
- Them thong ke nhanh: portfolio, subaccount, transaction, transaction hom nay, tracked symbols, stock profiles, daily prices.

Ket qua:
- Co dashboard van hanh co ban ngay tren admin home.

### Buoc 5 - Tich hop Pandas cho xu ly du lieu
- Lay du lieu giao dich 90 ngay va du lieu cap nhat gia gan nhat.
- Dung Pandas de:
  - Tong hop top ma theo turnover.
  - Tong hop co cau turnover theo transaction_type.
  - Tinh do tuoi du lieu gia (fresh/warning/stale).

Ket qua:
- Dashboard co khoi insight du lieu thuc te, khong chi hien thi dem ban ghi.

### Buoc 6 - Validation
- Chay `python manage.py check`.
- Kiem tra loi static va syntax tren file da thay doi.

Ket qua:
- Khong co loi cau hinh.

## Tieu chuan truoc khi code buoc tiep theo

1. Cap nhat tai lieu buoc thuc hien vao file nay.
2. Chot ket qua mong doi cho buoc tiep theo.
3. Moi tiep tuc code.

## Buoc thuc hien tiep theo (yeu cau moi)

### Buoc 7 - Phan cap menu quan tri theo so do chuc nang
- Van de hien tai: menu admin mac dinh chi gom app-level (`Quản lý Danh mục Đầu tư`, `Xác thực và Ủy quyền`), chua phan cap theo module he thong.
- Muc tieu:
  1. Tach model thuoc app `portfolio` thanh nhieu nhom chuc nang hien thi trong admin menu.
  2. Dam bao nhin menu la thay ngay cau truc he thong: Portfolio Tracker, Market Watch, Data Hub, Cau hinh he thong.
  3. Van giu nguyen quyen truy cap model va URL admin goc.

Ket qua mong doi:
- Admin home (va navigation sidebar) hien thi day du cac nhom chuc nang thay vi don app-level.

### Buoc 8 - Chuan hoa naming convention cho menu
- Muc tieu: toan bo menu dung chung mot quy uoc dat ten, tranh tron tieng Anh/Viet va tranh trung nghia.
- Quy uoc:
  1. Tieu de nhom: co thu tu 01/02/03/04.
  2. Ten model menu: uu tien mo ta nghiep vu thay vi ten ky thuat.
  3. Nhom `auth` cung duoc Viet hoa cung style voi cac nhom Portfolio.

Ket qua mong doi:
- Nhin menu la thay ngay cau truc phan cap va ten chuc nang nhat quan.

### Buoc 9 - Can chinh quan he nghiep vu Watchlist
- Phan hoi tu nghiep vu: 3 muc `Mã theo dõi cá nhân`, `Nhóm watchlist`, `Mã trong watchlist` dang gay hieu nham la 3 chuc nang doc lap.
- Dinh huong chuan hoa:
  1. Luong chinh la `Nhóm theo dõi cá nhân -> Mã theo dõi trong nhóm`.
  2. `TrackedSymbol` duoc doi nhan thanh danh sach tong hop (phat sinh/duy tri tu luong theo doi), khong dat ten nhu 1 module ngang cap.
  3. Sap thu tu menu de phan anh dung quan he tren.

Ket qua mong doi:
- Nguoi dung doc menu se hieu ngay cau truc theo doi theo nhom va danh sach tong hop ca nhan.

### Buoc 10 - To chuc menu dang cay cha con
- Yeu cau moi: menu quan tri can hien thi theo cay cha-con de nhin ro phan cap chuc nang.
- Cach lam:
  1. Hien thi tung nhom module (cha) va cac model thuoc module (con).
  2. Tai menu tong quan chi giu link vao trang danh sach model.
  3. Khong hien thi cac nut thao tac Add/Change/Delete o menu tong quan; cac thao tac nay duoc thuc hien ben trong trang model tuong ung.

Ket qua mong doi:
- Menu admin gon, de doc, dung phan cap.
- Luong thao tac ro rang: vao trang model roi moi them/sua/xoa.

### Buoc 11 - Chuan hoa thuat ngu de tach ro 2 lop nghiep vu
- Van de moi duoc xac nhan trong qua trinh demo:
  1. `Nhóm theo dõi cá nhân / Mã theo dõi trong nhóm` va `Nhóm chứng khoán / Mã trong nhóm` de gay nham la 2 bo chuc nang trung nhau.
  2. Tren frontend Watchlist, nguoi dung thay sidebar va heading nhung chua thay duoc y nghia nghiep vu cua tung lop.
- Dinh huong chuan hoa truoc khi code:
  1. Lop `SecuritiesGroup / SecuritiesItem` duoc dinh vi la `Nhóm thị trường / Mã trong nhóm thị trường` de phuc vu quet rong theo nganh, von hoa, chu de.
  2. Lop `WatchlistGroup / WatchlistItem` duoc dinh vi la `Danh sách theo dõi cá nhân / Mã trong danh sách` de phuc vu shortlist rieng cua tung nguoi dung.
  3. `TrackedSymbol` tiep tuc duoc giu vai tro `Danh sách theo dõi tổng hợp`, nghia la tap hop cac ma dang duoc theo doi nhanh tren giao dien realtime.
  4. Frontend can co mot khoi mo ta ngan ngay tren trang de nguoi dung doc la hieu tac dung cua moi lop du lieu.

Ket qua mong doi:
- Admin menu, admin home va frontend Watchlist su dung cung mot he thuat ngu.
- Nguoi dung phan biet duoc ngay: `Nhóm thị trường` la bo quet rong, `Danh sách theo dõi cá nhân` la bo shortlist cua rieng ho.

### Buoc 12 - Day thao tac tu nhom thi truong sang danh sach theo doi ca nhan
- Yeu cau moi:
  1. Tu moi ma trong `Nhóm thị trường`, nguoi dung can them ngay vao `Danh sách theo dõi cá nhân` ma khong can doi view.
  2. Cac nhan ky thuat con sot trong admin detail pages can doi theo cung he thuat ngu moi.
- Cach lam truoc khi code:
  1. Them action `Đưa vào danh sách theo dõi cá nhân` ngay tren bang chi tiet cua `Nhóm thị trường`.
  2. Hien thi ro trang thai `Đã theo dõi` neu ma da nam trong shortlist ca nhan.
  3. Chuan hoa `verbose_name`, `verbose_name_plural`, nhan field va inline labels cho 5 model lien quan:
     - SecuritiesGroup
     - SecuritiesItem
     - WatchlistGroup
     - WatchlistItem
     - TrackedSymbol

Ket qua mong doi:
- Luong su dung tro nen ro rang: quet rong -> chon ma -> dua vao shortlist ca nhan.
- Admin detail pages khong con xen ke thuat ngu cu va moi.

### Buoc 13 - Day nhanh thao tac hang loat va bo loc trang thai theo doi
- Yeu cau moi:
  1. Tu mot `Nhóm thị trường`, nguoi dung co the dua nhieu ma vao shortlist ca nhan trong mot thao tac.
  2. Nguoi dung can biet ngay ma nao da duoc theo doi va ma nao chua duoc theo doi.
- Cach lam truoc khi code:
  1. Them action `Đưa tất cả mã của nhóm vào danh sách theo dõi cá nhân` o header cua bang chi tiet nhom.
  2. Them bo loc `Tat ca / Chua theo doi / Da theo doi` de loc item trong bang.
  3. Tinh toan so ma con co the them, tranh goi lai voi cac ma da ton tai trong shortlist.

Ket qua mong doi:
- Nguoi dung co the quet mot nhom thi truong va dua nhanh shortlist vao danh sach theo doi ca nhan.
- Trang thai theo doi cua tung ma tro nen ro rang, khong can so sanh thu cong.

### Buoc 14 - Cho phep thao tac nguoc va hien bo dem theo trang thai
- Yeu cau moi:
  1. Neu mot ma da nam trong shortlist, nguoi dung co the bo no ra ngay tai bang `Nhóm thị trường`.
  2. Bo loc `Tat ca / Chua theo doi / Da theo doi` can hien so luong de nhin nhanh quy mo tung nhom.
- Cach lam truoc khi code:
  1. Anh xa `symbol -> tracked item` tren frontend de co the goi xoa truc tiep.
  2. Hien thi nut `Bo khoi DS ca nhan` ngay tren dong da theo doi.
  3. Tinh bo dem cho tung filter de nguoi dung thay ngay phan bo theo doi trong nhom.

Ket qua mong doi:
- Nguoi dung co the them va bo khoi shortlist ngay trong cung mot bang.
- Watchlist tro thanh man hinh van hanh hoan chinh cho luong quet rong -> shortlist -> loai bo.

### Buoc 15 - Hoan tat thao tac hang loat hai chieu tren nhom thi truong
- Yeu cau moi:
  1. Neu ca mot `Nhóm thị trường` da co nhieu ma nam trong shortlist, nguoi dung can bo nhanh ca nhom ra khoi `Danh sách theo dõi cá nhân`.
  2. Header cua bang chi tiet nhom can co du ca hai huong thao tac: them hang loat va bo hang loat.
- Cach lam truoc khi code:
  1. Tinh danh sach tracked item cua `activeGroup` tu `trackedSymbolMap` de goi xoa theo `id` hien co.
  2. Them action `Bo tat ca ma da theo doi khoi DS ca nhan` o header bang nhom.
  3. Chi enable nut khi nhom hien tai thuc su co ma dang theo doi, dong thoi hien thong bao ket qua sau khi hoan tat.

Ket qua mong doi:
- Man hinh `Radar thị trường` co du thao tac hang loat hai chieu: them nhanh va bo nhanh.
- Nguoi dung khong can chuyen qua view `Danh sách theo dõi cá nhân` de don shortlist khi mot nhom khong con uu tien.

## Huong lam tiep de uu tien

### Buoc ke tiep da chot se lam
- Muc tieu: gom logic realtime dang lap lai giua `Watchlist` va `Dashboard` thanh mot hook/service dung chung.
- Pham vi du kien:
  1. Tao hook `useRealtimeFeed` de quan ly websocket, fallback polling, subscribe symbols va reconnect state.
  2. Chuyen `frontend/src/pages/Watchlist.jsx` sang dung hook chung thay cho logic noi truc tiep trong page.
  3. Chuyen `frontend/src/components/DashboardRealtimePanel.jsx` sang dung cung hook de dong nhat contract realtime.
  4. Giu nguyen hanh vi hien tai: connection status, last event timestamp, whale alert gan nhat va fallback polling.
- Ket qua mong doi:
  - Giam lap code realtime giua hai man hinh chinh.
  - De mo rong stale handling, observability va Redis-backed hardening trong Sprint 12.

### Buoc 16 - Tach layer realtime frontend dung chung
- Yeu cau moi:
  1. Logic websocket/polling trong `Watchlist` va `DashboardRealtimePanel` dang trung lap va kho mo rong.
  2. Cac tinh nang tiep theo nhu realtime P/L, price alerts, whale alert history va observability can mot diem gom logic duy nhat.
- Cach lam truoc khi code:
  1. Tao hook `useRealtimeFeed` trong `frontend/src/hooks/` de quan ly socket, polling fallback, parse event va state chung.
  2. Refactor `Watchlist.jsx` va `DashboardRealtimePanel.jsx` sang su dung hook nay, khong tu mo socket rieng nua.
  3. Overlay quote realtime len du lieu goc thay vi mutate truc tiep tung state domain de giam coupling.
  4. Giu nguyen contract hien tai: `ticker_update`, `whale_alert`, `heartbeat`, `realtimeStatus`, `lastEventAt`.

Ket qua mong doi:
- Watchlist va Dashboard dung chung mot lop realtime frontend.
- Giam code lap, de them metrics/stale/alert UX o cac buoc tiep theo.

### Buoc 17 - Bo sung gia tri danh muc va P/L gan realtime tren Dashboard
- Yeu cau moi:
  1. Sau khi da co `useRealtimeFeed`, Dashboard can hien thi tong gia tri danh muc va unrealized P/L gan realtime cho cac ma dang nam giu.
  2. Khong duoc mo them mot ket noi realtime rieng chi de tinh P/L, tranh duplicate websocket tren cung man hinh.
- Cach lam truoc khi code:
  1. Tai su dung `quotesBySymbol` ben trong `DashboardRealtimePanel` de overlay gia realtime len danh sach holdings hien co.
  2. Tinh lai `market_value`, `unrealized_pl`, `unrealized_pl_pct` tren frontend cho muc dashboard realtime, co fallback ve gia snapshot neu chua co quote moi.
  3. Hien thi them cac card `Gia tri gan realtime`, `P/L chua chot gan realtime`, `Do lech so voi snapshot`, `So vi the stale`.

Ket qua mong doi:
- Dashboard co them lop nhin gia tri danh muc dong hon ma khong can doi backend API moi.
- Nen tang san sang cho buoc tiep theo: price alerts va observability theo cung feed realtime.

### Buoc 18 - Mo rong domain cho user-defined price alerts
- Yeu cau moi:
  1. Sau khi Dashboard da co gia tri/P-L gan realtime, he thong can cho phep nguoi dung dat nguong gia theo tung ma.
  2. Hien tai codebase chua co model/API rieng cho price alerts, vi vay can mo rong domain truoc khi gan vao realtime pipeline.
- Cach lam truoc khi code:
  1. Tao model `PriceAlertRule` hoac ten tuong duong gom: `user`, `symbol`, `condition`, `target_price`, `cooldown_seconds`, `is_active`, `last_triggered_at`.
  2. Mo API CRUD toi thieu de frontend co the tao/sua/xoa danh sach canh bao.
  3. Noi evaluator vao realtime task/feed de phat event khi gia vuot nguong va ton trong cooldown.
  4. Chon vi tri UI phu hop, uu tien ngay tren Watchlist/Realtime panel truoc khi mo rong ra notification center.

Ket qua mong doi:
- User dat duoc canh bao `vuot gia` / `roi duoi gia` cho cac ma dang quan tam.
- Nen tang du lieu san sang cho cac buoc sau: notification center, Telegram, lich su canh bao.

### Buoc 19 - Tu dong hoa sync cho tai san dang theo doi
- Yeu cau moi:
  1. Sau khi da co tracked symbols, watchlist va price alerts, he thong can co co che tu dong lam moi gia cho cac ma dang duoc theo doi.
  2. Khong chi sync `Nhóm thị trường`, ma can lay hop nhat symbol tu `Nhóm thị trường`, `Danh sách theo dõi cá nhân` va `Danh sách mã theo dõi tổng hợp`.
- Cach lam truoc khi code:
  1. Mo rong `sync_watchlist_prices()` de lay union symbol tu ca 3 nguon user dang quan tam.
  2. Them Celery task `sync_user_watch_assets` va `sync_all_watch_assets` de co the chay theo user hoac toan he thong.
  3. Them cau hinh `WATCHLIST_SYNC_ENABLED`, `WATCHLIST_SYNC_MINUTES`, `WATCHLIST_SYNC_DAYS` vao settings/.env.example.
  4. Them management command `sync_watch_assets` de local/staging co the chay tay hoac dispatch qua worker.

Ket qua mong doi:
- Auto-sync cho watch assets co the bat/tat bang config va chay duoc qua Celery Beat.
- Nen tang da san sang cho buoc hardening van hanh va observability tiep theo.

### Buoc 20 - Dung nen tang stock detail workspace
- Yeu cau moi:
  1. Modal chi tiet ma hien tai chi du de xem ho so tinh, chua dat muc tieu workstation cho tung ma co top panel, chart va context theo doi.
  2. Can co route rieng de nguoi dung di tu Dashboard/Watchlist vao mot khong gian phan tich ma, thay vi giu chi tiet trong modal tam.
- Cach lam truoc khi code:
  1. Them API `overview` cho tung ma, hop nhat ho so tinh, gia gan nhat, bien dong, range 52 tuan va context user (`tracked`, nhom thi truong, danh sach theo doi ca nhan).
  2. Them API `chart` cho tung ma de frontend lay chuoi gia EOD theo khung thoi gian 30/90/180/365 ngay.
  3. Tao route frontend `/stocks/:symbol` va trang `StockDetail` gom top panel, chart nen tang va khoi context theo doi cua nguoi dung.
  4. Chuyen luong dieu huong tu Watchlist/Dashboard sang trang chi tiet ma thay cho modal cu.

Ket qua mong doi:
- He thong co stock detail foundation page dung nghia, san sang cho cac phase technical workspace va intraday intelligence tiep theo.
- Luong dieu huong tu cac man hinh chinh vao chi tiet ma duoc thong nhat.

### Buoc 21 - Day thao tac theo doi truc tiep vao stock workspace
- Yeu cau moi:
  1. Sau khi da co stock workspace route rieng, nguoi dung khong nen phai quay lai Watchlist chi de them/xoa khoi shortlist hoac dua ma vao danh sach theo doi ca nhan.
  2. Trang chi tiet hien moi chi doc du lieu, chua co kha nang thao tac nghiep vu tai cho.
- Cach lam truoc khi code:
  1. Mo rong `overview` de tra ve `tracked_symbol_id`, danh sach group thi truong co `id`, va danh sach membership cua tung `Danh sách theo dõi cá nhân` gom `group_id`, `group_name`, `item_id`.
  2. Tai frontend stock workspace, tai them danh sach `Danh sách theo dõi cá nhân` co san de nguoi dung chon group can them ma.
  3. Them action tai cho: `Đưa vào shortlist`, `Bỏ khỏi shortlist`, `Thêm vào danh sách theo dõi cá nhân`, `Bỏ khỏi danh sách` va refresh lai overview sau thao tac.

Ket qua mong doi:
- Stock workspace tro thanh diem thao tac chinh cho tung ma, khong con la man hinh chi de xem.

### Buoc 22 - Chuyen `Nhóm thị trường` sang taxonomy dung chung toan he thong
- Yeu cau moi:
  1. `Nhóm thị trường` duoc dong bo tu thi truong chung khoan nen khong can nhan ban theo tung user.
  2. Thiet ke hien tai dang duplicate `SecuritiesGroup` theo user, lam tang du lieu trung lap va lam admin/sync phuc tap hon can thiet.
- Cach lam truoc khi code:
  1. Chuyen `SecuritiesGroup` thanh model dung chung, bo rang buoc `user` va gop cac nhom trung nhau thanh mot taxonomy toan he thong.
  2. Giu cac lop du lieu ca nhan theo user nhu cu: `TrackedSymbol`, `WatchlistGroup`, `WatchlistItem`, `PriceAlertRule`.
  3. Refactor service sync nhom thi truong thanh sync global, chi ghi `requested_by/target_user` vao log de audit thay vi tao du lieu rieng theo user.
  4. Chuyen API nhom thi truong sang huong read-only cho client thuong; cac thao tac cap nhat taxonomy di qua admin sync.
  5. Them migration de hop nhat du lieu nhom thi truong trung lap, remap `TrackedSymbol.source_group`, sau do moi bo cot `user`.

Ket qua mong doi:
- `Nhóm thị trường` tro thanh bo taxonomy dung chung, khong con ban sao theo user.
- Luong frontend khong doi ban chat: user van quet nhom thi truong, dua ma vao shortlist/watchlist ca nhan nhu cu.
- Admin/log/sync gon hon va dung voi nghiep vu thi truong du lieu dung chung.

### Buoc 24 - Don API helper cu va khoa chinh sua tay taxonomy trong Admin
- Yeu cau moi:
  1. Sau khi `Nhóm thị trường` da tro thanh read-only taxonomy, cac helper frontend `create/update/delete` va `add/delete item` cho nhom thi truong khong con phu hop va de bi goi nham.
  2. Django Admin chi nen cho phep xem taxonomy va bam sync, khong cho phep them/sua/xoa tay.
- Cach lam truoc khi code:
  1. Xoa cac helper frontend cho ghi du lieu `Nhóm thị trường`, chi giu cac ham doc/sync dang duoc su dung.
  2. Chuyen `SecuritiesGroupAdmin` va `SecuritiesItemAdmin` sang che do view-only: tat add/change/delete thu cong, giu changelist va nut sync.
  3. Dat inline item o che do read-only de nguoi van hanh co the xem taxonomy ma khong chinh sua truc tiep.
  4. Them regression test de dam bao admin khong cho POST chinh sua tay taxonomy.

Ket qua mong doi:
- Frontend khong con API helper sai nghiep vu cho taxonomy dung chung.
- Admin phan biet ro hai luong: xem/sync du lieu thi truong va chinh sua cac domain ca nhan.

### Buoc 22 - Bo sung technical summary nen tang cho stock workspace
- Yeu cau moi:
  1. Phase tiep theo cua stock workspace can co lop technical workspace co ban, nhung chua can order book hay intraday feed moi.
  2. Khong nen de frontend tu tinh lan man tu nhieu nguon; can co mot payload technical nhat quan tu backend.
- Cach lam truoc khi code:
  1. Tinh cac chi bao co ban tren chuoi EOD da co: `SMA20`, `SMA50`, `RSI14`, `avg_volume_20`, `20d momentum`, `gia vs SMA20/50`, `vi tri trong range 52 tuan`.
  2. Tra technical summary ngay trong endpoint chart hoac payload lien quan de frontend render cung chart.
  3. Tren stock workspace, them panel technical summary va mot dong nhan dinh nhanh (`bullish/neutral/weak`) dua tren quan he gia voi SMA va RSI.

Ket qua mong doi:
- Stock workspace duoc nang cap tu foundation page thanh technical workspace phase 1, van tan dung du lieu EOD hien co.

### Buoc 23 - Dua dong bo Nhom thi truong vao Django Admin
- Yeu cau moi:
  1. Nguoi van hanh can bam duoc `Dong bo Nhom thi truong tu vnbroker` ngay trong Django Admin, khong phai chay command rieng.
  2. Can ho tro ca 2 luong: dong bo cho mot user cu the va dong bo toan he thong.
  3. Admin home can hien thi `lan dong bo gan nhat`, ket qua, canh bao fallback/manual va thong bao thanh cong that bai ngay sau khi bam.
- Cach lam truoc khi code:
  1. Tao mot service dong bo dung chung de command, API va Admin khong bi tach logic.
  2. Them bang log dong bo de luu `scope`, `target_user`, `requested_by`, `success`, `message`, `error`, thong ke so nhom/so ma va moc thoi gian.
  3. Gan custom admin view + button tren admin home va admin changelist cua `Nhom thi truong`.
  4. Them admin action sync theo tap user suy ra tu cac dong `Nhom thi truong` duoc chon.

Ket qua mong doi:
- Django Admin tro thanh diem van hanh hoan chinh cho dong bo `Nhom thi truong`.
- Nguoi van hanh bam sync xong se thay ket qua va trang thai ngay tren admin page.

### Buoc 24 - Mo rong Admin sync cho Ho so ma chung khoan va log chi tiet hon
- Yeu cau moi:
  1. Can co nut sync tuong tu cho `Ho so ma chung khoan` trong Django Admin, khong de flow van hanh bi lech giua `Nhom thi truong` va `StockProfile`.
  2. Trang log dong bo can de doc hon: thay ro `mode`, `started_at`, `finished_at`, `thoi gian chay` va co bo loc phu hop.
- Cach lam truoc khi code:
  1. Tao service dong bo `StockProfile` dung chung cho command, API va Admin.
  2. Them bang log rieng cho `StockProfile sync` de hien thi trang thai va lich su tuong tu `Nhom thi truong`.
  3. Them custom admin route + button tren admin home va changelist `Ho so ma chung khoan`.
  4. Nang cap admin log pages de hien `duration`, `date_hierarchy` va filter `mode/source/success` ro rang.

Ket qua mong doi:
- Admin co du 2 luong sync van hanh: `Nhom thi truong` va `Ho so ma chung khoan`.
- Trang log dong bo de audit hon, nhin phat biet ngay mode va thoi gian chay.

### Buoc tiep theo A - Bo loc khung thoi gian insight
- Them option 30/90/180 ngay cho khoi Pandas insights.
- Truyen qua query param tren admin index.

### Buoc tiep theo B - Canh bao du lieu stale
- Neu stale vuot nguong, hien canh bao mau do o dau trang.

### Buoc tiep theo C - Action nhanh van hanh
- Them quick links cho luong admin-sync/seed/sync gia.

## Runbook xoa cache va khoi dong lai

Muc tieu:
- Dam bao giao dien admin hien thi ban moi nhat sau khi thay doi template/context.

Trinh tu thuc hien:
1. Xoa cache backend:
  - Xoa toan bo thu muc `backend/**/__pycache__`
  - Xoa file `backend/**/*.pyc` va `backend/**/*.pyo`
2. Xoa cache frontend:
  - Xoa `frontend/node_modules/.cache`
  - Xoa `frontend/build` (neu co)
3. Kiem tra backend:
  - Chay `python manage.py check`
4. Khoi dong lai dich vu:
  - Backend: `python manage.py runserver 0.0.0.0:8000`
  - Frontend: `npm start`
5. Neu frontend bao port 3000 dang dung:
  - Stop process dang listen tren port 3000
  - Chay lai `npm start`
6. Xac nhan dich vu:
  - Port 8000 dang listen (python)
  - Port 3000 dang listen (node)

Luu y:
- Neu trinh duyet van hien giao dien cu, can hard refresh (Ctrl + F5) de bo qua browser cache.

## Files lien quan

- backend/portfolio/admin.py
- backend/portfolio/templates/admin/index.html
- docs/ADMIN_UI_IMPLEMENTATION_STEPS.md

### Buoc 25 - Tao man hinh thong tin chi tiet ma co phieu tren Django Admin
- Yeu cau moi:
  1. Backend admin can co mot man hinh `thong tin chi tiet ma co phieu` de nguoi van hanh xem nhanh ho so ma, gia gan nhat, ky thuat co ban va context quan sat he thong.
  2. Man hinh nay phuc vu van hanh/noi bo, khong can giong 100% frontend trading workspace nhung phai day thong tin va de doc trong admin.
- Cach lam truoc khi code:
  1. Them custom admin route cho tung `StockProfile`, duong dan tu changelist va change form.
  2. Tai su dung du lieu san co: `StockProfile`, `DailyPrice`, `SecuritiesGroup`, `TrackedSymbol`, `WatchlistItem`, va technical summary EOD.
  3. Render mot admin template rieng gom: header thong tin ma, gia/phan tram thay doi, sparkline EOD, technical snapshot, nhom thi truong lien quan, thong ke tracked/watchlist va bang gia gan nhat.
  4. Them regression test cho route admin moi de dam bao co the mo chi tiet ma tu backend.

Ket qua mong doi:
- Django Admin co man hinh chi tiet ma co phieu dung cho van hanh backend.
- Nguoi van hanh co the di tu danh sach `Ho so ma chung khoan` vao mot workspace thong tin day du hon change form mac dinh.

### Buoc 26 - Hoan thien tieng Viet va dieu huong nhanh cho workspace ma tren Admin
- Yeu cau moi:
  1. Man hinh chi tiet ma tren backend admin can hien thi day du tieng Viet, khong de lai cac nhan English/ASCII dang do.
  2. Nguoi van hanh can di thang tu `Nhóm thị trường` hoac `Dữ liệu giá hàng ngày` sang workspace backend cua ma tuong ung.
  3. Workspace backend can co them panel chart nen EOD de giong man hinh trading hon, khong chi la sparkline.
- Cach lam truoc khi code:
  1. Viet hoa lai tieu de, nhan panel, nhan thong ke va thong bao tren template workspace.
  2. Them cot/link `Mo workspace` cho `SecuritiesItem` va `DailyPrice`, dong thoi them link ngay tren inline cua `Nhóm thị trường`.
  3. Tai backend admin workspace, tinh bo du lieu nen OHLC tu `DailyPrice` va render mini candlestick chart bang SVG/CSS don gian.
  4. Cap nhat regression test de xac nhan route workspace van mo duoc va giao dien moi co noi dung tieng Viet + panel nen.

Ket qua mong doi:
- Man hinh backend chi tiet ma doc tu nhien hon voi nguoi van hanh Viet Nam.
- Luong dieu huong tu du lieu thi truong sang workspace nhanh hon.
- Workspace backend gan hon giao dien trading mau ve mat mat do va kieu hien thi gia.

### Buoc 27 - Dong bo nhan bias ky thuat tieng Viet giua backend API va frontend
- Yeu cau moi:
  1. Frontend stock workspace va backend admin khong nen tu dich rieng `BULLISH/WEAK/NEUTRAL`, tranh lech nhan va mo ta.
  2. API chart can tra ve san `nhan tieng Viet` va `mo ta` cho bias ky thuat de frontend dung truc tiep.
- Cach lam truoc khi code:
  1. Giu truong `bias` dang code ky thuat de khong pha contract cu.
  2. Bo sung `bias_label`, `bias_description` vao payload `technical` tu backend.
  3. Refactor frontend `StockDetail` sang uu tien dung `bias_label`/`bias_description`, chi fallback ve mapping local neu payload cu chua co.
  4. Cap nhat regression test API de xac nhan backend tra ve nhan tieng Viet moi.

Ket qua mong doi:
- Frontend va backend admin dung cung mot he nhan ky thuat.
- Viec doi ngon ngu hoac chuan hoa thuat ngu ve sau se di qua backend context/API, khong lap lai tren UI.

### Buoc 28 - Nen giao dien Stock workspace theo kieu trading screen mat do cao
- Yeu cau moi:
  1. Giao dien chi tiet ma tren frontend can giong man hinh trading hon, hien thi duoc nhieu thong tin hon trong mot khung hinh.
  2. Can giam khoang trang, tang mat do du lieu va chia ro 3 vung: header quote, chart trung tam, cot phai thong tin/lenh/ngu canh.
- Cach lam truoc khi code:
  1. Refactor `StockDetail.jsx` thanh layout full-width hon, header compact hon va co quote matrix dang trading terminal.
  2. Them panel ben phai cho `do sau gia lap` va `dong lenh gia lap` dua tren gia hien tai/khung EOD de giao dien gan hon mau.
  3. Nen cac khoi `tracked/watchlist/technical/context` thanh card compact, giam margin/padding va sap xep lai theo uu tien quan sat.
  4. Giu nguyen cac action nghiep vu hien co (`shortlist`, `watchlist`, `alert`) nhung dua vao bo cuc gon hon.

Ket qua mong doi:
- Stock workspace co mat do thong tin day hon, doc theo kieu trading dashboard.
- Nguoi dung thay duoc nhieu context hon ma khong phai cuon ngay tu man hinh dau tien.

### Buoc 29 - Tinh chinh Stock workspace thanh bo cuc trading terminal chat hon
- Yeu cau moi:
  1. Sau khi da co huong trading screen, man frontend van can duoc nen tiep de header, chart, do sau va technical nam gon trong viewport dau tien.
  2. Cac thao tac `shortlist/watchlist/alert` can nam trong mot action strip lien mach thay vi tach thanh nhieu khoi roi.
- Cach lam truoc khi code:
  1. Thay layout hero-card cu bang quote board compact: gia hien tai, thay doi, tham chieu, tran/san, range ngay, 52 tuan, khoi luong, trang thai feed.
  2. Dua thanh action vao mot strip duy nhat ben duoi quote board.
  3. Tai cot phai, bo tri `do sau gia lap`, `dong lenh gia lap`, `tom tat ky thuat`, `ngu canh theo doi` theo thu tu uu tien trading.
  4. Giam padding/margin, mo rong max width va giu chart la tam nhin chinh cua man hinh.

Ket qua mong doi:
- Man hinh `Stock workspace` nhin sat phong cach terminal trading hon.
- Mat do thong tin tang ro ma van giu duoc cac action nghiep vu dang co.

### Buoc 30 - Doi chart area sang kien OHLC va them mini breadth peer stocks
- Yeu cau moi:
  1. Thay the Area chart bang chart nen nhat thuc tung diem OHLC: component nien hien thi open/high/low/close qua nhung que nho.
  2. Them mini breadth panel cho cap co phieu cung nhom thi truong: hien thi performance relative cua nhung ma peer tren cung nhom phan thanh heatmap trang thai tang/yeu.
  3. Tinh chinh theme CSS va typography cho trading terminal: font-size nho hon, color scheme tu nen slate/dark -> cyan/emerald/rose chi bao hieu suay, spacing chat hon.
- Chi tiet implementation:
  1. Frontend da nhan duoc OHLC tu API (open, high, low, close, volume) tu backend view. Chi can su dung chung thay vi Area.
  2. Dung SecuritiesItem va market_group_refs tu overview de lay danh sach cap co phieu peer va ve mini breadth.
  3. Cap nhat index.css: font families em/rem, line heights, spacing units cho terminal feel.

Ket qua mong doi:
- Chart nay thanh kien nhat thuc (candle chart-style) thay Area chart.
- Hien thi duoc movement cua peer stocks trong cac nhom thi truong.
- Typography va color scheme tro nen sắc nét, gon gang trading screen thuc.

---

## Wave 16 (2026-10-10) — Trạng thái admin sau khi mở toàn bộ tính năng

Tài liệu này trước đây chỉ là roadmap sản phẩm (Bước 1..30) và **không ghi
trạng thái thực tế của lớp trình bày admin**. Mục này bổ sung phần đó, đo tại
HEAD sau wave 16. Số liệu đều lấy từ lệnh chạy thật, không ước lượng.

### Số liệu

| Chỉ số | Trước wave 16 | Sau wave 16 |
|---|---|---|
| Model có ModelAdmin | 65 | **114** |
| Model của app ta chưa có admin | 49 | **0** |
| Model thiếu nhãn tiếng Việt | 0 | **0** |

49 model được mở theo nhóm: `identity_access` 16 · `user_workspace` 15 ·
`market_data` 5 · `signal_intelligence` 4 · `commercial` 3 · `advisory` 2 ·
`advertising` / `market_serving` / `ops_audit` / `service_ops` 1 mỗi app.

### Ba chính sách khác nhau khi mở admin (không phải mở chung một kiểu)

1. **Bảng nhật ký / tổng hợp do hệ thống ghi** → `VNReadOnlyMixin`, xem được,
   không sửa tay. Ví dụ `LedgerEntry`, `PositionSnapshot`, `PATAuditLog`.
   Một dòng sai trong `LedgerEntry` làm lệch vĩnh viễn phần vốn.
2. **Bảng bí mật** (`UserDNSECredential`, `SystemBrokerCredential`,
   `DNSECredential`, `UserBrokerConfig`, `TenantWebhookConfig`) → có admin để
   theo dõi và thu hồi (xoá được) nhưng trường `*_cipher` là **chỉ đọc** vì là
   ciphertext; ghi tay sẽ hỏng bản ghi.
3. **Bảng cấu hình vận hành** → sửa tay đầy đủ.

### Một ngoại lệ có tên

`service_ops.CachedSymbolGroupMember` là bảng ánh xạ thuần, **không có cột
thời gian nào**, nên không lọc theo thời gian được. Cờ `vn_no_time_filter = True`
đánh dấu việc này; gate và test tôn trọng cờ. Đây là ngoại lệ được đặt tên, không
phải lỗi bị bỏ qua.

### Lỗi routing `/admin/` đã sửa và đã kiểm chứng bằng nginx thật

`/admin/advertising` vừa là route SPA vừa là `app_label` của Django. Với
`location ^~ /admin/advertising` (prefix) nginx nuốt luôn
`/admin/advertising/adcampaign/`, `…/1/change/` … ⇒ **6 URL admin chết**.
Đã đổi thành `location = /admin/advertising` (exact match).

Bằng chứng (chạy nginx 1.31.6 thật, `packages/web/scripts/verify-admin-nginx-routing.mjs`):
- với bản sửa: **28/28 PASS**
- tạm đổi lại `^~`: **22/28, 6 FAIL** — đúng 6 URL bị nuốt

### Gate liên quan

| Gate | Lệnh | Kết quả |
|---|---|---|
| Lớp trình bày admin | `check_admin_ux.py` | PASS — 0 lỗi, 0 cảnh báo |
| Tự chứng minh gate trên | `check_admin_ux.py --self-test` | 13/13 |
| Routing hai chiều | `check:admin-spa-routes` | PASS |
| Tự chứng minh gate trên | `... --self-test` | 4/4 |
| Nginx thật | `verify-admin-nginx-routing.mjs` | 28/28 |

Cả hai gate đã nối vào `scripts/pre-push-gate.mjs`. Trước wave 16,
`check:admin-spa-routes` **có trong `package.json` nhưng chưa bao giờ được nối
vào pre-push** ⇒ nó không chặn được gì; `nginx.conf` lại ghi là đã có trong gate
— sai. Đã sửa cả hai.

---

## Wave 17 (2026-10-10) — O5: hai design system, quyết định đã chốt và **bị ép thành công**

Wave 15 ghi nhận D08 (`#0F1117`/`#3B82F6`) và `soc.tokens.css` (`#081734`/`#22d3ee`)
cùng sống. Owner chốt **D08 cho Django admin**, giữ cặp tăng/giảm Bloomberg (L-F08).

Trước wave 17 quyết định đó chỉ nằm trong đầu và trong comment — không có gì bắt phải giữ:

| Việc | Trước | Sau |
|---|---|---|
| Bảng màu D08 trong gate | dict **chép tay** `D08_COLOR_TOKENS` | **parse thẳng** từ `### 12.1` của D08 |
| `--vn-gain` / `--vn-loss` | quy ước trong comment CSS | gate **chặn** nếu lệch success/danger |
| Màu SOC lọt vào token admin | không ai canh | **cảnh báo** `mau soc.tokens.css loot vao admin (O5)` |

Vì sao dict chép tay là vấn đề thật: nó là **nguồn sự thật thứ hai**. Sửa bảng màu trong
doc mà quên sửa dict ⇒ gate vẫn xanh, CSS sai. Nay sửa doc ⇒ gate đỏ.

**Bằng chứng:** đổi `#0F1117` → `#010203` trong D08 §12.1 ⇒
`FAIL … token --vn-bg phai la #010203 (nguon D08 §12.1), hien tai la #0f1117`.

**Vì sao check SOC là cảnh báo chứ không chặn:** giá trị màu không phân biệt được
"chép từ SOC" với "cùng là sắc chuẩn". Thật: `#b45309`/`#b91c1c`/`#fca5a5` vừa là sắc
Tailwind cho light-mode vừa có trong SOC. Chặn ⇒ 3 cảnh báo giả ⇒ mọi người thêm
allowlist rồi gate chết. Nên: cảnh báo + allowlist có tên + giải thích lý do ngay trong code.

Tương tự, gate **không** báo "màu trùng giữa hai bảng màu" — `#ef4444`/`#f59e0b` thuộc cả
D08 lẫn SOC. Gate chỉ soi **giá trị của token** (`--vn-…: #hex`).
---

## Wave 17 (2026-10-10) — `entrypoint.sh` **đã chạy thật**, O3 có bằng chứng đo được

Mục "CHƯA CHẠY" của O3 đã đóng (ledger `## Entry 269`). Container thật từ image
`vninvest-dev-core-runtime`, nối Postgres dev, `daphne` thay bằng stub để thấy trọn
chuỗi lệnh mà không mở cổng thật.

| Phép thao tac | Ket qua |
|---|---|
| `ROLE=api` bình thường | migrate → **collectstatic 166 file / 478 post-processed** → repair_beat_schedule → daphne, **exit 0** |
| `--tmpfs /app/src/staticfiles:ro` + **bản mới** | `OSError: [Errno 30] Read-only file system` → **exit 1**, daphne **không** khởi động |
| `--tmpfs /app/src/staticfiles:ro` + **bản cũ** (`\|\| true`) | `OSError` in ra → **vẫn chạy tiếp** repair → `Starting daphne` |

Hàng cuối mới là bằng chứng. Bỏ `|| true` trước đây là **suy luận đúng**; giờ đã **đo**:

> `collectstatic` thất bại, sản phẩm vẫn "khỏe" (healthcheck 200) và **không dùng được** —
> admin mất CSS/JS mà không ai biết. Đó đúng là thứ O3 muốn bỏ.

Còn **CHƯA CHẠY**: `ruff` (không cài trong `.venv`) · Playwright / browser QA · đối chiếu trực quan light/dark bằng trình duyệt.