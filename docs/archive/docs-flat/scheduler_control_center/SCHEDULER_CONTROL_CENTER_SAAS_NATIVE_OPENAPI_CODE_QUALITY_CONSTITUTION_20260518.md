# Code Quality Constitution - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Absolute rules

1. Khong tao parallel operator surface ngoai SOC.
2. Khong bypass ownership guard cho action write.
3. Khong bypass OpenAPI metadata cho endpoint moi.
4. Khong dung broad exception swallow (`except: pass`) trong scheduler path.
5. Khong de frontend synthesize scheduler truth.
6. Khong direct fetch tu packages/web bypass adapter lane.

---

## 2. Required implementation style

1. Action endpoints phai idempotent va replay-safe.
2. Scheduler status phai explainable (`status_reason`, lag/freshness).
3. Audit trail phai ghi actor, reason, before/after state.
4. Read-only rollout phai xong truoc write-mode rollout.

---

## 3. Required review questions

1. Thay doi nay co giu SOC la surface duy nhat khong?
2. Co vi pham ownership mode (`can_apply`) nao khong?
3. Contract OpenAPI co du request/response/error metadata chua?
4. Action control co rollback semantics ro rang chua?
5. Evidence va runbook co du cho doi van hanh chua?
