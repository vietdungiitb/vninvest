from .ai_advisory_helpers import _parse_prompt_config


def _is_initialized_prompt_config(raw_config) -> bool:
    return isinstance(raw_config, dict) and bool(raw_config)


def ensure_ai_prompt_config_ssot(command_center_cfg):
    canonical_raw = getattr(command_center_cfg, 'ai_prompt_config', None)
    if _is_initialized_prompt_config(canonical_raw):
        return _parse_prompt_config(canonical_raw)

    legacy_cfg = getattr(getattr(command_center_cfg, 'user', None), 'user_config', None)
    legacy_raw = getattr(legacy_cfg, 'ai_prompt_config', None)
    normalized_legacy = _parse_prompt_config(legacy_raw)
    if not _is_initialized_prompt_config(legacy_raw):
        return _parse_prompt_config(canonical_raw)

    command_center_cfg.ai_prompt_config = normalized_legacy
    command_center_cfg.save(update_fields=['ai_prompt_config', 'updated_at'])
    return normalized_legacy


def mirror_ai_prompt_config_to_legacy(user, prompt_config):
    legacy_cfg = getattr(user, 'user_config', None)
    if legacy_cfg is None:
        return

    normalized_prompt_config = _parse_prompt_config(prompt_config)
    if getattr(legacy_cfg, 'ai_prompt_config', None) == normalized_prompt_config:
        return

    legacy_cfg.ai_prompt_config = normalized_prompt_config
    legacy_cfg.save(update_fields=['ai_prompt_config', 'updated_at'])