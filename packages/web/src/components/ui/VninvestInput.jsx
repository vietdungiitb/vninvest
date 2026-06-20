import React from "react";
import { forwardRef } from "react";
import styles from "./VninvestInput.module.css";

/**
 * VninvestInput - Standardized form input component
 * Uses CSS variables from design system for consistent styling
 * Replaces all custom input styles across the codebase
 */
const VninvestInput = forwardRef(function VninvestInput({
  className = "",
  type = "text",
  id,
  label,
  error,
  helperText,
  disabled = false,
  required = false,
  fullWidth = true,
  ...props
}, ref) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  
  const wrapperClass = `${styles.wrapper} ${fullWidth ? "w-full" : ""} ${className}`.trim();
  const inputClass = `${styles.input} ${error ? styles["input--error"] : ""} ${disabled ? styles["input--disabled"] : ""}`.trim();
  const labelClass = `${styles.label} ${required ? styles["label--required"] : ""}`.trim();

  return (
    <div className={wrapperClass}>
      {label && (
        <label htmlFor={inputId} className={labelClass}>
          {label}
          {required && <span className={styles.required} aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={inputClass}
        disabled={disabled}
        required={required}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className={styles.helper}>
          {helperText}
        </p>
      )}
    </div>
  );
});

VninvestInput.displayName = "VninvestInput";

export { VninvestInput };
