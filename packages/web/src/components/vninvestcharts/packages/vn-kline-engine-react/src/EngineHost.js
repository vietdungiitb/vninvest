import { jsx as _jsx } from "react/jsx-runtime";
import { useEngineHost } from "./useEngineHost.js";
const hostStyle = {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 240,
    overflow: "hidden",
    touchAction: "none",
};
export function EngineHost(props) {
    const { containerRef, handleClick, handleContextMenu, handleDoubleClick, handlePointerCancel, handlePointerDown, handlePointerEnter, handlePointerMove, handlePointerOut, handlePointerUp, } = useEngineHost(props);
    return (_jsx("div", { ref: containerRef, "data-vn-kline-engine-host": "true", className: props.className, style: { ...hostStyle, ...props.style }, onClick: handleClick, onContextMenu: handleContextMenu, onDoubleClick: handleDoubleClick, onPointerCancel: handlePointerCancel, onPointerDown: handlePointerDown, onPointerEnter: handlePointerEnter, onPointerMove: handlePointerMove, onPointerOut: handlePointerOut, onPointerUp: handlePointerUp }));
}
