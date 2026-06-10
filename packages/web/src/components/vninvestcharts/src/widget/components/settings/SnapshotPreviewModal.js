import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SnapshotPreviewModal
 *
 * A premium modal for previewing a captured chart snapshot before downloading.
 * Supports dark/light mode context, portal rendering, and i18n localization.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
export function SnapshotPreviewModal({ isOpen, imageDataUrl, isDark, onClose, onSave, }) {
    const { t } = useWidgetI18n();
    const backdropRef = useRef(null);
    const [portalTarget, setPortalTarget] = useState(() => {
        if (typeof document !== "undefined") {
            return document.fullscreenElement || document.body;
        }
        return null;
    });
    useEffect(() => {
        const updateTarget = () => {
            setPortalTarget(document.fullscreenElement || document.body);
        };
        updateTarget();
        document.addEventListener("fullscreenchange", updateTarget);
        return () => {
            document.removeEventListener("fullscreenchange", updateTarget);
        };
    }, []);
    // Close on Escape
    useEffect(() => {
        if (!isOpen)
            return;
        const handler = (e) => {
            if (e.key === "Escape")
                onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);
    if (!isOpen || !imageDataUrl)
        return null;
    const safeT = (key, fallback) => {
        const val = t(key);
        return val === key ? fallback : val;
    };
    return createPortal(_jsx("div", { ref: backdropRef, className: "vnsc-settings-backdrop", "data-testid": "snapshot-preview-backdrop", onClick: (e) => {
            if (e.target === backdropRef.current)
                onClose();
        }, children: _jsxs("div", { className: "vnsc-settings-modal", "data-testid": "snapshot-preview-modal", style: {
                background: "var(--vnsc-bg-primary, #0a0e14)",
                border: "1px solid var(--vnsc-border, #2a2a2a)",
                borderRadius: "8px",
                width: "800px",
                maxWidth: "90vw",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
            }, children: [_jsxs("div", { className: "vnsc-settings-modal__header", children: [_jsx("h2", { className: "vnsc-settings-modal__title", children: safeT("snapshot.preview.title", "Snapshot Preview") }), _jsx("button", { type: "button", className: "vnsc-settings-modal__close", onClick: onClose, title: safeT("settings.dialogClose", "Close"), children: "\u00D7" })] }), _jsxs("div", { className: "vnsc-settings-body", style: {
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "16px",
                        overflowY: "auto",
                    }, children: [_jsx("div", { style: {
                                width: "100%",
                                background: isDark ? "#0f131a" : "#f0f2f5",
                                border: "1px solid var(--vnsc-border, #2a2a2a)",
                                borderRadius: "6px",
                                padding: "12px",
                                boxSizing: "border-box",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                            }, children: _jsx("img", { src: imageDataUrl, alt: "Chart Snapshot Preview", style: {
                                    maxWidth: "100%",
                                    maxHeight: "50vh",
                                    objectFit: "contain",
                                    borderRadius: "4px",
                                    boxShadow: isDark
                                        ? "0 8px 32px rgba(0, 0, 0, 0.6)"
                                        : "0 8px 24px rgba(0, 0, 0, 0.15)",
                                } }) }), _jsxs("div", { style: {
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "12px",
                                width: "100%",
                                marginTop: "4px",
                            }, children: [_jsx("button", { type: "button", className: "vnsc-btn", "data-testid": "snapshot-preview-cancel", onClick: onClose, style: {
                                        padding: "8px 16px",
                                        background: "transparent",
                                        border: "1px solid var(--vnsc-border, #2a2a2a)",
                                        color: "var(--vnsc-text-secondary, #a0a0a0)",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        transition: "all 0.15s ease",
                                    }, children: safeT("snapshot.preview.cancel", "Cancel") }), _jsx("button", { type: "button", className: "vnsc-btn vnsc-btn--accent", "data-testid": "snapshot-preview-save", onClick: onSave, style: {
                                        padding: "8px 20px",
                                        background: "var(--vnsc-accent, #2962ff)",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                        fontWeight: 600,
                                        fontSize: "13px",
                                        boxShadow: "0 4px 12px rgba(41, 98, 255, 0.3)",
                                        transition: "all 0.15s ease",
                                    }, children: safeT("snapshot.preview.save", "Save Image") })] })] })] }) }), portalTarget || document.body);
}
