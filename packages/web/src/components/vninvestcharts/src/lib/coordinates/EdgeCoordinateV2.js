import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { hexToRGBA, isDefined } from "../utils/index.js";
/* eslint-disable react/prop-types */
export function renderSVG(props) {
    const { className } = props;
    const edge = helper(props);
    if (edge === null)
        return null;
    let line, coordinateBase, coordinate;
    if (isDefined(edge.line)) {
        const edgeLine = edge.line;
        line = _jsx("line", { className: "vninvestcharts-cross-hair", opacity: edgeLine.opacity, stroke: edgeLine.stroke, x1: edgeLine.x1, y1: edgeLine.y1, x2: edgeLine.x2, y2: edgeLine.y2 });
    }
    if (isDefined(edge.coordinateBase)) {
        const edgeCoordinateBase = edge.coordinateBase;
        const edgeCoordinate = edge.coordinate;
        const { rectWidth, rectHeight, arrowWidth } = edgeCoordinateBase;
        const path = edge.orient === "left"
            ? `M0,0L0,${rectHeight}L${rectWidth},${rectHeight}L${rectWidth + arrowWidth},10L${rectWidth},0L0,0L0,0`
            : `M0,${arrowWidth}L${arrowWidth},${rectHeight}L${rectWidth + arrowWidth},${rectHeight}L${rectWidth + arrowWidth},0L${arrowWidth},0L0,${arrowWidth}`;
        coordinateBase = edge.orient === "left" || edge.orient === "right"
            ? _jsx("g", { transform: `translate(${edgeCoordinateBase.edgeXRect},${edgeCoordinateBase.edgeYRect})`, children: _jsx("path", { d: path, className: "react-stockchart-text-background", height: rectHeight, width: rectWidth, fill: edgeCoordinateBase.fill, opacity: edgeCoordinateBase.opacity }, 1) })
            : _jsx("rect", { className: "react-stockchart-text-background", x: edgeCoordinateBase.edgeXRect, y: edgeCoordinateBase.edgeYRect, height: rectHeight, width: rectWidth, fill: edgeCoordinateBase.fill, opacity: edgeCoordinateBase.opacity }, 1);
        coordinate = (_jsx("text", { x: edgeCoordinate.edgeXText, y: edgeCoordinate.edgeYText, textAnchor: edgeCoordinate.textAnchor, fontFamily: edgeCoordinate.fontFamily, fontSize: edgeCoordinate.fontSize, dy: ".32em", fill: edgeCoordinate.textFill, children: edgeCoordinate.displayCoordinate }, 2));
    }
    return (_jsxs("g", { className: className, children: [line, coordinateBase, coordinate] }));
}
/* eslint-enable react/prop-types */
function helper(props) {
    const { coordinate: displayCoordinate, show, type, orient, edgeAt, hideLine } = props;
    const { fill, opacity, fontFamily, fontSize, textFill, lineStroke, lineOpacity, arrowWidth } = props;
    const { rectWidth, rectHeight } = props;
    const { x1, y1, x2, y2, dx } = props;
    if (!show)
        return null;
    let edgeXRect, edgeYRect, edgeXText, edgeYText;
    if (type === "horizontal") {
        edgeXRect = dx + ((orient === "right") ? edgeAt + 1 : edgeAt - rectWidth - arrowWidth - 1);
        edgeYRect = y1 - (rectHeight / 2);
        edgeXText = dx + ((orient === "right") ? edgeAt + (rectWidth / 2) + arrowWidth : edgeAt - (rectWidth / 2) - arrowWidth);
        edgeYText = y1;
    }
    else {
        edgeXRect = x1 - (rectWidth / 2);
        edgeYRect = (orient === "bottom") ? edgeAt : edgeAt - rectHeight;
        edgeXText = x1;
        edgeYText = (orient === "bottom") ? edgeAt + (rectHeight / 2) : edgeAt - (rectHeight / 2);
    }
    let coordinateBase, coordinate;
    const textAnchor = "middle";
    if (isDefined(displayCoordinate)) {
        coordinateBase = {
            edgeXRect, edgeYRect, rectHeight, rectWidth, fill, opacity, arrowWidth
        };
        coordinate = {
            edgeXText, edgeYText, textAnchor, fontFamily, fontSize, textFill, displayCoordinate
        };
    }
    const line = hideLine ? undefined : {
        opacity: lineOpacity, stroke: lineStroke, x1, y1, x2, y2
    };
    return {
        coordinateBase, coordinate, line, orient
    };
}
export function drawOnCanvas(ctx, props) {
    const edge = helper(props);
    if (edge === null)
        return;
    if (isDefined(edge.coordinateBase)) {
        const edgeCoordinateBase = edge.coordinateBase;
        const edgeCoordinate = edge.coordinate;
        const edgeLine = edge.line;
        const { rectWidth, rectHeight, arrowWidth } = edgeCoordinateBase;
        ctx.fillStyle = hexToRGBA(edgeCoordinateBase.fill, edgeCoordinateBase.opacity);
        const x = edgeCoordinateBase.edgeXRect;
        const y = edgeCoordinateBase.edgeYRect;
        ctx.beginPath();
        if (edge.orient === "right") {
            ctx.moveTo(x, y + rectHeight / 2);
            ctx.lineTo(x + arrowWidth, y);
            ctx.lineTo(x + rectWidth + arrowWidth, y);
            ctx.lineTo(x + rectWidth + arrowWidth, y + rectHeight);
            ctx.lineTo(x + arrowWidth, y + rectHeight);
            ctx.closePath();
        }
        else if (edge.orient === "left") {
            ctx.moveTo(x, y);
            ctx.lineTo(x + rectWidth, y);
            ctx.lineTo(x + rectWidth + arrowWidth, y + rectHeight / 2);
            ctx.lineTo(x + rectWidth, y + rectHeight);
            ctx.lineTo(x, y + rectHeight);
            ctx.closePath();
        }
        else {
            ctx.rect(x, y, rectWidth, rectHeight);
        }
        ctx.fill();
        ctx.font = `${edgeCoordinate.fontSize}px ${edgeCoordinate.fontFamily}`;
        ctx.fillStyle = edgeCoordinate.textFill;
        ctx.textAlign = edgeCoordinate.textAnchor === "middle" ? "center" : edgeCoordinate.textAnchor;
        ctx.textBaseline = "middle";
        ctx.fillText(edgeCoordinate.displayCoordinate, edgeCoordinate.edgeXText, edgeCoordinate.edgeYText);
    }
    if (isDefined(edge.line)) {
        const edgeLine = edge.line;
        ctx.strokeStyle = hexToRGBA(edgeLine.stroke, edgeLine.opacity);
        ctx.beginPath();
        ctx.moveTo(edgeLine.x1, edgeLine.y1);
        ctx.lineTo(edgeLine.x2, edgeLine.y2);
        ctx.stroke();
    }
}
