import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import { isDefined, noop } from "../utils/index.js";
import { getValueFromOverride, terminate, saveNodeType, isHoverForInteractiveType, } from "./utils.js";
import EachText from "./wrapper/EachText.js";
import HoverTextNearMouse from "./components/HoverTextNearMouse.js";
import GenericChartComponent from "../GenericChartComponent.js";
import { getMouseCanvas } from "../GenericComponent.js";
class InteractiveText extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.handleDraw = this.handleDraw.bind(this);
        this.handleDrag = this.handleDrag.bind(this);
        this.handleDragComplete = this.handleDragComplete.bind(this);
        this.terminate = terminate.bind(this);
        this.saveNodeType = saveNodeType.bind(this);
        this.getSelectionState = isHoverForInteractiveType("textList")
            .bind(this);
        this.nodes = [];
        this.state = {};
    }
    handleDrag(index, position) {
        this.setState({
            override: {
                index,
                position,
            }
        });
    }
    handleDragComplete(moreProps) {
        const { override } = this.state;
        if (isDefined(override)) {
            const { textList } = this.props;
            const newTextList = textList
                .map((each, idx) => {
                const selected = (idx === override.index);
                return selected
                    ? {
                        ...each,
                        position: override.position,
                        selected,
                    }
                    : {
                        ...each,
                        selected
                    };
            });
            this.setState({
                override: null,
            }, () => {
                this.props.onDragComplete(newTextList, moreProps);
            });
        }
    }
    handleDrawLine(xyValue) {
        const { current } = this.state;
        if (isDefined(current) && isDefined(current.start)) {
            this.setState({
                current: {
                    start: current.start,
                    end: xyValue,
                }
            });
        }
    }
    handleDraw(moreProps, e) {
        const { enabled } = this.props;
        if (enabled) {
            const { mouseXY: [, mouseY], chartConfig: { yScale }, xAccessor, currentItem, } = moreProps;
            const xyValue = [xAccessor(currentItem), yScale.invert(mouseY)];
            const { defaultText, onChoosePosition } = this.props;
            const newText = {
                ...defaultText,
                position: xyValue,
            };
            onChoosePosition(newText, moreProps, e);
        }
    }
    render() {
        const { textList, defaultText, hoverText } = this.props;
        const { override } = this.state;
        return _jsxs("g", { children: [textList.map((each, idx) => {
                    const defaultHoverText = InteractiveText.defaultProps.hoverText;
                    const props = {
                        ...defaultText,
                        ...each,
                        hoverText: {
                            ...defaultHoverText,
                            ...hoverText,
                            ...(each.hoverText || {})
                        },
                    };
                    return _jsx(EachText, { ref: this.saveNodeType(idx), index: idx, ...props, selected: each.selected, position: getValueFromOverride(override, idx, "position", each.position), onDrag: this.handleDrag, onDragComplete: this.handleDragComplete, edgeInteractiveCursor: "vninvestcharts-move-cursor" }, idx);
                }), _jsx(GenericChartComponent, { onClick: this.handleDraw, svgDraw: () => null, canvasDraw: noop, canvasToDraw: getMouseCanvas, drawOn: ["mousemove", "pan"] })] });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
InteractiveText.propTypes = {
    onChoosePosition: PropTypes.func.isRequired,
    onDragComplete: PropTypes.func.isRequired,
    onSelect: PropTypes.func,
    defaultText: PropTypes.shape({
        bgFill: PropTypes.string.isRequired,
        bgOpacity: PropTypes.number.isRequired,
        bgStrokeWidth: PropTypes.number,
        bgStroke: PropTypes.string,
        textFill: PropTypes.string.isRequired,
        fontFamily: PropTypes.string.isRequired,
        fontWeight: PropTypes.string.isRequired,
        fontStyle: PropTypes.string.isRequired,
        fontSize: PropTypes.number.isRequired,
        text: PropTypes.string.isRequired,
    }).isRequired,
    hoverText: PropTypes.object.isRequired,
    textList: PropTypes.array.isRequired,
    enabled: PropTypes.bool.isRequired,
};
InteractiveText.defaultProps = {
    onChoosePosition: noop,
    onDragComplete: noop,
    onSelect: noop,
    defaultText: {
        bgFill: "#D3D3D3",
        bgOpacity: 1,
        bgStrokeWidth: 1,
        textFill: "#F10040",
        fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
        fontSize: 12,
        fontStyle: "normal",
        fontWeight: "normal",
        text: "Lorem ipsum..."
    },
    hoverText: {
        ...HoverTextNearMouse.defaultProps,
        enable: true,
        bgHeight: "auto",
        bgWidth: "auto",
        text: "Click to select object",
        selectedText: "",
    },
    textList: [],
};
export default InteractiveText;
