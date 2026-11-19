import { createElement, useId } from "react";
import styles from "./ShellPageTemplate.module.css";

function renderElement(type, props, ...children) {
  return createElement(type, props, ...children);
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function ShellMetric({ label, value }) {
  return renderElement(
    "article",
    { className: styles.metric },
    renderElement("span", { className: styles.metricLabel }, label),
    renderElement("strong", { className: styles.metricValue }, value),
  );
}

export function ShellField({ label, name, type = "text", value, onChange, placeholder, autoComplete, fieldKey, disabled }) {
  return renderElement(
    "label",
    { className: styles.field, htmlFor: name, key: fieldKey || name },
    renderElement("span", { className: styles.fieldLabel }, label),
    renderElement("input", {
      id: name,
      name,
      type,
      className: styles.input,
      value,
      onChange,
      placeholder,
      autoComplete,
      // R4.1: trang policy AI cần khoá form khi user chỉ có quyền đọc. Prop là
      // tuỳ chọn nên mọi caller cũ không truyền vẫn render y như trước.
      disabled,
      onClick: type === "date" ? (e) => { try { e.target.showPicker(); } catch {} } : undefined,
      onFocus: type === "date" ? (e) => { try { e.target.showPicker(); } catch {} } : undefined,
    }),
  );
}

export function ShellSelectField({ label, name, value, options, onChange, fieldKey }) {
  return renderElement(
    "label",
    { className: styles.field, htmlFor: name, key: fieldKey || name },
    renderElement("span", { className: styles.fieldLabel }, label),
    renderElement(
      "select",
      {
        id: name,
        name,
        className: styles.select,
        value,
        onChange,
      },
      options.map((option) =>
        renderElement(
          "option",
          { key: option.key, value: option.key },
          option.label,
        ),
      ),
    ),
  );
}

export function ShellPanel({ title, subtitle, actions = null, children, className = "", as = "article" }) {
  return renderElement(
    as,
    { className: joinClassNames(styles.panel, className) },
    title || subtitle || actions
      ? renderElement(
          "div",
          { className: styles.panelHeader },
          renderElement(
            "div",
            null,
            title ? renderElement("h2", { className: styles.panelTitle }, title) : null,
            subtitle ? renderElement("p", { className: styles.panelSubtitle }, subtitle) : null,
          ),
          actions,
        )
      : null,
    children,
  );
}

export function ShellPageChrome({
  eyebrow,
  title,
  description,
  badge = null,
  actions = null,
  metrics = [],
  notice = "",
  error = "",
  children,
  className = "",
  id,
}) {
  const autoId = useId();
  const resolvedId = id || `shell-${autoId.replace(/:/g, "")}`;
  const titleId = `${resolvedId}-title`;
  return renderElement(
    "div",
    {
      className: joinClassNames(styles.shellPage, className),
      role: "region",
      "aria-labelledby": titleId,
    },
    renderElement(
      "header",
      { className: styles.hero },
      eyebrow ? renderElement("span", { className: styles.eyebrow }, eyebrow) : null,
      renderElement(
        "div",
        { className: styles.titleRow },
        renderElement(
          "div",
          null,
          renderElement("h1", { id: titleId, className: styles.title }, title),
          description ? renderElement("p", { className: styles.description }, description) : null,
        ),
        badge,
        actions,
      ),
    ),
    metrics.length > 0 ? renderElement("section", { className: styles.metrics }, metrics) : null,
    notice
      ? renderElement(
          "div",
          {
            className: `${styles.banner} ${styles.bannerNotice}`,
            role: "status",
            "aria-live": "polite",
          },
          notice,
        )
      : null,
    error
      ? renderElement(
          "div",
          {
            className: `${styles.banner} ${styles.bannerError}`,
            role: "alert",
          },
          error,
        )
      : null,
    children,
  );
}

// Compatibility wrappers for existing shell pages that still call render* helpers.
export function renderShellMetric(label, value) {
  return renderElement(ShellMetric, { key: label, label, value });
}

export function renderShellField(props) {
  return renderElement(ShellField, props);
}

export function renderShellSelectField(props) {
  return renderElement(ShellSelectField, props);
}

// W1-chrome: bản duplicate nội bộ đã gỡ — 1 nguồn duy nhất là ShellEmptyState.tsx.
export { ShellEmptyState } from "./ShellEmptyState.js";

export function renderShellPanel(props) {
  return renderElement(ShellPanel, props);
}

export function renderShellPageChrome(props) {
  return renderElement(ShellPageChrome, props);
}
