# TRANSACTIONS FEATURE ROADMAP
*(Dựa trên audit BLACKBOXAI của Transactions.jsx - thêm tính năng khả thi)*

## P1: Essential UX (1 sprint, 3-5 ngày)
| Feature | Value | Effort | Deps |
|---------|-------|--------|------|
| **Search/Filter** | Date range, symbol, type, notes debounce | Navigate 1000+ txs | Client-side (no BE) |
| **Modal Form** | Inline → backdrop modal, desktop/mobile consistent | Less cramped UX | Portal or state |
| **Keyboard Shortcuts** | N=new, E=edit, Del=delete, / =search | Power user 10x | useHotkeys lib |
| **Net Cash Column** | Signed value (BUY -, SELL/DIV +) auto-sum | Instant cash flow view | Table math |

## P2: Power User (1 sprint, 5-7 ngày)
| Feature | Value | Effort | Deps |
|---------|-------|--------|------|
| **Bulk Operations** | Select all/filtered → delete/export | Batch cleanup | Checkbox + API bulk |
| **CSV/PDF Export** | Custom columns, date range, auto-file name | Compliance/audit | PapaParse/jsPDF |
| **Advanced Validation** | Lot size 100s, price tick, future date block, dupe detect | Data quality | Formik/Yup |
| **Subaccount Balance** | Running balance per tab, total cash invested | Mental accounting | Cumulative sum |

## P3: Pro Features (2 sprints, 10 ngày)
| Feature | Value | Effort | Deps |
|---------|-------|--------|------|
| **Import Wizard** | CSV upload Excel/VND format, auto-map columns | Migrate legacy data | SheetJS + preview |
| **Transaction Split** | 1 tx → multiple lots (avg cost calc) | Complex positions | Nested form |
| **Realtime Sync** | WS portfolio refresh → optimistic table | Live consistency | useRealtimeFeed |
| **AI Categorize** | Notes → auto tags (dividend/profit-taking) | Pattern matching | Simple regex → LLM |

## P4: Enterprise (Future)
| Feature | Value | Effort | Deps |
|---------|-------|--------|------|
| **Workflow Approval** | Pending → approve/release | Institutional | BE maker-checker |
| **Signature PDF** | Digital sign + timestamp | Compliance | pdf-lib |
| **Recurring Tx** | Monthly dividend auto-add | Passive income | Cron BE |

**Implementation Priority**: P1 → ship immediately (ROI cao nhất).  
**Tech Stack**: Client-first (minimal BE changes), React Query cho optimistic + sync.  
**Success Metric**: Time-to-complete monthly reconciliation < 2min.

*(Audit bổ sung từ BLACKBOXAI - ready thảo luận)*