"""SSOT cho ky tinh quota - thang, khong phai ngay.

Ly do tach file: `commercial/tasks.py::_current_billing_period` va
`identity_access/middleware.py` deu can "ky nay la gi", nhung chi tasks.py co
dinh nghia. Middleware phai tu tinh lai => 2 noi dinh nghia moc ky, mau thuan
duoc ngay khi 1 doi. O day mot cho.

**Don vi la THANG, co chu dich, khong phai tai nham.** Bat nguon deu noi thang:
`CoreTenant.api_calls_limit` co `verbose_name='API calls monthly limit'`,
`QuotaRecord` co `period_start`/`period_end` + `unique_together`, hoa don sinh
theo thang, plan catalog dinh muc theo thang. Do la ly do ma truoc day bo dem
NGAY bi so voi han muc THANG.

Counter Redis chi song (`REDIS_KEY_TTL_SECONDS = 86400 * 2`) nen **khong the
cong don 30 ngay tu Redis**. Vi vay can bo dem thang rieng chay song song,
voi TTL den het ky.
"""

from datetime import date, timedelta

# Buffer sau het ky: giua 0h ngay 1 thang sau, moi co so lieu cua thang truoc
# con trong Redis de flush/doi chieu.
PERIOD_TTL_BUFFER_DAYS = 5


def current_billing_period(today: date) -> tuple[date, date]:
    """Ky tinh chay tu 1 den het thang chua `today` (theo gio do)."""
    period_start = today.replace(day=1)
    next_month_anchor = (period_start + timedelta(days=32)).replace(day=1)
    period_end = next_month_anchor - timedelta(days=1)
    return period_start, period_end


def period_slug(today: date) -> str:
    """Khoa chuoi cho ky tinh, vd `2026-09`."""
    return current_billing_period(today)[0].strftime('%Y-%m')


def month_counter_key(tenant_public_id: str, today: date) -> str:
    """Khoa bo dem TICH LUY THANG, tach biet voi bo dem ngay.

    Bo dem ngay giu nguyen hinh thuc `quota:api_calls:{tenant}:{YYYY-MM-DD}`
    de cac bao cao/analytics cu khong phai sua. Bo dem thang lay ten rieng de
    khong bao gio lam vao hai lan dem.
    """
    return f'quota:api_calls:month:{tenant_public_id}:{period_slug(today)}'


def month_counter_ttl(today: date) -> int:
    """TTL giua bo dem thang toi het ky + buffer (giay)."""
    _, period_end = current_billing_period(today)
    days_left = (period_end - today).days + PERIOD_TTL_BUFFER_DAYS
    return max(days_left, 1) * 86400


def month_counter_scan_pattern(today: date) -> str:
    """Glob cho `redis.scan_iter` — **chi** khoa bo dem thang cua ky hien tai.

    Tach rieng de contract voi Redis duoc test truc tiep: mau khoa quet sai
    se lan bo dem NGAY vao ban ghi thang (han muc ~30x len). Co test dung
    `fnmatch` de chung minh mau nay khop khoa thang va KHONG khop khoa ngay.
    """
    return f'quota:api_calls:month:*:{period_slug(today)}'


def month_counter_scan_pattern_for(tenant_public_id: str, today: date) -> str:
    return f'quota:api_calls:month:{tenant_public_id}:{period_slug(today)}'
