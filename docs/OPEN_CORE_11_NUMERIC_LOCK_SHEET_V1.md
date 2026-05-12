# OPEN CORE NUMERIC LOCK SHEET V1 (OC-11)

Doc ID: OC-11
Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-18
Trang thai: Business baseline only, KHONG con duoc xem la runtime-canonical
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md, OPEN_CORE_10_VNBROKER_SOURCE_STRATEGY_V1.md

## 1. Muc tieu
Khoa cac tham so so hoc quan trong de tranh tre execution:
- Pricing
- Quota
- Trial/Grace
- SLO

Quan trong 2026-04-18:
1. Tai lieu nay khong con duoc doc nhu "runtime truth" vi code OpenCore hien tai dang bieu dien mot phan quota theo thang.
2. Tai lieu nay van co gia tri la business baseline/hypothesis, nhung can duoc canonical hoa lai truoc khi public hoac thong diep ra ngoai.

## 2. Business baseline tu workshop (giu lai de tham chieu)

### 2.1 Pricing annual
| Plan | Currency | Annual price | Notes |
|---|---|---:|---|
| Community | n/a | 0 | Free |
| Pro Individual | VND | 1,990,000 | Annual-first (1A, 2A) |
| Pro Team Base | VND | 12,900,000 | Chua tinh seat (3C) |
| Pro Team / Seat | VND | 990,000 | Add-on theo seat (4A) |

### 2.2 Quota defaults
| Capability | Community | Pro Individual | Pro Team |
|---|---:|---:|---:|
| API calls/day | 300 | 3,000 | 10,000 |
| AI advisory regenerate/day | N/A | 30 | 120 |
| Whale alerts tracked symbols | 10 | 25 | 100 |
| Exports/day | 0 | 20 | 100 |

### 2.3 Trial and expiry policy
| Parameter | Value |
|---|---|
| Trial duration | 7 ngay |
| Trial access mode | Full Pro Individual features, quota cap 70% of paid |
| Grace period | 7 ngay |
| Post-grace behavior | Khoa premium, giu free flow |

### 2.4 SLO baseline (Pro)
| Metric | Target |
|---|---|
| API availability (monthly) | >= 99.0% |
| P95 response time | <= 2.0s |
| Error rate budget | < 1.0% 5xx |
| Incident response target | P1 ack <= 60 phut |

## 3. Runtime truth quan sat duoc trong code (2026-04-18)
| Muc | Runtime truth hien tai | He qua |
|---|---|---|
| Plan names | `free`, `pro`, `enterprise` | Khong giong ten package business Community / Pro Individual / Pro Team |
| Quota field trong DPIPlan | `max_api_calls_per_month` | Lech voi bang quota/day o tren |
| Fallback Free plan | Dang seed 5000 calls/thang trong runtime fallback | Khong khop 300/day baseline |
| Trial/grace wording | Chua co 1 nguon canonical duy nhat giua cac docs | Khong du an toan de dua ra public messaging |

## 4. Danh gia tung cum tham so
| Cum tham so | Gia tri business baseline | Runtime truth | Trang thai quyet dinh |
|---|---|---|---|
| Pricing annual | Co baseline VND | Chua thay binding runtime ro rang | Chua final de public |
| Quota Community/Pro | Bang ngay | Runtime nghieng ve thang | Dang lech, can lock lai |
| Trial/grace | 7 ngay + 7 ngay | Chua duoc xac nhan end-to-end la canonical | Dang mo |
| SLO | Co baseline | Chua thay public enforcement artifact tuong ung | Baseline noi bo |

## 5. Acceptance rules sau governance refresh
1. Khong goi tai lieu nay la "fully locked" nua cho den khi runtime truth duoc dong bo.
2. Khong cho phep public pricing/quota/trial neu con do lech giua business baseline va runtime implementation.
3. Moi thong diep public phai noi theo so canonical cuoi cung trong bo OC-13/14/15, khong copy truc tiep bang so nay khi chua duoc tai-khoa.

## 6. Decision log sau cap nhat
| Item | Trang thai 2026-04-18 | Owner |
|---|---|---|
| Pricing annual | Baseline con gia tri, chua public-final | Product + Growth |
| Quota defaults | Khong con duoc xem la runtime-canonical | Tech Lead |
| Trial/Grace | Can lock lai wording + runtime contract | Product + Tech |
| Pro SLO baseline | Giu lam noi bo, chua dung cho public commitment | Tech Lead + Compliance |

## 7. Next review checkpoint
- Review target: lock lai quota/trial canonical truoc moi quyet dinh publish/community hardening.
