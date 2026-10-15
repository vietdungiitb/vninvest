"""Dem audit leftovers B3.4 (Wave 3): SubAccount chua phan loai / chua lien ket.

2 bo dem doc lap theo contract dong bang §2:
  (i)  `SubAccount.provider=''` (chua phan loai broker);
  (ii) `SubAccount.broker_config IS NULL` (chua lien ket credential).

Moi field chi AlterField NOT NULL khi bo dem cua CHINH NO = 0
(`broker_config` NULL co the khong bao gio ve 0 vi 0025 chi link khi
duy-nhat-tuong-thich — do la ket qua hop le, khong phai that bai).

Output ASCII (L-B03: khong in tieng Viet co dau ra stdout tren cp1252).
"""
from django.core.management.base import BaseCommand

from user_workspace.models import SubAccount


def count_backfill_gaps() -> dict:
    """Tra 2 bo dem doc lap. Goi truc tiep tu test (fixture, khong doan prod)."""
    return {
        'provider_empty': SubAccount.objects.filter(provider='').count(),
        'broker_config_null': SubAccount.objects.filter(
            broker_config__isnull=True).count(),
    }


class Command(BaseCommand):
    help = (
        'Count SubAccounts with empty provider or NULL broker_config '
        '(Wave 3 B3.4 audit; decides conditional NOT NULL).'
    )

    def handle(self, *args, **options):
        gaps = count_backfill_gaps()
        self.stdout.write(f"provider_empty={gaps['provider_empty']}")
        self.stdout.write(f"broker_config_null={gaps['broker_config_null']}")
        if gaps['provider_empty'] == 0 and gaps['broker_config_null'] == 0:
            self.stdout.write('verdict=clean (both counters are 0)')
        else:
            self.stdout.write(
                'verdict=partial (keep nullable + serializer enforce)')
