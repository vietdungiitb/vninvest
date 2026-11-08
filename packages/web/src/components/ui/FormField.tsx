import { createElement } from "react";
import type { ReactNode } from "react";

export interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  children?: ReactNode;
}

/**
 * Shared form field primitive (Phase B1.1).
 *
 * Wraps a label + control + error/hint with consistent a11y wiring:
 * - label htmlFor linked to control id
 * - aria-invalid + aria-describedby on the control (consumer passes id via children? no — consumer sets aria-* on the control itself; this component only renders the describedby target)
 * - error text rendered with role="alert" and id `${htmlFor}-error`
 * - hint text rendered with id `${htmlFor}-hint`
 *
 * Consumers are expected to set `aria-invalid={!!error}` and
 * `aria-describedby` to `${htmlFor}-error ${htmlFor}-hint` on the control.
 */
export function FormField({ label, htmlFor, error, hint, required, children }: FormFieldProps) {
  const e = createElement;
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;

  return e("div", { className: "form-field" }, [
    e("label", { key: "label", htmlFor, className: "form-field__label" }, [
      label,
    ]),
    required ? e("span", { key: "req", className: "form-field__required", "aria-hidden": "true" }, " *") : null,
    e("div", { key: "control", className: "form-field__control" }, children),
    hint ? e("p", { key: "hint", id: hintId, className: "form-field__hint" }, hint) : null,
    error
      ? e("p", { key: "error", id: errorId, className: "form-field__error", role: "alert" }, error)
      : null,
  ]);
}

export default FormField;