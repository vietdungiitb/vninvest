from __future__ import annotations

from portfolio.models import WhaleAdvisory
from portfolio.observability import (
    record_advisory_actionability,
    record_advisory_confidence,
)
from portfolio.tasks_advisory_helpers import (
    _compute_advisory_severity,
    _compute_dark_flow_severity,
    _estimate_advisory_actionability,
    _estimate_advisory_confidence,
)


def _resolve_generated_advisory_severity(
    *,
    severity_override: str | None,
    source: str,
    dark_flow_strength: float | None,
    dark_flow_confidence: str | None,
    matched_value_vnd: float,
    threshold: float,
) -> str:
    if severity_override:
        resolved_severity = str(severity_override).strip().lower()
    elif source == 'dark_flow' and dark_flow_strength is not None:
        resolved_severity = _compute_dark_flow_severity(
            strength=dark_flow_strength,
            confidence=dark_flow_confidence or 'low',
            cvd_change=0.0,
        )
    else:
        resolved_severity = _compute_advisory_severity(matched_value_vnd, float(threshold or 0))

    if resolved_severity not in {
        WhaleAdvisory.SeverityChoices.URGENT,
        WhaleAdvisory.SeverityChoices.WARNING,
        WhaleAdvisory.SeverityChoices.INFO,
    }:
        return WhaleAdvisory.SeverityChoices.INFO
    return resolved_severity


def _normalize_generated_advisory_metadata(
    *,
    advisory_type: str,
    merged_sources: list[str] | None,
    primary_source: str | None,
    threshold_source: str,
) -> dict:
    advisory_type_key = str(advisory_type or WhaleAdvisory.AdvisoryTypeChoices.DEFAULT).strip().lower()
    if advisory_type_key not in {
        WhaleAdvisory.AdvisoryTypeChoices.DEFAULT,
        WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
    }:
        advisory_type_key = WhaleAdvisory.AdvisoryTypeChoices.DEFAULT

    normalized_merged_sources = sorted(
        {str(item).strip().lower() for item in (merged_sources or []) if str(item).strip()}
    )
    normalized_primary_source = str(primary_source or '').strip().lower()
    normalized_threshold_source = str(threshold_source or 'user_default').strip().lower() or 'user_default'
    if normalized_threshold_source not in {'user_default', 'symbol_override'}:
        normalized_threshold_source = 'user_default'
    if not normalized_primary_source and normalized_merged_sources:
        normalized_primary_source = normalized_merged_sources[0]

    return {
        'advisory_type_key': advisory_type_key,
        'normalized_merged_sources': normalized_merged_sources,
        'normalized_primary_source': normalized_primary_source,
        'normalized_threshold_source': normalized_threshold_source,
    }


def _record_generation_quality_metrics(
    *,
    source_key: str,
    matched_value_vnd: float,
    threshold: float,
    dark_flow_strength: float | None,
    normalized_merged_sources: list[str],
    resolved_severity: str,
    use_concise: bool,
) -> None:
    record_advisory_confidence(
        _estimate_advisory_confidence(
            matched_value_vnd=matched_value_vnd,
            threshold=float(threshold or 0),
            dark_flow_strength=dark_flow_strength,
            merged_sources=normalized_merged_sources,
        ),
        source=source_key,
    )
    record_advisory_actionability(
        _estimate_advisory_actionability(
            severity=resolved_severity,
            use_concise=use_concise,
            merged_sources=normalized_merged_sources,
        ),
        factors={
            'severity_weight': 1.0 if resolved_severity == WhaleAdvisory.SeverityChoices.URGENT else 0.75 if resolved_severity == WhaleAdvisory.SeverityChoices.WARNING else 0.5,
            'multi_source_bonus': 0.05 if len(normalized_merged_sources) > 1 else 0.0,
            'concise_penalty': -0.05 if use_concise else 0.0,
        },
    )
