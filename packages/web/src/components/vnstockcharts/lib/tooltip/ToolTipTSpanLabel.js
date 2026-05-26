import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import PropTypes from "prop-types";
function ToolTipTSpanLabel(props) {
    return _jsx("tspan", { className: "react-stockcharts-tooltip-label", ...props, children: props.children });
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ToolTipTSpanLabel.propTypes = {
    children: PropTypes.node.isRequired,
    fill: PropTypes.string.isRequired,
};
ToolTipTSpanLabel.defaultProps = {
    fill: "#4682B4"
};
export default ToolTipTSpanLabel;
