"""
Tests for AI Advisory prompt_config parsing and new context builders.
Run:
  python -c "import django; django.setup(); from tests.test_ai_advisory_prompt_config import *; run_all()"
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# ---------------------------------------------------------------------------
# _parse_prompt_config tests
# ---------------------------------------------------------------------------

def test_parse_prompt_config_none():
    from portfolio.ai_advisory_helpers import _parse_prompt_config, _PROMPT_CONFIG_DEFAULTS
    result = _parse_prompt_config(None)
    defaults = _PROMPT_CONFIG_DEFAULTS['sources']
    assert set(result.keys()) == set(defaults.keys()), "Phải trả về đúng set of source_ids"
    assert result['whale']['enabled'] is True
    assert result['fundamental']['enabled'] is False
    assert result['whale']['lookback'] == 180
    assert result['technical']['indicators'] is not None and len(result['technical']['indicators']) > 0
    print("PASS test_parse_prompt_config_none")


def test_parse_prompt_config_override():
    from portfolio.ai_advisory_helpers import _parse_prompt_config
    raw = {
        'version': 2,
        'sources': {
            'whale': {'enabled': False, 'lookback': 90},
            'fundamental': {'enabled': True, 'lookback': 2},
            'technical': {'enabled': True, 'lookback': 20, 'indicators': ['rsi', 'bollinger']},
        }
    }
    result = _parse_prompt_config(raw)
    assert result['whale']['enabled'] is False
    assert result['whale']['lookback'] == 90
    assert result['fundamental']['enabled'] is True
    assert result['fundamental']['lookback'] == 2
    assert result['technical']['indicators'] == ['rsi', 'bollinger']
    # sources not in raw → still present with defaults
    assert result['dark_flow']['enabled'] is True
    print("PASS test_parse_prompt_config_override")


def test_parse_prompt_config_clamp_lookback():
    from portfolio.ai_advisory_helpers import _parse_prompt_config, _PROMPT_CONFIG_REGISTRY
    raw = {
        'sources': {
            'whale': {'enabled': True, 'lookback': 9999},
            'news': {'enabled': True, 'lookback': -5},
        }
    }
    result = _parse_prompt_config(raw)
    assert result['whale']['lookback'] == _PROMPT_CONFIG_REGISTRY['whale']['max']
    assert result['news']['lookback'] == _PROMPT_CONFIG_REGISTRY['news']['min']
    print("PASS test_parse_prompt_config_clamp_lookback")


def test_parse_prompt_config_invalid_indicators():
    from portfolio.ai_advisory_helpers import _parse_prompt_config, VALID_TECHNICAL_INDICATORS
    raw = {
        'sources': {
            'technical': {'enabled': True, 'indicators': ['INVALID_IND', 'rsi']},
        }
    }
    result = _parse_prompt_config(raw)
    assert result['technical']['indicators'] == ['rsi'], "Chỉ lọc indicator hợp lệ"
    print("PASS test_parse_prompt_config_invalid_indicators")


def test_parse_prompt_config_all_invalid_indicators_fallback():
    from portfolio.ai_advisory_helpers import _parse_prompt_config, VALID_TECHNICAL_INDICATORS
    raw = {
        'sources': {
            'technical': {'enabled': True, 'indicators': ['BAD1', 'BAD2']},
        }
    }
    result = _parse_prompt_config(raw)
    # All invalid → fall back to full list
    assert set(result['technical']['indicators']) == VALID_TECHNICAL_INDICATORS
    print("PASS test_parse_prompt_config_all_invalid_indicators_fallback")


# ---------------------------------------------------------------------------
# Context builder smoke tests (offline, no DB required)
# ---------------------------------------------------------------------------

def test_build_fundamental_context_empty_symbol():
    from portfolio.ai_advisory_helpers import _build_fundamental_context_for_prompt
    result = _build_fundamental_context_for_prompt('')
    assert result == '', "Empty symbol phải return empty string"
    print("PASS test_build_fundamental_context_empty_symbol")


def test_build_ownership_context_empty_symbol():
    from portfolio.ai_advisory_helpers import _build_ownership_context_for_prompt
    result = _build_ownership_context_for_prompt('')
    assert result == ''
    print("PASS test_build_ownership_context_empty_symbol")


def test_build_sector_context_empty_symbol():
    from portfolio.ai_advisory_helpers import _build_sector_context_for_prompt
    result = _build_sector_context_for_prompt('')
    assert result == ''
    print("PASS test_build_sector_context_empty_symbol")


# ---------------------------------------------------------------------------
# VALID_TECHNICAL_INDICATORS consistency
# ---------------------------------------------------------------------------

def test_valid_technical_indicators_set():
    from portfolio.ai_advisory_helpers import VALID_TECHNICAL_INDICATORS, _PROMPT_CONFIG_DEFAULTS
    expected_defaults = set(_PROMPT_CONFIG_DEFAULTS['sources']['technical']['indicators'])
    assert expected_defaults.issubset(VALID_TECHNICAL_INDICATORS), \
        "Default indicators phải là subset của VALID_TECHNICAL_INDICATORS"
    print("PASS test_valid_technical_indicators_set")


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

def run_all():
    django.setup()
    tests = [
        test_parse_prompt_config_none,
        test_parse_prompt_config_override,
        test_parse_prompt_config_clamp_lookback,
        test_parse_prompt_config_invalid_indicators,
        test_parse_prompt_config_all_invalid_indicators_fallback,
        test_build_fundamental_context_empty_symbol,
        test_build_ownership_context_empty_symbol,
        test_build_sector_context_empty_symbol,
        test_valid_technical_indicators_set,
    ]
    passed = 0
    failed = 0
    for t in tests:
        try:
            t()
            passed += 1
        except Exception as exc:
            print(f"FAIL {t.__name__}: {exc}")
            failed += 1
    print(f"\n{'='*50}")
    print(f"Results: {passed} passed, {failed} failed")
    return failed == 0


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ok = run_all()
    sys.exit(0 if ok else 1)
