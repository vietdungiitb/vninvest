# SM-P7 — Post-Production Validation: Checklist

**Phase**: SM-P7 (Post-Production Validation — Ongoing)  
**Start**: After SM-P6 complete  
**Status**: NOT STARTED

---

## SM-P7.1: Week 1 Monitoring — Zero Incidents Target

DoD: 7 ngày liên tiếp không có unhandled exception mới trong Sentry

Monitoring checklist:
- [ ] Sentry: 0 new critical issues daily
- [ ] Grafana: API p95 < 200ms (API Overview dashboard)
- [ ] PgBouncer: pool saturation < 80% (max_client_conn=500)
- [ ] Redis memory: < 70% of limit
- [ ] Daily backup: `ops_audit.tasks.daily_db_backup` Celery task running at 02:00 AM

Weekly health check command:
```bash
# Check Sentry (if CLI available)
sentry-cli releases list --project vninvest

# Check Celery task history
docker exec vninvest-core-worker python manage.py shell -c "
from django_celery_beat.models import PeriodicTask
from django_celery_results.models import TaskResult
import datetime
results = TaskResult.objects.filter(
    date_done__gte=datetime.datetime.now() - datetime.timedelta(days=1)
).values('task_name', 'status').order_by('-date_done')[:20]
for r in results: print(r)
"
```

---

## SM-P7.2: VNPay Subscription Integration

Estimate: 2 tuần  
Owner: Backend Lead  

Implementation steps:
1. VNPay sandbox account setup
2. `commercial.SubscriptionPlan` + `commercial.Subscription` models wired to VNPay
3. Webhook endpoint for payment confirmation
4. Celery task: `check_subscription_payment_status` — poll VNPay API
5. Auto-upgrade user tier on payment confirmation

---

## SM-P7.3: Quota Enforcement Activation

DoD: Free users bị từ chối advisory generation khi vượt token budget

Steps:
1. Check `commercial.TokenBudget` model exists
2. Wire `advisory/views.py` `AdvisoryRefreshView` to check quota before calling LLM
3. Return HTTP 402 Payment Required when budget exceeded
4. Frontend: handle 402 in `StockDetailPage.js` — show "Nâng cấp gói" CTA

Quick check — token budget gate:
```python
# In advisory/views.py AdvisoryRefreshView:
from commercial.models import TokenBudget
budget = TokenBudget.objects.filter(user=request.user, period='monthly').first()
if budget and budget.tokens_used >= budget.tokens_limit:
    return Response(
        {'error': 'Hết quota tư vấn tháng này. Vui lòng nâng cấp gói.'},
        status=status.HTTP_402_PAYMENT_REQUIRED,
    )
```
