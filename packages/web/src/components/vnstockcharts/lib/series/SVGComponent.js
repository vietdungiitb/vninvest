import { jsx as _jsx } from "react/jsx-runtime";
import React, { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
class SVGComponent extends Component {
    render() {
        const { children } = this.props;
        return _jsx(GenericChartComponent, { drawOn: [], svgDraw: children });
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SVGComponent.propTypes = {
    children: PropTypes.func.isRequired,
};
export default SVGComponent;
