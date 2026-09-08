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

export function ShellField({ label, name, type = "text", value, onChange, placeholder, autoComplete, fieldKey }) {
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

export function ShellEmptyState({ icon = null, title, description, ctaLabel, ctaOnClick, children }) {
  return renderElement(
    "div",
    { className: styles.empty, style: { textAlign: "center", padding: "32px 18px" } },
    icon || renderElement(
      "svg",
      {
        width: 48, height: 48, viewBox: "0 0 48 48", fill: "none",
        style: { margin: "0 auto 16px", opacity: 0.4, display: "block" },
      },
      renderElement("rect", { x: 8, y: 12, width: 32, height: 24, rx: 4, stroke: "var(--text-secondary)", strokeWidth: 2, fill: "none" }),
      renderElement("path", { d: "M16 20h16M16 26h12M16 32h8", stroke: "var(--text-secondary)", strokeWidth: 2, strokeLinecap: "round" }),
    ),
    title ? renderElement("p", { style: { fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" } }, title) : null,
    description ? renderElement("p", { style: { fontSize: 13, color: "var(--text-secondary)", marginBottom: ctaLabel ? 16 : 0 } }, description) : null,
    ctaLabel
      ? renderElement(
        "button",
        {
          className: styles.button,
          onClick: ctaOnClick,
          style: { padding: "8px 20px", fontSize: 13, fontWeight: 600 },
        },
        ctaLabel,
      )
      : null,
    children,
  );
}

export function renderShellPanel(props) {
  return renderElement(ShellPanel, props);
}

export function renderShellPageChrome(props) {
  return renderElement(ShellPageChrome, props);
}
