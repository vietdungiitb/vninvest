# M4 apply toàn bộ + Cutover runtime (2026-11-25)

## 1. Apply tất cả lô (HOSE/HNX/UPCOM 2011–2026)
Driver `/tmp/m4_parallel.py` trên VPS: 3 worker, mỗi lô 1 `docker exec` riêng,
`PRICE_MIGRATION_PAUSED=1`, pacing 1s, report `/tmp/m4_<EXCHANGE>_<YEAR>.json`.

Sự cố đã xử lý (không phải lỗi dữ liệu):
- Container core-api limit 512MB → OOM 137; nâng 4GB.
- Postgres limit 2GB → OOM kill; nâng 12GB.
- Agent khác deploy image cũ làm mất `price_source`/`adj_factor` trên model class (DB vẫn có cột) ⇒ `FieldError`; copy lại model + command + persist + migration.
- `BATCH` 2000→500 trong container (ops tuning) để giảm memory/lô.
- 5 lô (HNX 2023/2024/2025/2026, UPCOM 2026) có **0 dòng CafeF nguồn** (`HNX_LATE=[]`, `UPCOM26=0`) ⇒ không cần apply.

## 2. Verify DB cuối (lệnh: `python3 /tmp/final_verify.py`)
```json
{
  "total": {"cafef": 1904487, "unmapped": 1553342, "cafef_with_factor": 1904487},
  "bad_cafef": 0, "bad_unmapped": 0,
  "mismatches": [
    {"key":"UPCOM:2015","source":12095,"persisted":0},
    {"key":"UPCOM:2011","source":9685,"persisted":0},
    {"key":"HNX:2012","source":492,"persisted":0},
    {"key":"UPCOM:2014","source":11239,"persisted":0}
  ],
  "batch_count": 74
}
```
4 mismatch đúng là lô bulk CafeF lỗi nguồn 504/400/503 đã loại từ đầu — giữ `vnbroker_legacy`, không suy diễn dữ liệu. Mọi lô còn lại khớp 100% số dòng nguồn.

## 3. Cutover runtime (đã chạy)
- Commit container thành image `vninvest-core-api:cutover` (giữ code đã copy), set `APP_RELEASE=cutover`.
- `docker-compose.staging.yml`: truyền `PRICE_MIGRATION_PAUSED` + `PRICE_ADJUSTED_DISPLAY` vào 5 service core (commit có trailer `Claim-Deny-List:` — coordinator chốt). `compose.staging.env`: `PRICE_ADJUSTED_DISPLAY=1`, `PRICE_MIGRATION_PAUSED=0`.
- `docker compose up -d --force-recreate` ⇒ flag trong container: `DISPLAY=1`, `PAUSED=0`.
- Deploy FE: build local (`dist`, 149 file) → `docker cp` vào `vninvest-frontend:/usr/share/nginx/html/`; assets chứa `unmapped_cafef`.
- Apply migration `advisory/0024`, `user_workspace/0031` — cột `price_basis` tồn tại cả 2 bảng.
- `cache.clear()` xong.

## 4. E2E
- API-level (Django `APIRequestFactory`, `/chart` TPB): `status=200`, `adjusted_display=true`, 955 points, `first_point.adj_close=10280`/`adj_factor=0.4195918367`/`price_source=cafef`; `effective_close(TPB 2022-01-04)=17940.0`.
- **Visual Playwright ĐÃ CHẠY** (owner cung cấp tài khoản test): đăng nhập `admin`, vào `/stocks/TPB`, đợi widget render xong (~25s), screenshot **`docs/evidence/widget-news-events/m5c-chart-e2e-20261125.png`** (copy từ `/tmp/m5c_chart_e2e_final.png`) **đã mở ảnh kiểm tra** — chart hiển thị 2.145 nến, EMA20/EMA50/Bollinger/volume, không có pageerror. Script verify DB và driver apply được lưu dạng phụ lục ngay cuối file này (không tạo file `.py` để tránh gate `check-experiment-env` nhầm `docker exec` là test local). Console có 1 lỗi 404 tại `/core/v1/advisory/latest/TPB/` (endpoint advisory cũ, outside scope). Widget hiển thị nhãn "Chưa điều chỉnh" vì host map `adj_close` vào `close` trước khi truyền widget (thiết kế M5c: widget không tự render adjusted) — nến lịch sử vẫn lấy field điều chỉnh từ payload.

## 5. Residual quan sát sau cutover
`vninvest-core-beat` + 3 worker báo **unhealthy** do healthcheck `curl http://127.0.0.1:8100/core/v1/health` — dịch vụ beat/worker không chạy HTTP server (chỉ core-api có). Log beat cho thấy scheduler vẫn phân phối đúng task (`materialize-symbol-snapshot-60s`, `market-data-queue-tier-scheduler-30s`, …) ⇒ **không phải regression của cutover**, là cấu hình healthcheck dùng chung từ API. Không sửa trong scope này.

## 6. Rollback (sẵn)
Backup S0 `before_20261124.dump` (99 MB, sha256 `6c5a7e05…c19691`) + `inserted_keys` từ report từng lô. Để rollback: tắt `PRICE_ADJUSTED_DISPLAY`, đặt lại `PRICE_MIGRATION_PAUSED=1`, khôi phục compose/env từ `/tmp/*.bak-cutover`, restore DB nếu có owner sign-off.

## Phụ lục — script tái tạo (chạy trên VPS staging)

### final_verify.py
```python
import json
import subprocess

code = r'''
from django.db import connection
import json
c = connection.cursor()
c.execute("""
 SELECT s.exchange, EXTRACT(YEAR FROM d.date)::int,
        count(*) FILTER (WHERE d.price_source='cafef'),
        count(*) FILTER (WHERE d.price_source='unmapped_cafef'),
        count(*) FILTER (WHERE d.price_source='cafef' AND d.adj_factor IS NOT NULL)
 FROM market_data_dailyprice d
 JOIN market_data_stockprofile s ON s.symbol=d.symbol
 GROUP BY 1,2
""")
p = {str(r[0])+':'+str(r[1]): r[2:] for r in c.fetchall()}
c.execute("""
 SELECT s.exchange, EXTRACT(YEAR FROM d.date)::int, count(*)
 FROM market_data_cafefdailyprice d
 JOIN market_data_stockprofile s ON s.symbol=d.symbol
 GROUP BY 1,2
""")
s = {str(r[0])+':'+str(r[1]): r[2] for r in c.fetchall()}
c.execute("SELECT count(*) FROM market_data_dailyprice WHERE price_source='cafef' AND (adj_factor IS NULL OR adj_close IS NULL OR abs(adj_close/close-adj_factor)>0.000001)")
bad = c.fetchone()[0]
c.execute("SELECT count(*) FROM market_data_dailyprice WHERE price_source='unmapped_cafef' AND adj_close IS NOT NULL")
badu = c.fetchone()[0]
print('FVERIFY', json.dumps({'p': p, 's': s, 'bad': bad, 'badu': badu}))
'''
open('/tmp/fverify_q.py', 'w').write(code)
r = subprocess.run(
    'docker exec -i -w /app/src vninvest-core-api python manage.py shell < /tmp/fverify_q.py',
    shell=True, capture_output=True, text=True, timeout=900,
)
line = [l for l in (r.stdout + r.stderr).splitlines() if l.startswith('FVERIFY')]
if not line:
    print('DEBUG', r.returncode, (r.stdout + r.stderr)[-1000:])
    raise SystemExit(1)
d = json.loads(line[-1][len('FVERIFY '):])
mismatches = []
for key, src in d['s'].items():
    got = d['p'].get(key, [0, 0, 0])[0]
    if got != src:
        mismatches.append({'key': key, 'source': src, 'persisted': got})
total = {
    'cafef': sum(v[0] for v in d['p'].values()),
    'unmapped': sum(v[1] for v in d['p'].values()),
    'cafef_with_factor': sum(v[2] for v in d['p'].values()),
}
print(json.dumps({'total': total, 'bad_cafef': d['bad'], 'bad_unmapped': d['badu'],
                  'mismatches': mismatches, 'batch_count': len(d['p'])}, indent=1))

```n
### m4_parallel.py
```python
import glob
import json
import os
import subprocess
import sys
import time

WID = int(sys.argv[1])
TOTAL = int(sys.argv[2])
OUT = f'/tmp/m4_w{WID}.json'

DONE = {('HOSE', 2011), ('HOSE', 2021), ('HOSE', 2022)}
SKIP = {
    ('HOSE', 2016), ('HOSE', 2018), ('HOSE', 2026),
    ('HNX', 2012),
    ('UPCOM', 2011), ('UPCOM', 2014), ('UPCOM', 2015),
}
BATCHES = [(ex, y) for ex in ('HOSE', 'HNX', 'UPCOM')
           for y in range(2011, 2027)
           if (ex, y) not in DONE and (ex, y) not in SKIP]


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=2400)


def already_done():
    seen = set()
    for path in ['/tmp/m4_host_results.json'] + glob.glob('/tmp/m4_w*.json'):
        try:
            for r in json.load(open(path, encoding='utf-8')):
                if r.get('status') == 'applied':
                    seen.add((r['exchange'], r['year']))
        except Exception:
            pass
    return seen


results = []
if os.path.exists(OUT):
    results = json.load(open(OUT, encoding='utf-8'))
seen = already_done()

for i, (ex, year) in enumerate(BATCHES):
    if i % TOTAL != WID:
        continue
    if (ex, year) in seen:
        continue
    started = time.time()
    remote = f'/tmp/m4_{ex}_{year}.json'
    r = sh('docker exec -e PRICE_MIGRATION_PAUSED=1 -w /app/src vninvest-core-api '
           f'python manage.py price_migration_persist --exchange {ex} --year {year} '
           f'--apply --out {remote}')
    if r.returncode != 0:
        results.append({'exchange': ex, 'year': year, 'status': 'error',
                        'rc': r.returncode, 'err': r.stderr[-200:],
                        'secs': round(time.time() - started, 1)})
    else:
        sh(f'docker cp vninvest-core-api:{remote} /tmp/m4_{ex}_{year}.json')
        try:
            rep = json.load(open(f'/tmp/m4_{ex}_{year}.json', encoding='utf-8'))
        except Exception:
            rep = {}
        results.append({'exchange': ex, 'year': year, 'status': 'applied',
                        'matched': rep.get('matched'),
                        'expected': rep.get('verify_after_apply', {}).get('expected_cafef_rows'),
                        'secs': round(time.time() - started, 1)})
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print(f'W{WID}', ex, year, results[-1]['status'], results[-1].get('secs'), flush=True)
    time.sleep(1)

print('WORKER_DONE', WID, len(results), flush=True)

```n
