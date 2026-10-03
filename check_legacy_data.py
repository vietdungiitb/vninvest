from portfolio.models import Portfolio, WatchlistGroup, WatchlistItem, PriceAlertRule

pf_count = Portfolio.objects.count()
wg_count = WatchlistGroup.objects.count()
pa_count = PriceAlertRule.objects.count()

print(f"Legacy Portfolio count: {pf_count}")
print(f"Legacy WatchlistGroup count: {wg_count}")
print(f"Legacy PriceAlertRule count: {pa_count}")

if pf_count > 0:
    print("\nSample Portfolio:")
    for pf in Portfolio.objects.all()[:1]:
        print(f"  - {pf.name} (user={pf.user.id}, tenant={pf.tenant_id})")

if wg_count > 0:
    print("\nSample WatchlistGroup:")
    for wg in WatchlistGroup.objects.all()[:1]:
        print(f"  - {wg.name} (user={wg.user.id}, tenant={wg.tenant_id})")

if pa_count > 0:
    print("\nSample PriceAlertRule:")
    for pa in PriceAlertRule.objects.all()[:1]:
        print(f"  - {pa.symbol} {pa.condition} {pa.target_price} (user={pa.user.id}, tenant={pa.tenant_id})")
