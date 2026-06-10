import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * OB-M03 — PATTokenModal
 * Source selector modal: Binance info, Offline file loader, VNInvest token/login.
 * Never logs PAT values to console.
 */
import { useState, useRef, useEffect } from "react";
import { useDemoI18n } from "../i18n.js";
import { DataSourceSwitcher } from "./DataSourceSwitcher.js";
function parseCSVBars(text) {
    const lines = text.trim().split("\n").filter(Boolean);
    if (lines.length < 2)
        return [];
    const firstField = lines[0].split(",")[0].trim().replace(/"/g, "");
    const hasHeader = isNaN(Number(firstField)) && isNaN(Date.parse(firstField) / 1000);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.flatMap((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
        if (cols.length < 5)
            return [];
        const [dateStr, o, h, l, c, v = "0"] = cols;
        const ts = isNaN(Number(dateStr)) ? Date.parse(dateStr) : Number(dateStr) * (Number(dateStr) < 1e12 ? 1000 : 1);
        if (!ts || isNaN(ts))
            return [];
        const open = Number(o), high = Number(h), low = Number(l), close = Number(c), volume = Number(v);
        if ([open, high, low, close].some(isNaN))
            return [];
        return [{ timestamp: ts, open, high, low, close, volume: isNaN(volume) ? 0 : volume }];
    });
}
export function PATTokenModal({ isOpen, client, activeSource, onSourceChange, onClose, onSaved, onConfigChange, onFileLoaded, initialTab = "paste", }) {
    const { t } = useDemoI18n();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [pasteValue, setPasteValue] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [loadedFileName, setLoadedFileName] = useState(null);
    const [apiBaseInput, setApiBaseInput] = useState(() => client.getBase());
    const fileInputRef = useRef(null);
    const backdropRef = useRef(null);
    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
            setPasteValue("");
            setUsername("");
            setPassword("");
            setStatus("idle");
            setErrorMsg("");
            setApiBaseInput(client.getBase());
        }
    }, [client, initialTab, isOpen]);
    function handleBackdropClick(e) {
        if (e.target === backdropRef.current)
            onClose();
    }
    function applyApiBaseInput() {
        const trimmed = apiBaseInput.trim().replace(/\/+$/, "");
        if (!trimmed) {
            return { base: client.getBase(), changed: false };
        }
        const currentBase = client.getBase();
        const changed = trimmed !== currentBase;
        if (changed) {
            client.setBase(trimmed);
        }
        setApiBaseInput(trimmed);
        return { base: trimmed, changed };
    }
    function handleSaveToken() {
        const token = pasteValue.trim();
        if (!token) {
            setStatus("error");
            setErrorMsg(t("vninvest.error.noPAT"));
            return;
        }
        applyApiBaseInput();
        client.setPAT(token);
        onConfigChange?.();
        setStatus("success");
        onSaved(true);
    }
    function handleClearToken() {
        client.setPAT("");
        setPasteValue("");
        setStatus("idle");
        onSaved(false);
    }
    function handleSaveBase() {
        const { changed } = applyApiBaseInput();
        if (changed) {
            onConfigChange?.();
        }
    }
    async function handleLogin() {
        const u = username.trim();
        const p = password.trim();
        if (!u || !p) {
            setStatus("error");
            setErrorMsg(t("vninvest.patModal.status.error"));
            return;
        }
        setStatus("loading");
        setErrorMsg("");
        try {
            const { base } = applyApiBaseInput();
            const res = await fetch(`${base}/api/auth/token/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: u, password: p }),
            });
            if (!res.ok)
                throw new Error("AUTH_FAILED");
            const data = await res.json();
            const accessToken = data.access;
            if (!accessToken || typeof accessToken !== "string")
                throw new Error("NO_TOKEN");
            client.setPAT(accessToken);
            onConfigChange?.();
            setStatus("success");
            onSaved(true);
        }
        catch {
            setStatus("error");
            setErrorMsg(t("vninvest.patModal.status.error"));
        }
    }
    function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result;
            if (typeof text !== "string")
                return;
            const bars = parseCSVBars(text);
            if (bars.length === 0) {
                setStatus("error");
                setErrorMsg(t("dataSource.offline.hint"));
                return;
            }
            setLoadedFileName(file.name);
            setStatus("success");
            onFileLoaded?.(bars, file.name);
        };
        reader.readAsText(file);
        // Reset input so same file can be re-selected
        e.target.value = "";
    }
    if (!isOpen)
        return null;
    return (_jsx("div", { ref: backdropRef, className: "gc-modal-backdrop", role: "dialog", "aria-modal": "true", "aria-label": t("vninvest.patModal.title"), onClick: handleBackdropClick, children: _jsxs("div", { className: "gc-modal gc-pat-modal", children: [_jsxs("div", { className: "gc-modal__header", children: [_jsx("span", { className: "gc-modal__title", children: t("vninvest.patModal.title") }), _jsx("button", { className: "gc-modal__close", onClick: onClose, type: "button", "aria-label": t("settings.dialogClose"), children: "\u2715" })] }), _jsxs("div", { className: "gc-modal__body", children: [_jsxs("div", { className: "gc-pat-modal__source", children: [_jsx("div", { className: "gc-form-label", children: t("dataSource.label") }), _jsx(DataSourceSwitcher, { activeSource: activeSource, onSwitch: onSourceChange })] }), activeSource === "binance" && (_jsxs("div", { className: "gc-pat-source-info", children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", style: { flexShrink: 0, marginTop: 2 }, children: [_jsx("circle", { cx: "8", cy: "8", r: "7", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "5", x2: "8", y2: "9", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("circle", { cx: "8", cy: "11.5", r: "0.75", fill: "currentColor" })] }), _jsx("span", { children: t("dataSource.binance.info") })] })), activeSource === "offline" && (_jsxs("div", { className: "gc-pat-offline", children: [_jsx("p", { className: "gc-form-label", children: t("dataSource.offline.selectFile") }), _jsx("p", { className: "gc-pat-offline__hint", children: t("dataSource.offline.hint") }), _jsxs("div", { className: "gc-pat-tab__actions", children: [_jsx("button", { className: "gc-btn gc-btn--primary", type: "button", onClick: () => fileInputRef.current?.click(), children: t("dataSource.offline.selectFile") }), loadedFileName && (_jsxs("span", { className: "gc-pat-offline__loaded", children: [t("dataSource.offline.loaded"), " ", _jsx("strong", { children: loadedFileName })] }))] }), _jsx("input", { ref: fileInputRef, type: "file", accept: ".csv,.tsv,.txt,.json", hidden: true, onChange: handleFileChange })] })), activeSource === "vninvest" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "gc-pat-tab", children: [_jsx("label", { htmlFor: "gc-api-base-input", className: "gc-form-label", children: t("vninvest.patModal.input.serverUrl") }), _jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx("input", { id: "gc-api-base-input", className: "gc-form-input", type: "url", value: apiBaseInput, onChange: (e) => setApiBaseInput(e.target.value), placeholder: "http://127.0.0.1", autoComplete: "off", onKeyDown: (e) => { if (e.key === "Enter")
                                                        handleSaveBase(); }, style: { flex: 1 } }), _jsx("button", { className: "gc-btn gc-btn--ghost", onClick: handleSaveBase, type: "button", children: t("vninvest.patModal.btn.setServer") })] })] }), _jsxs("div", { className: "gc-modal__tabs", children: [_jsx("button", { className: `gc-modal__tab ${activeTab === "paste" ? "gc-modal__tab--active" : ""}`, onClick: () => setActiveTab("paste"), type: "button", children: t("vninvest.patModal.tab.paste") }), _jsx("button", { className: `gc-modal__tab ${activeTab === "login" ? "gc-modal__tab--active" : ""}`, onClick: () => setActiveTab("login"), type: "button", children: t("vninvest.patModal.tab.login") })] }), activeTab === "paste" && (_jsxs("div", { className: "gc-pat-tab", children: [_jsx("label", { htmlFor: "gc-pat-input", className: "gc-form-label", children: t("vninvest.patModal.input.token") }), _jsx("input", { id: "gc-pat-input", className: "gc-form-input", type: "password", value: pasteValue, onChange: (e) => setPasteValue(e.target.value), placeholder: t("vninvest.patModal.input.token"), autoComplete: "off" }), _jsxs("div", { className: "gc-pat-tab__actions", children: [_jsx("button", { className: "gc-btn gc-btn--primary", onClick: handleSaveToken, type: "button", children: t("vninvest.patModal.btn.save") }), _jsx("button", { className: "gc-btn gc-btn--ghost", onClick: handleClearToken, type: "button", children: t("vninvest.patModal.btn.clear") })] })] })), activeTab === "login" && (_jsxs("div", { className: "gc-login-tab", children: [_jsx("label", { htmlFor: "gc-login-username", className: "gc-form-label", children: t("vninvest.patModal.input.username") }), _jsx("input", { id: "gc-login-username", className: "gc-form-input", type: "text", value: username, onChange: (e) => setUsername(e.target.value), autoComplete: "username" }), _jsx("label", { htmlFor: "gc-login-password", className: "gc-form-label", children: t("vninvest.patModal.input.password") }), _jsx("input", { id: "gc-login-password", className: "gc-form-input", type: "password", value: password, onChange: (e) => setPassword(e.target.value), autoComplete: "current-password" }), _jsx("div", { className: "gc-pat-tab__actions", children: _jsx("button", { className: "gc-btn gc-btn--primary", onClick: () => void handleLogin(), type: "button", disabled: status === "loading", children: status === "loading" ? t("common.loading") : t("vninvest.patModal.btn.login") }) })] }))] })), status === "success" && (_jsx("div", { className: "gc-form-feedback gc-form-feedback--success", children: t("vninvest.patModal.status.success") })), status === "error" && (_jsx("div", { className: "gc-form-feedback gc-form-feedback--error", children: errorMsg }))] })] }) }));
}
