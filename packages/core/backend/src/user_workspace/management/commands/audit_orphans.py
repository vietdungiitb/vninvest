import json
import sys
from django.core.management.base import BaseCommand
from django.forms.models import model_to_dict
from django.db import transaction
from user_workspace.models import (
    Portfolio,
    Transaction,
    Watchlist,
    TrackedSymbol,
    PriceAlert,
    SubAccount,
    QuarantinedRecord
)

class Command(BaseCommand):
    help = "Quét kiểm toán tiền di trú và cô lập dữ liệu mồ côi (tenant_id is null) trong user_workspace."

    def add_arguments(self, parser):
        parser.add_argument(
            "--quarantine",
            action="store_true",
            help="Thực hiện cô lập các bản ghi mồ côi vào bảng QuarantinedRecord",
        )

    def handle(self, *args, **options):
        quarantine_action = options["quarantine"]

        targets = [
            {"model": Portfolio, "name": "Portfolio", "table": "user_workspace_portfolio"},
            {"model": Transaction, "name": "Transaction", "table": "user_workspace_transaction"},
            {"model": Watchlist, "name": "Watchlist", "table": "user_workspace_watchlist"},
            {"model": TrackedSymbol, "name": "TrackedSymbol", "table": "user_workspace_trackedsymbol"},
            {"model": PriceAlert, "name": "PriceAlert", "table": "user_workspace_pricealert"},
            {"model": SubAccount, "name": "SubAccount", "table": "user_workspace_subaccount"},
        ]

        report = []
        total_orphans = 0

        self.stdout.write("--- BẮT ĐẦU QUÉT KIỂM TOÁN DỮ LIỆU MỒ CÔI ---")

        for target in targets:
            model = target["model"]
            model_name = target["name"]
            table_name = target["table"]

            # Quét các bản ghi mồ côi (tenant_id is null)
            orphans = model.objects.filter(tenant__isnull=True)
            orphan_count = orphans.count()
            total_orphans += orphan_count

            pks = list(orphans.values_list("pk", flat=True)[:10])

            report_item = {
                "table": table_name,
                "orphan_count": orphan_count,
                "sample_primary_keys": pks,
                "reason": "tenant_id is null"
            }
            report.append(report_item)

            if orphan_count > 0:
                self.stdout.write(
                    self.style.WARNING(
                        f"Phát hiện {orphan_count} bản ghi mồ côi tại bảng {table_name}. Các PKs mẫu: {pks}"
                    )
                )

                if quarantine_action:
                    self.stdout.write(f"Đang thực hiện cô lập {orphan_count} bản ghi của {model_name}...")
                    with transaction.atomic():
                        for record in orphans:
                            # Serialize dữ liệu bản ghi thô
                            data_dict = model_to_dict(record)
                            # Convert decimal, datetime to string to be JSON serializable
                            for key, val in data_dict.items():
                                if hasattr(val, "isoformat"):
                                    data_dict[key] = val.isoformat()
                                elif hasattr(val, "to_eng_string"):
                                    data_dict[key] = str(val)

                            QuarantinedRecord.objects.create(
                                model_name=model_name,
                                original_id=record.pk,
                                data=data_dict,
                                reason="tenant_id is null in pre-migration audit"
                            )
                        self.stdout.write(self.style.SUCCESS(f"Cô lập thành công các bản ghi của {model_name}."))

        self.stdout.write("\n--- BÁO CÁO TOÀN DIỆN DẠNG JSON ---")
        self.stdout.write(json.dumps(report, indent=2))

        if total_orphans > 0:
            self.stdout.write(
                self.style.ERROR(
                    f"\n[CRITICAL FAILURE] Tổng cộng có {total_orphans} bản ghi mồ côi được phát hiện."
                )
            )
            if not quarantine_action:
                self.stdout.write(
                    self.style.NOTICE(
                        "Chạy lại lệnh với option `--quarantine` để cô lập dữ liệu mồ côi ra bảng tạm."
                    )
                )
            # Từ chối chạy tiếp (exit 1) để block migration hoặc CI/CD pipeline
            sys.exit(1)
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "\n[SUCCESS] Kiểm toán sạch. Không phát hiện bản ghi mồ côi nào."
                )
            )
            sys.exit(0)
