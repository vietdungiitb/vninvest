# OPEN CORE NUMERIC LOCK SHEET V1 (OC-11)

Doc ID: OC-11
Ngay tao: 2026-04-07
Ngay cap nhat: 2026-04-07
Trang thai: Fully locked for V1 execution
Related docs: OPEN_CORE_00_INDEX.md, OPEN_CORE_02_DECISION_RECORD_V1.md, OPEN_CORE_03_EXECUTION_PLAN_90D.md, OPEN_CORE_05_FEATURE_BOUNDARY_MATRIX_V1.md, OPEN_CORE_06_PRICING_AND_PACKAGING_DRAFT_V1.md, OPEN_CORE_10_VNSTOCK_SOURCE_STRATEGY_V1.md

## 1. Muc tieu
Khoa cac tham so so hoc quan trong de tranh tre execution:
- Pricing
- Quota
- Trial/Grace
- SLO

## 2. Numeric locks (workshop answers applied)

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

## 3. Acceptance rules
1. Tat ca o "TBD" phai duoc lock trong workshop OC-07.
2. Neu khong lock duoc, item do dua vao V1.1 voi owner va deadline.
3. Khong cho phep trien khai production pricing khi con TBD o muc pricing/quota/trial.

## 4. Decision log
| Item | Decision | Owner | Deadline |
|---|---|---|---|
| Pricing annual | Locked from answers (2A/3C/4A) | Product + Growth | 2026-04-14 |
| Quota defaults | Locked from answers + finalized baseline | Tech Lead | 2026-04-14 |
| Trial/Grace | Locked from answers (9A/10A/11/12B) | Product | 2026-04-14 |
| Pro SLO baseline | Locked from answers (13A/14A/15B/16A) | Tech Lead + Compliance | 2026-04-14 |

## 5. Next review checkpoint
- Review target: 2026-04-14 (weekly governance checkpoint).
