import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
class ToolTipText extends Component {
    static defaultProps;
    render() {
        return _jsx("text", { fontFamily: this.props.fontFamily, fontSize: this.props.fontSize, ...this.props, className: "vninvestcharts-tooltip", children: this.props.children });
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
