"""Phase 3 schema contract — fail-before (2026-11-28)."""
from market_data.models import CorporateAction, DailyPrice, PriceRebaseRun


def _names(model):
    return {field.name for field in model._meta.get_fields()}


def test_daily_price_has_anchor_fields():
    assert {'base_as_of', 'adj_basis'} <= _names(DailyPrice)


def test_corporate_action_has_rights_fields():
    assert {'rights_ratio_pct', 'rights_issue_price'} <= _names(CorporateAction)


def test_rebase_run_has_sample_fields():
    assert {'events_hash', 'sample_verdict', 'sample_report'} <= _names(PriceRebaseRun)
