import { jsx as _jsx } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
import GenericChartComponent from "../GenericChartComponent.js";
class Annotate extends Component {
    static defaultProps;
    constructor(props) {
        super(props);
        this.renderSVG = this.renderSVG.bind(this);
    }
    render() {
        return _jsx(GenericChartComponent, { svgDraw: this.renderSVG, drawOn: ["pan"] });
    }
    renderSVG(moreProps) {
        const { xAccessor } = moreProps;
        const { xScale, chartConfig: { yScale }, plotData } = moreProps;
        const { className, usingProps, with: Annotation } = this.props;
        const data = helper(this.props, plotData);
        return (_jsx("g", { className: `vninvestcharts-enable-interaction ${className}`, children: data.map((d, idx) => _jsx(Annotation, { ...usingProps, xScale: xScale, yScale: yScale, xAccessor: xAccessor, plotData: plotData, datum: d }, idx)) }));
    }
}
// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
Annotate.propTypes = {
    className: PropTypes.string,
    with: PropTypes.func,
    when: PropTypes.func,
    usingProps: PropTypes.object,
};
Annotate.defaultProps = {
    className: "vninvestcharts-annotate vninvestcharts-default-cursor",
};
function helper({ when }, plotData) {
    return plotData.filter(when);
}
export default Annotate;
