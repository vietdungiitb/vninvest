from data_ingest.models import IngestRun
from market_data.models import DailyPrice

# Check IngestRun records
recent_runs = IngestRun.objects.all().order_by('-started_at')[:5]
print('Recent IngestRun records:')
print('  State | Rows Upserted | Started')
print('  ------|---------------|---------')
for run in recent_runs:
    print(f'  {run.state:<5} | {run.rows_upserted:>13} | {run.started_at.strftime("%H:%M:%S")}')

# Check if row count changed
total_count = DailyPrice.objects.count()
latest_date = DailyPrice.objects.order_by('-date').first()

print(f'\nDailyPrice total count: {total_count}')
if latest_date:
    print(f'Latest date in DB: {latest_date.date}')
    count_today = DailyPrice.objects.filter(date=latest_date.date).count()
    print(f'Records for {latest_date.date}: {count_today}')
else:
    print('No DailyPrice records found')
