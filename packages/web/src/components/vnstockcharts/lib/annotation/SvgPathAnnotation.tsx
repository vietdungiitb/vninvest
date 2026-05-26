
import React, { Component } from "react";
import PropTypes from "prop-types";
import { functor } from "../utils";

class SvgPathAnnotation extends Component<any, any> {
	static defaultProps: any;

	constructor(props: any) {
		super(props);
		this.handleClick = this.handleClick.bind(this);
	}
	handleClick(e: any) {
		const { onClick } = this.props;

		if (onClick) {
			const { xScale, yScale, datum } = this.props;
			onClick({ xScale, yScale, datum }, e);
		}
	}
	render() {
		const { className, stroke, opacity } = this.props;
		const { xAccessor, xScale, yScale, path } = this.props;

		const { x, y, fill, tooltip } = helper(this.props, xAccessor, xScale, yScale);

		return (<g className={className} onClick={this.handleClick}>
			<title>{tooltip}</title>
			<path d={path({ x, y })} stroke={stroke} fill={fill} opacity={opacity} />
		</g>);
	}
}

function helper(props: any, xAccessor: any, xScale: any, yScale: any) {
	const { x, y, datum, fill, tooltip, plotData } = props;

	const xFunc = functor(x);
	const yFunc = functor(y);

	const [xPos, yPos] = [xFunc({ xScale, xAccessor, datum, plotData }), yFunc({ yScale, datum, plotData })];

	return {
		x: xPos,
		y: yPos,
		fill: functor(fill)(datum),
		tooltip: functor(tooltip)(datum),
	};
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SvgPathAnnotation.propTypes = {
	className: PropTypes.string,
	path: PropTypes.func.isRequired,
	onClick: PropTypes.func,
	xAccessor: PropTypes.func,
	xScale: PropTypes.func,
	yScale: PropTypes.func,
	datum: PropTypes.object,
	stroke: PropTypes.string,
	fill: PropTypes.string,
	opacity: PropTypes.number,
};

SvgPathAnnotation.defaultProps = {
	className: "react-stockcharts-svgpathannotation",
	opacity: 1,
	x: ({ xScale, xAccessor, datum }: any) => xScale(xAccessor(datum)),
};

export default SvgPathAnnotation;
