import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

export interface QueueTierConfig {
  poll_interval_seconds: number;
  max_batch_size: number;
  max_dispatch_per_cycle: number;
}

export interface NumberInputProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  help?: string;
  error?: string;
  disabled?: boolean;
  locked?: boolean;
  lockReason?: string;
  onChange: (value: number) => void;
}

export function NumberInput(props: NumberInputProps) {
  const { id, label, value, min, max, unit, help, error, disabled, locked, lockReason, onChange } = props;
  const lockText = lockReason || "";
  return createElement(
    "div",
    { className: styles.fieldRow, ...(locked ? { "aria-disabled": true } : {}) },
    createElement(
      "label",
      { className: styles.fieldLabel, htmlFor: id },
      label,
      locked
        ? createElement(
            "span",
            { className: styles.fieldLockIcon, title: lockText, role: "img", "aria-label": lockText },
            "\u{1F512}",
          )
        : null,
    ),
    createElement(
      "div",
      { className: styles.fieldInputWrap },
      createElement("input", {
        id,
        "data-field": id,
        type: "number",
        className: error ? `${styles.fieldInput} ${styles.fieldInputError}` : styles.fieldInput,
        value: Number.isFinite(value) ? value : "",
        min,
        max,
        disabled,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": help ? `${id}-help` : undefined,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          onChange(raw === "" ? NaN : parseInt(raw, 10));
        },
      }),
      createElement("span", { className: styles.fieldUnit }, unit),
    ),
    help ? createElement("p", { id: `${id}-help`, className: styles.helpText }, help) : null,
    error ? createElement("p", { className: styles.fieldError, role: "alert" }, error) : null,
  );
}

interface SocQueueTierFieldSetProps {
  tierKey: string;
  label: string;
  config: QueueTierConfig;
  errors: Record<string, string>;
  lockedFields: string[];
  disabled?: boolean;
  schema?: Record<string, { min?: number; max?: number; help?: string }>;
  onChange: (tierKey: string, field: keyof QueueTierConfig, value: number) => void;
}

export function SocQueueTierFieldSet(props: SocQueueTierFieldSetProps) {
  const { t } = useI18n();
  const { tierKey, label, config, errors, lockedFields, disabled, schema, onChange } = props;

  const fields: { field: keyof QueueTierConfig; labelKey: string; min: number; max: number; unitKey: string; helpKey: string }[] = [
    {
      field: "poll_interval_seconds",
      labelKey: "soc.dataops.field_poll_interval_seconds",
      min: 10,
      max: 3600,
      unitKey: "soc.dataops.unit_seconds",
      helpKey: "soc.dataops.field_poll_interval_seconds_help",
    },
    {
      field: "max_batch_size",
      labelKey: "soc.dataops.field_max_batch_size",
      min: 1,
      max: 500,
      unitKey: "soc.dataops.unit_records",
      helpKey: "soc.dataops.field_max_batch_size_help",
    },
    {
      field: "max_dispatch_per_cycle",
      labelKey: "soc.dataops.field_max_dispatch_per_cycle",
      min: 1,
      max: 500,
      unitKey: "soc.dataops.unit_records",
      helpKey: "soc.dataops.field_max_dispatch_per_cycle_help",
    },
  ];

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement("div", { className: styles.sectionCardTitle }, label),
    createElement(
      "div",
      { className: styles.fieldGrid },
      fields.map((f) => {
        const fullKey = `${tierKey}.${f.field}`;
        const tierLocked = lockedFields.includes(fullKey) || lockedFields.includes(tierKey);
        const fieldSchema = schema?.[fullKey];
        return createElement(NumberInput, {
          key: f.field,
          id: fullKey,
          label: `${t(f.labelKey)} \u2014 ${label}`,
          value: config?.[f.field],
          min: fieldSchema?.min ?? f.min,
          max: fieldSchema?.max ?? f.max,
          unit: t(f.unitKey),
          help: fieldSchema?.help ?? t(f.helpKey),
          error: errors[fullKey],
          disabled: disabled || tierLocked,
          locked: tierLocked,
          lockReason: tierLocked ? t("soc.badge.write_block_reason", { reason: t(f.labelKey) }) : undefined,
          onChange: (value) => onChange(tierKey, f.field, value),
        });
      }),
    ),
  );
}
