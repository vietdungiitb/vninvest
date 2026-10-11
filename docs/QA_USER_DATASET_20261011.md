# Bo du lieu test nguoi dung QA — vninvest (dataset v1, 2026-10-11)

Lessons ap dung: [L-B01, L-B03, L-G02]
- L-B01: seed can Postgres (`CORE_DATABASE_URL` + `DJANGO_DEBUG=1`); thieu DB → ghi CHUA CHAY.
- L-B03: script seed stdout chi ASCII; label tieng Viet chi nam trong DB fields.
- L-G02: moi gate/test bao PASS/FAIL/CHUA CHAY kem lenh + exit code that.

## 1. Tai sao can bo nay

He thong da co nhieu chuc nang hoat dong nhung thieu du lieu nguoi dung de test
chinh cac chuc nang do. Bo demo cu (`DEMO_DATASET_GUIDE.md`, 04/2026, 28 ma random,
gia random volatility) da loi thoi: khong phu tenant isolation, commercial,
AdvisorySession, SOC DataOps hien tai. Dataset v1 thay the bang cach neo gia
giao dich theo `DailyPrice.close` that trong DB.

## 2. Universe (50 ma, uu tien VN30/VN100)

- **VN30 ky 07/2026** (HOSE cong bo 15/07/2026, hieu luc 03/08/2026, du 30 ma):
  ACB, BID, BSR, CTG, FPT, GAS, GVR, HDB, HPG, LPB, MBB, MCH, MSN, MWG,
  SAB, SHB, SSB, SSI, STB, TCB, TCX, VCB, VHM, VIB, VIC, VJC, VNM, VPB, VPL, VRE.
  Thay doi so voi ky truoc: MCH + TCX vao (thay TPB, PLX); BSR vao tu 05/2026 (thay DGC).
- **VN100 mo rong** (20 midcap HOSE dai dien ngoai VN30):
  VCI, HCM, VND, KDH, NLG, DIG, PDR, DXG, HSG, NKG,
  DGC, DPM, DCM, REE, GEX, POW, NT2, FRT, PNJ, BVH.
- `StockProfile` duoc seed kem `industry` so bo; gia fallback trong `BASE_PRICES`
  chi dung khi DB chua co `DailyPrice`.

## 3. 6 persona (password chung: `Test@12345`)

| User | Ho so | Danh muc | Diem test dac thu |
|---|---|---|---|
| `qa_longterm` | NDT dai han VN30, plan pro | Dai han VN30: VCB FPT MWG VNM MBB REE + DIVIDEND | Co tuc, allocation, snapshot NAV 30 ngay |
| `qa_trader` | Luot song midcap, plan pro | Luot song Midcap: DIG DXG HSG VCI GEX PDR + SELL chot loi | Margin sub-account, intraday/alert, BUY+SELL |
| `qa_bank` | Chuyen bank VN30, plan starter | Chuyen Bank VN30: 7 bank + rule "Bank giu nen SMA20" | Screener bank, allocation tap trung |
| `qa_whale` | San ca voi, plan pro | San ca voi: HPG SSI VHM VIC STB, nguong 100tr | Whale threshold thap, dark_flow, OrderFlow |
| `qa_tenant_admin` | Van hanh tenant, plan pro | Tong hop VN100 + rule public "Midcap breakout" | Quota 120 calls, billing/subscription |
| `qa_staff` | Staff, plan internal | Giam sat thi truong | Doi chung SOC/DataOps, khong chua PII that |

Moi user co tenant rieng (`qa-<user>`), 2 sub-account (Tien mat + Ky quy),
snapshot 30 ngay, watchlist nhom, tracked symbol, price alert, 2 screener rule,
UnifiedAlert 2 phien + Whale canopy + OrderFlowEvent, AdvisoryRecord + Session
(4 components), Subscription + QuotaRecord.

## 4. Ma tran phu chuc nang

| Chuc nang (FE route) | Nguon du lieu test | Persona |
|---|---|---|
| Dashboard / Portfolio workspace (overview, holdings, allocation, analytics, activity, transactions) | Portfolio + Transaction + AccountSnapshot | longterm, trader, bank |
| Watchlist / Tracked symbols | Watchlist + WatchlistItem + TrackedSymbol | all (rieng trader/whale nhieu ma) |
| Stock detail (intraday, AI summary) | StockProfile + DailyPrice + SymbolSnapshot | longterm/FPT, whale/HPG |
| Whale alerts / Order Flow Radar | UnifiedAlert(whale) + WhaleAlertCanonical + OrderFlowEvent | whale, trader |
| Alert Center (whale/dark/signal/system/ai) | UnifiedAlert 5 families qua seed AlertCenter + dataset | whale + demo users |
| Screener + run history | ScreenerRule (bluechip / bank / midcap breakout) | bank, tenant_admin |
| AI Advisory / AI Command Center / Usage | AdvisoryRecord + Session + Components | longterm, trader |
| Price alerts | PriceAlert ACTIVE kem nguong ±% tu close that | trader (3), longterm (2) |
| Billing Center / Upgrade / Payment | Subscription + QuotaRecord + Invoice (tu tao them khi test pay) | tenant_admin |
| Tenant admin (members/roles/PAT/keys/usage/audit/SSO/webhook) | CoreTenant + membership that cua user | tenant_admin, staff |
| SOC Operations / DataOps (queue/coverage/run logs/backfill) | IngestJob/Run + DataOps runtime (tao khi chay pipeline that) | staff |
| Auth (login/register/verify/reset) | 6 user + password chung | all |

## 5. Cach chay

```bash
# 1. Dam bao Postgres + env (L-B01)
#    CORE_DATABASE_URL=postgres://...  DJANGO_DEBUG=1
cd packages/core/backend
python src/manage.py seed_qa_user_dataset
python src/manage.py seed_qa_user_dataset --personas qa_longterm,qa_trader
python src/manage.py seed_qa_user_dataset --delete
```

Login FE: user `qa_longterm` / `Test@12345`, mo `/portfolios`, `/watchlist`,
`/stocks/FPT`, `/whale-alerts/HPG`, `/screener`, `/settings/ai`.

## 6. Verify (2026-10-11, chay that tren Postgres dev)

- [x] `python -m py_compile .../seed_qa_user_dataset.py` → PASS (exit 0).
- [x] `migrate --noinput` → PASS ("No migrations to apply", schema co san).
- [x] `seed_qa_user_dataset` → PASS (`users=6 tx=38 alerts=40 flows=40 advisory=5`,
      seed bo sung `qa_staff` → `tx=4 alerts=8 flows=8 advisory=1`).
- [x] Dem kiem chung (shell): 6 users · 6 portfolios · **42 TX** (SELL=3, DIV=2) ·
      8 watchlists · 10 price alerts · 8 screener rules · **48 UnifiedAlert** ·
      **48 OrderFlowEvent** · 6 AdvisoryRecord + 6 Session · 6 Subscription + 6 Quota.
- [x] Neo gia that: VCB BUY 53.298 = 0.94 × DailyPrice close 56.700 (phien 09/10/2026).
      DB co **4.535.663 DailyPrice**, du 10/10 ma spot-check → khong dung fallback.
- [ ] `npx tsc --noEmit` (packages/web) → CHUA CHAY (khong doi FE trong slice nay).
- Lenh dem sau khi seed (chay trong `manage.py shell`):
  `Transaction.objects.filter(portfolio__user__username__startswith='qa_').count()`,
  `UnifiedAlert.objects.filter(source_ref__startswith='qa:dataset-v1').count()`.

## 8. Runtime docker dev (2026-10-11, chay that)

Stack: `core-db` (5433) + `core-redis` (6380) + `core-api` (8001) + `frontend` (8080).
E2E PASS: `POST /core/v1/auth/token/` (qa_longterm) → 200 + PAT →
`GET /core/v1/workspace/portfolios/` → 200, thay `"Dai han VN30"`.
`GET :8080/core/v1/health` qua nginx → 200 (proxy FE→API thong).

2 sua de docker dev chay duoc KHI THIEU token vnbroker (unc ommitted, xem §9):
- `packages/core/backend/Dockerfile`: secret `vnbroker_github_token` thanh optional.
  Co token → cai full nhu cu; khong co → bo dong `vnbroker @ git+...`, warn,
  cai phan con lai (moi `import vnbroker` trong src/ deu lazy + degrade).
- `docker-compose.dev.yml`: 11 cho `${VNBROKER_GITHUB_TOKEN:?...}` → `${...:-}`
  (thieu token chi warn, khong pha vo interpolation toan stack).

Bai hoc rut ra khi seed: login doi `CoreServiceAccount(name="default",
status=active)` — dang ky that tu tao o `register.py:248`, seed tay thi phai
tu tao. Seed da bo sung: user thuong `['market:read','signals:read']` (dung nhu
register), `qa_tenant_admin` + manage_pats/manage_tenant, `qa_staff` full.

## 7. Gioi han co y (khong phai thieu sot)

- Khong seed secret/credential that (DNSE/LightSpeed, PAT, API key) — test ket noi
  broker bang credential rieng cua nguoi test.
- Khong seed du lieu SOC DataOps run that (IngestRun/DataOpsRunLogs) — sinh ra khi
  chay pipeline that tren moi truong co vnbroker.
- Gia fallback chi de chay duoc khi DB trong; tren DB co `DailyPrice` thi 100%
  gia neo theo close that.

## 9. Trang thai file (CHUA commit)

- Moi, commit duoc: `packages/core/backend/Dockerfile`,
  `.../user_workspace/management/commands/seed_qa_user_dataset.py`,
  `docs/QA_USER_DATASET_20261011.md`.
- Sua nhung KHONG commit (deny-list, hook chan): `docker-compose.dev.yml`.
  Ghi vao claim + bao coordinator theo protocol neu muon merge.
