
import React, { Component } from "react";
import PropTypes from "prop-types";

class ToolTipText extends Component<any, any> {
	static defaultProps: any;

	render() {
		return <text
			fontFamily={this.props.fontFamily}
			fontSize={this.props.fontSize}
			{...this.props}
			className="react-stockcharts-tooltip">{this.props.children}</text>;
	}
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
ToolTipText.propTypes = {
	fontFamily: PropTypes.string.isRequired,
	fontSize: PropTypes.number.isRequired,
	children: PropTypes.node.isRequired,
};

ToolTipText.defaultProps = {
	fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
	fontSize: 11,
};

export default ToolTipText;
