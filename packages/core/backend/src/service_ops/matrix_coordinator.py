"""Matrix lifecycle helpers for the SOC symbol universe matrix."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from .models import ScrapeMatrix, ScrapeMatrixCell
from .provider_catalog import get_default_provider_ids, normalize_provider_ids


DEFAULT_MATRIX_PROVIDERS = get_default_provider_ids('matrix')
SYMBOL_GROUP_ID_ALIASES = {
    'top100': 'vn100',
}
DEFAULT_SYMBOL_GROUPS = (
    {'id': 'vn30', 'name': 'VN30', 'symbol_count': 30},
    {'id': 'vn100', 'name': 'VN100', 'symbol_count': 100},
)


def normalize_provider_list(providers: list[str] | tuple[str, ...] | None) -> list[str]:
    normalized = normalize_provider_ids(providers, surface='matrix')
    return normalized or list(DEFAULT_MATRIX_PROVIDERS)


def normalize_symbol_group_ids(symbol_group_ids: list[str] | tuple[str, ...] | None) -> list[str]:
    normalized = []
    for group_id in symbol_group_ids or []:
        normalized_id = str(group_id or '').strip().lower().replace(' ', '_')
        normalized_id = SYMBOL_GROUP_ID_ALIASES.get(normalized_id, normalized_id)
        if normalized_id and normalized_id not in normalized:
            normalized.append(normalized_id)
    if normalized:
        return normalized
    return [group['id'] for group in DEFAULT_SYMBOL_GROUPS]


def generate_cycle_id() -> str:
    date_str = timezone.localdate().strftime('%Y%m%d')
    prefix = f'cycle_{date_str}_'
    existing_count = ScrapeMatrix.objects.filter(cycle_id__startswith=prefix).count()
    return f'{prefix}{existing_count + 1:03d}'


def get_latest_monitor_cycle() -> ScrapeMatrix | None:
    return ScrapeMatrix.objects.filter(status__in=['active', 'completing']).order_by('-started_at').first()


class MatrixCoordinator:
    """Quản lý lifecycle của một ScrapeMatrix cycle."""

    def __init__(self, cycle_id: str, providers: list[str]):
        self.cycle_id = cycle_id
        self.providers = normalize_provider_list(providers)

    def create_cycle(self, symbol_group_ids: list[str]) -> ScrapeMatrix:
        group_ids = normalize_symbol_group_ids(symbol_group_ids)
        with transaction.atomic():
            matrix = ScrapeMatrix.objects.create(
                cycle_id=self.cycle_id,
                providers=self.providers,
                total_rows=len(group_ids),
            )
            ScrapeMatrixCell.objects.bulk_create([
                ScrapeMatrixCell(
                    matrix=matrix,
                    symbol_group_id=group_id,
                    provider=provider,
                )
                for group_id in group_ids
                for provider in self.providers
            ])
        return matrix

    def try_claim_cell(self, symbol_group_id: str, provider: str, worker_id: str) -> bool:
        with transaction.atomic():
            try:
                cell = ScrapeMatrixCell.objects.select_for_update().get(
                    matrix__cycle_id=self.cycle_id,
                    symbol_group_id=symbol_group_id,
                    provider=provider,
                    status='pending',
                )
            except ScrapeMatrixCell.DoesNotExist:
                return False

            row_done = ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status='done',
            ).exists()
            if row_done:
                cell.status = 'skipped'
                cell.done_at = timezone.now()
                cell.save(update_fields=['status', 'done_at'])
                return False

            cell.status = 'claimed'
            cell.worker_id = worker_id
            cell.claimed_at = timezone.now()
            cell.save(update_fields=['status', 'worker_id', 'claimed_at'])
            return True

    def mark_cell_working(self, symbol_group_id: str, provider: str, worker_id: str) -> None:
        ScrapeMatrixCell.objects.filter(
            matrix__cycle_id=self.cycle_id,
            symbol_group_id=symbol_group_id,
            provider=provider,
        ).update(status='working', worker_id=worker_id)

    def mark_cell_done(self, symbol_group_id: str, provider: str, symbols_processed: int) -> None:
        with transaction.atomic():
            row_already_done = ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status='done',
            ).exists()
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                provider=provider,
            ).update(
                status='done',
                done_at=timezone.now(),
                symbols_processed=symbols_processed,
                error_detail='',
            )
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status__in=['pending', 'claimed', 'working'],
            ).exclude(provider=provider).update(
                status='skipped',
                done_at=timezone.now(),
            )

            matrix = ScrapeMatrix.objects.select_for_update().get(cycle_id=self.cycle_id)
            if not row_already_done:
                matrix.done_rows += 1
            if matrix.done_rows >= matrix.total_rows:
                matrix.status = 'completed'
                matrix.completed_at = timezone.now()
            elif matrix.done_rows > 0:
                matrix.status = 'completing'
            matrix.save(update_fields=['done_rows', 'status', 'completed_at'])

    def mark_cell_failed(self, symbol_group_id: str, provider: str, error: str) -> None:
        with transaction.atomic():
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                provider=provider,
            ).update(
                status='failed',
                error_detail=error,
                done_at=timezone.now(),
            )

            matrix = ScrapeMatrix.objects.select_for_update().get(cycle_id=self.cycle_id)
            matrix.failed_rows = ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                status='failed',
            ).values('symbol_group_id').distinct().count()
            matrix.save(update_fields=['failed_rows'])

    def abort_cycle(self) -> ScrapeMatrix:
        with transaction.atomic():
            matrix = ScrapeMatrix.objects.select_for_update().get(cycle_id=self.cycle_id)
            if matrix.status != 'aborted':
                matrix.status = 'aborted'
                matrix.completed_at = timezone.now()
                matrix.save(update_fields=['status', 'completed_at'])
                ScrapeMatrixCell.objects.filter(
                    matrix=matrix,
                    status__in=['pending', 'claimed', 'working'],
                ).update(
                    status='skipped',
                    done_at=timezone.now(),
                    error_detail='Cycle aborted by operator.',
                )
            return matrix

    def get_cycle_summary(self) -> dict:
        matrix = ScrapeMatrix.objects.get(cycle_id=self.cycle_id)
        return {
            'cycle_id': matrix.cycle_id,
            'status': matrix.status,
            'progress_pct': round(matrix.progress_pct, 2),
            'total_rows': matrix.total_rows,
            'done_rows': matrix.done_rows,
            'failed_rows': matrix.failed_rows,
            'providers': matrix.providers,
        }