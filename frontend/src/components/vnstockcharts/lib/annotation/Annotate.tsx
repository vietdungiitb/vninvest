
import React, { Component } from "react";
import PropTypes from "prop-types";

import GenericChartComponent from "../GenericChartComponent";

class Annotate extends Component<any, any> {
	static defaultProps: any;

	constructor(props: any) {
		super(props);
		this.renderSVG = this.renderSVG.bind(this);
	}
	render() {
		return <GenericChartComponent
			svgDraw={this.renderSVG}
			drawOn={["pan"]}
		/>;
	}
	renderSVG(moreProps: any) {
		const { xAccessor } = moreProps;
		const { xScale, chartConfig: { yScale }, plotData } = moreProps;

		const { className, usingProps, with: Annotation } = this.props;
		const data = helper(this.props, plotData);

		return (
			<g className={`react-stockcharts-enable-interaction ${className}`}>
				{data.map((d: any, idx: number) => <Annotation key={idx}
					{...usingProps}
					xScale={xScale}
					yScale={yScale}
					xAccessor={xAccessor}
					plotData={plotData}
					datum={d} />)}
			</g>
		);
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
	className: "react-stockcharts-annotate react-stockcharts-default-cursor",
};

function helper({ when }: any, plotData: any[]) {
	return plotData.filter(when);
}

export default Annotate;
