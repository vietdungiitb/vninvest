import { createElement } from "react";

export const SHELL_PAGE_TEMPLATE_STYLES = `
.shellPage {
  --shell-ink: #102a43;
  --shell-muted: #486581;
  --shell-accent: #006d77;
  --shell-accent-soft: rgba(0, 109, 119, 0.12);
  --shell-signal: #ff7f50;
  --shell-signal-soft: rgba(255, 127, 80, 0.12);
  --shell-border: rgba(16, 42, 67, 0.14);
  --shell-surface: rgba(255, 252, 248, 0.88);
  --shell-shadow: 0 22px 48px rgba(16, 42, 67, 0.12);
  background:
    radial-gradient(circle at top right, rgba(255, 179, 71, 0.22), transparent 30%),
    radial-gradient(circle at left center, rgba(0, 109, 119, 0.12), transparent 32%),
    linear-gradient(160deg, #fffaf1 0%, #f4fbfb 52%, #eef7f2 100%);
  color: var(--shell-ink);
  font-family: "Segoe UI", "Arial", sans-serif;
  padding: 28px;
  border-radius: 28px;
  box-shadow: var(--shell-shadow);
}

.shellPage__hero {
  display: grid;
  gap: 12px;
  margin-bottom: 22px;
}

.shellPage__eyebrow {
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 700;
  color: var(--shell-accent);
}

.shellPage__titleRow {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
}

.shellPage__title {
  margin: 0;
  font-size: 34px;
  line-height: 1.05;
}

.shellPage__description {
  margin: 0;
  max-width: 720px;
  color: var(--shell-muted);
  font-size: 15px;
  line-height: 1.65;
}

.shellPage__heroBadge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--shell-border);
  color: var(--shell-muted);
  font-weight: 600;
}

.shellPage__statusDot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--shell-signal);
  box-shadow: 0 0 0 6px rgba(255, 127, 80, 0.16);
}

.shellPage__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}

.shellPage__metric {
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid var(--shell-border);
  border-radius: 20px;
  padding: 16px 18px;
}

.shellPage__metricLabel {
  display: block;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--shell-muted);
  margin-bottom: 10px;
}

.shellPage__metricValue {
  font-size: 21px;
  font-weight: 700;
}

.shellPage__banner {
  border-radius: 18px;
  padding: 14px 16px;
  margin-bottom: 18px;
  font-size: 14px;
  line-height: 1.5;
}

.shellPage__banner--notice {
  background: var(--shell-accent-soft);
  color: var(--shell-accent);
  border: 1px solid rgba(0, 109, 119, 0.18);
}

.shellPage__banner--error {
  background: var(--shell-signal-soft);
  color: #8a3b12;
  border: 1px solid rgba(255, 127, 80, 0.22);
}

.shellPage__bodyGrid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 18px;
}

.shellPage__stack {
  display: grid;
  gap: 18px;
}

.shellPage__panel {
  background: var(--shell-surface);
  border: 1px solid var(--shell-border);
  border-radius: 24px;
  padding: 20px;
  backdrop-filter: blur(12px);
}

.shellPage__panelHeader {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.shellPage__panelTitle {
  margin: 0 0 6px;
  font-size: 21px;
}

.shellPage__panelSubtitle {
  margin: 0;
  color: var(--shell-muted);
  font-size: 14px;
  line-height: 1.6;
}

.shellPage__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.shellPage__button {
  border: 0;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.shellPage__button:hover {
  transform: translateY(-1px);
}

.shellPage__button:disabled {
  cursor: wait;
  opacity: 0.68;
  transform: none;
}

.shellPage__button--primary {
  background: linear-gradient(135deg, #006d77 0%, #0a9396 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(0, 109, 119, 0.22);
}

.shellPage__button--secondary {
  background: rgba(255, 255, 255, 0.9);
  color: var(--shell-ink);
  border: 1px solid var(--shell-border);
}

.shellPage__button--signal {
  background: linear-gradient(135deg, #ff7f50 0%, #ffb347 100%);
  color: #fff;
  box-shadow: 0 14px 28px rgba(255, 127, 80, 0.24);
}

.shellPage__form {
  display: grid;
  gap: 14px;
}

.shellPage__formGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.shellPage__field {
  display: grid;
  gap: 8px;
}

.shellPage__fieldLabel {
  font-size: 13px;
  font-weight: 700;
  color: var(--shell-muted);
}

.shellPage__input,
.shellPage__select {
  width: 100%;
  border-radius: 14px;
  border: 1px solid rgba(16, 42, 67, 0.16);
  background: rgba(255, 255, 255, 0.92);
  padding: 12px 14px;
  font-size: 14px;
  color: var(--shell-ink);
  box-sizing: border-box;
}

.shellPage__summaryGrid,
.shellPage__list {
  display: grid;
  gap: 12px;
}

.shellPage__summaryGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 18px;
}

.shellPage__surfaceCard,
.shellPage__listItem {
  border-radius: 18px;
  border: 1px solid var(--shell-border);
  background: rgba(255, 255, 255, 0.84);
  padding: 14px 16px;
}

.shellPage__listItemHeader {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.shellPage__itemTitle {
  margin: 0;
  font-size: 16px;
}

.shellPage__itemMeta {
  margin: 0;
  color: var(--shell-muted);
  font-size: 13px;
  line-height: 1.6;
}

.shellPage__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--shell-accent-soft);
  color: var(--shell-accent);
  font-size: 12px;
  font-weight: 700;
}

.shellPage__empty {
  border-radius: 18px;
  border: 1px dashed rgba(16, 42, 67, 0.18);
  padding: 18px;
  color: var(--shell-muted);
  background: rgba(255, 255, 255, 0.6);
}

@media (max-width: 980px) {
  .shellPage {
    padding: 22px;
  }

  .shellPage__metrics,
  .shellPage__bodyGrid,
  .shellPage__summaryGrid,
  .shellPage__formGrid {
    grid-template-columns: 1fr;
  }
}
`;

function renderElement(type, props, ...children) {
  return createElement(type, props, ...children);
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function ShellMetric({ label, value }) {
  return renderElement(
    "article",
    { className: "shellPage__metric" },
    renderElement("span", { className: "shellPage__metricLabel" }, label),
    renderElement("strong", { className: "shellPage__metricValue" }, value),
  );
}

export function ShellField({ label, name, type = "text", value, onChange, placeholder, autoComplete, fieldKey }) {
  return renderElement(
    "label",
    { className: "shellPage__field", htmlFor: name, key: fieldKey || name },
    renderElement("span", { className: "shellPage__fieldLabel" }, label),
    renderElement("input", {
      id: name,
      name,
      type,
      className: "shellPage__input",
      value,
      onChange,
      placeholder,
      autoComplete,
    }),
  );
}

export function ShellSelectField({ label, name, value, options, onChange, fieldKey }) {
  return renderElement(
    "label",
    { className: "shellPage__field", htmlFor: name, key: fieldKey || name },
    renderElement("span", { className: "shellPage__fieldLabel" }, label),
    renderElement(
      "select",
      {
        id: name,
        name,
        className: "shellPage__select",
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
    { className: joinClassNames("shellPage__panel", className) },
    title || subtitle || actions
      ? renderElement(
          "div",
          { className: "shellPage__panelHeader" },
          renderElement(
            "div",
            null,
            title ? renderElement("h2", { className: "shellPage__panelTitle" }, title) : null,
            subtitle ? renderElement("p", { className: "shellPage__panelSubtitle" }, subtitle) : null,
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
}) {
  return renderElement(
    "main",
    { className: joinClassNames("shellPage", className) },
    renderElement("style", null, SHELL_PAGE_TEMPLATE_STYLES),
    renderElement(
      "header",
      { className: "shellPage__hero" },
      eyebrow ? renderElement("span", { className: "shellPage__eyebrow" }, eyebrow) : null,
      renderElement(
        "div",
        { className: "shellPage__titleRow" },
        renderElement(
          "div",
          null,
          renderElement("h1", { className: "shellPage__title" }, title),
          description ? renderElement("p", { className: "shellPage__description" }, description) : null,
        ),
        badge,
      ),
    ),
    metrics.length > 0 ? renderElement("section", { className: "shellPage__metrics" }, metrics) : null,
    notice
      ? renderElement(
          "div",
          {
            className: "shellPage__banner shellPage__banner--notice",
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
            className: "shellPage__banner shellPage__banner--error",
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

export function renderShellPanel(props) {
  return renderElement(ShellPanel, props);
}

export function renderShellPageChrome(props) {
  return renderElement(ShellPageChrome, props);
}