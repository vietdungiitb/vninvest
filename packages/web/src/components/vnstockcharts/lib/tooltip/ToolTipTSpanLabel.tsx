
import React from "react";
import PropTypes from "prop-types";

function ToolTipTSpanLabel(props: any) {
	return <tspan className="react-stockcharts-tooltip-label" {...props}>{props.children}</tspan>;
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
