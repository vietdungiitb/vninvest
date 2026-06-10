import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * WE2 P2-06: ReplayControlBar
 *
 * Control bar for bar replay: play/pause, rewind, step, speed, progress.
 * Uses .vnsc- CSS classes for theme inheritance from .vnsc-root.
 * NO inline color styles — all colors derive from CSS variables.
 */
import { useWidgetI18n } from "../../context/WidgetI18nContext.js";
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
export function ReplayControlBar({ playing, speed, currentBar, totalBars, onPlay, onPause, onRewind, onStepBack, onStepForward, onSpeedChange, onClose, onJumpToLatest, }) {
    const { t } = useWidgetI18n();
    return (_jsxs("div", { className: "vnsc-replay-bar", "data-testid": "replay-bar", children: [_jsx("button", { type: "button", className: "vnsc-replay-bar__btn vnsc-replay-bar__btn--primary", title: playing ? t("replay.pause") : t("replay.play"), onClick: playing ? onPause : onPlay, "data-testid": "replay-play-pause", children: playing ? "⏸" : "▶" }), _jsx("button", { type: "button", className: "vnsc-replay-bar__btn", title: t("replay.rewind"), onClick: onRewind, children: "\u23EE" }), _jsx("button", { type: "button", className: "vnsc-replay-bar__btn", title: t("replay.stepBack"), onClick: onStepBack, children: "\u25C0\u25C0" }), _jsx("button", { type: "button", className: "vnsc-replay-bar__btn", title: t("replay.stepForward"), onClick: onStepForward, children: "\u25B6\u25B6" }), _jsx("button", { type: "button", className: "vnsc-replay-bar__btn", title: t("replay.jumpLatest"), onClick: onJumpToLatest, children: "\u23ED" }), _jsx("div", { className: "vnsc-replay-bar__sep" }), _jsxs("span", { className: "vnsc-replay-bar__label", children: [t("replay.speed", { defaultValue: "Speed" }), ":"] }), _jsx("select", { className: "vnsc-replay-bar__select", value: speed, onChange: (e) => onSpeedChange?.(Number(e.target.value)), children: SPEEDS.map((s) => (_jsxs("option", { value: s, children: [s, "x"] }, s))) }), _jsx("div", { className: "vnsc-replay-bar__sep" }), _jsx("span", { className: "vnsc-replay-bar__status", children: t("replay.progress", { current: currentBar, total: totalBars }) }), _jsx("div", { className: "vnsc-replay-bar__spacer" }), _jsx("button", { type: "button", className: "vnsc-replay-bar__close", title: t("replay.closeBar"), onClick: onClose, children: "\u00D7" })] }));
}
