# DASHBOARD CODE AUDIT (EXECUTION-READY)

Ngay cap nhat: 2026-04-05
Pham vi: Dashboard frontend (realtime + snapshot integration)
Muc tieu tai lieu: Chuyen tu "nhan dinh" sang "ke hoach thuc thi co nghiem thu"

---

## 1) Executive summary

Dashboard hien co nen tang realtime tot, nhung gap loi nghiep vu P1: cung mot thoi diem co the hien thi 2 gia tri Market Value khac nhau giua vung snapshot va vung live. Van de nay anh huong truc tiep den do tin cay cua trader.

Ket luan uu tien:
1. P1 bat buoc: hop nhat single source of truth cho quote/live P&L.
2. P2 can lam ngay sau P1: giam nhieu UI observability + toi uu sync behavior.
3. P3 dat sau khi P1/P2 on dinh: Global RealtimeContext va nang cap alert UX.

Trang thai de xuat: READY FOR IMPLEMENTATION DISCUSSION.

---

## 2) Kien truc hien tai (as-is)

Dashboard page tap trung tai:
1. frontend/src/pages/Dashboard.jsx
2. frontend/src/components/StatCard.jsx
3. frontend/src/components/DashboardRealtimePanel.jsx
4. frontend/src/components/HoldingsTable.jsx

Data flow hien tai:
1. API snapshot phuc vu StatCards/Holdings (du lieu tinh tai thoi diem fetch).
2. WebSocket + polling fallback phuc vu realtime panel (du lieu dong).
3. Chua co lop hop nhat state quote de tat ca widget doc cung mot nguon live.

He qua:
1. Co the lech gia tri giua vung tong quan va vung chi tiet.
2. Nguoi dung nhin thay "2 su that" trong cung mot man hinh.

---

## 3) Diem manh da xac nhan

| Diem manh | Gia tri san pham | Muc do tin cay |
|---|---|---|
| Hook realtime + fallback polling | Co resilience khi socket gian doan | Cao |
| Loading/empty/stale handling | Giam crash va blank screen | Cao |
| i18n co san | San sang mo rong ngon ngu | Trung binh-cao |
| Whale/realtime panel tach rieng | De quan sat event nhanh | Trung binh |

---

## 4) Van de uu tien (problem statement)

| ID | Van de | Tac dong | Priority |
|---|---|---|---|
| P1-01 | Data fragmentation (snapshot vs live khong hop nhat) | Mat long tin so lieu, confusion khi quyet dinh | P1 |
| P1-02 | HoldingsTable chua overlay live quote/P&L | Khong tan dung realtime cho vi the | P1 |
| P2-01 | Observability detail chiem nhieu khong gian trader UI | Tang noise, giam focus | P2 |
| P2-02 | Manual sync khong context-aware theo realtime status | UX thua thao tac | P2 |
| P3-01 | Whale signal chua map truc tiep vao holding rows | Mat lien ket context | P3 |

---

## 5) Ke hoach de xuat (to-be)

### Phase P1 (1-2 ngay): Single source of truth

Muc tieu:
1. Dashboard doc cung mot live quote map cho StatCards + HoldingsTable.
2. Loai bo tinh trang Market Value/P&L bi lech giua cac widget.

Thay doi chinh:
1. Hoist useRealtimeFeed tai Dashboard level.
2. Tao quotesBySymbol la nguon state duy nhat cho cac widget.
3. Tinh liveMarketValue/liveUnrealizedPL o mot cho duy nhat (selector/helper).
4. HoldingsTable nhan livePrice overlay + P/L delta theo quote moi.

Acceptance criteria P1:
1. Cung 1 timestamp, Market Value hien thi giong nhau o StatCards va HoldingsTable summary (do lech = 0 trong test fixture).
2. Khi co quote moi, P/L card va holding row cap nhat trong < 1s (local runtime).
3. Khong lam giam behavior fallback polling (socket down van update theo polling).

Test bat buoc P1:
1. Unit test selector tinh liveMarketValue/livePL.
2. Component test: quote update -> StatCard va Holdings row cung doi.
3. Manual QA: disconnect socket -> polling fallback -> reconnect.

### Phase P2 (1 ngay): UX polish

Muc tieu:
1. Giam noise cho trader mode.
2. Giu du observability cho debug mode.

Thay doi chinh:
1. Observability panel thu gon thanh status icon + popover detail.
2. Sync button doi trang thai theo realtime status (live/stale/disconnected).
3. Them whale badge tren row co lien quan trong khoang thoi gian ngan.

Acceptance criteria P2:
1. Trader mode khong hien full observability metrics by default.
2. Sync button disable/hidden hop le khi live on-dinh.
3. Whale badge khong spam lap lai lien tuc trong cung cooldown window.

### Phase P3 (sau P1/P2): Ngan han nang cap

1. Global RealtimeContext de tai su dung state cho nhieu page.
2. Pull-to-refresh cho mobile dashboard flow.
3. Alert channels nang cao (chi bat khi da co user validation).

---

## 6) Nghiem thu va KPI

KPI ky thuat de theo doi sau P1/P2:
1. Consistency KPI: sai khac Market Value giua top card va holdings summary = 0 tren data fixture.
2. Realtime refresh KPI: p95 UI update latency < 1000ms (local/staging).
3. Stability KPI: khong tang JS runtime error so voi baseline truoc patch.

KPI san pham de xac nhan:
1. 3-5 trader test nhanh, >= 80% dong y rang confusion ve so lieu da giam ro.

---

## 7) Evidence schema (bat buoc khi implement)

Moi thay doi can cap nhat du bo:
1. File changed list (path + ly do).
2. Test evidence (command + ket qua pass/fail).
3. Truoc/sau screenshot cho dashboard (co timestamp).
4. Known limitations va risk con lai.

Mau artifact de xai trong sprint:
1. docs/SPRINT_EXECUTION_LOG.md
2. docs/DASHBOARD_FRONTEND_AUDIT.md
3. docs/ops-evidence/ (neu co runtime metrics)

---

## 8) Risk va guardrail

Rui ro chinh:
1. Tinh P/L duplicate o nhieu component gay sai so.
2. Re-render qua nhieu khi quote update tan suat cao.
3. Regression fallback polling khi refactor hook usage.

Guardrail:
1. Mot ham tinh gia tri live dung chung (khong copy logic).
2. Memoized selector cho holdings + cards.
3. Test scenario socket down/reconnect la bat buoc truoc merge.

---

## 9) De xuat thao luan tiep

Agenda 30-45 phut:
1. Chot boundary state: quote source tai Dashboard hay RealtimeContext.
2. Chot acceptance criteria P1/P2 (so lieu do duoc).
3. Chot test matrix va owner cho tung phase.

Quyet dinh can dat sau buoi:
1. Scope commit cho P1.
2. Chien luoc rollout (flag neu can).
3. Ngay cut-off de demo cho trader test nho.