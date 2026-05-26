import { Component } from "react";
import PropTypes from "prop-types";

import { format } from "d3-format";
import { isDefined, noop, strokeDashTypes } from "../utils";

import {
	getValueFromOverride,
	terminate,
	saveNodeType,
	isHoverForInteractiveType,
} from "./utils";
import EachInteractiveYCoordinate from "./wrapper/EachInteractiveYCoordinate";
import HoverTextNearMouse from "./components/HoverTextNearMouse";

class InteractiveYCoordinate extends Component<any, any> {
	[key: string]: any;
	static defaultProps: any;
	constructor(props: any) {
		super(props);

		this.handleDrag = this.handleDrag.bind(this);
		this.handleDragComplete = this.handleDragComplete.bind(this);
		this.handleDelete = this.handleDelete.bind(this);
		this.terminate = terminate.bind(this);

		this.saveNodeType = saveNodeType.bind(this);
		this.getSelectionState = isHoverForInteractiveType("yCoordinateList")
			.bind(this);

		this.nodes = [];
		this.state = {};
	}
	handleDrag(index: number, yValue: any) {
		this.setState({
			override: {
				index,
				yValue,
			}
		});
	}
	handleDragComplete(moreProps: any) {
		const { override } = this.state;
		if (isDefined(override)) {
			const { yCoordinateList } = this.props;
			const newAlertList = yCoordinateList
				.map((each: any, idx: number) => {
					const selected = (idx === override.index);
					return selected
						? {
							...each,
							yValue: override.yValue,
							selected,
						}
						: {
							...each,
							selected
						};
				});
			const draggedAlert = newAlertList[override.index];
			this.setState({
				override: null,
			}, () => {
				this.props.onDragComplete(newAlertList, moreProps, draggedAlert);
			});
		}
	}
	handleDrawLine(xyValue: any) {
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
	handleDelete(index: number, moreProps: any) {
		const { onDelete, yCoordinateList } = this.props;
		onDelete(yCoordinateList[index], moreProps);
	}
	render() {
		const { yCoordinateList } = this.props;
		const { override } = this.state;
		return (
			<g>
				{yCoordinateList.map((each: any, idx: number) => {
					const props = each;
					return (
						<EachInteractiveYCoordinate key={each.id}
							ref={this.saveNodeType(idx)}
							index={idx}
							{...props}
							selected={each.selected}
							yValue={getValueFromOverride(override, idx, "yValue", each.yValue)}

							onDelete={this.handleDelete}
							onDrag={this.handleDrag}
							onDragComplete={this.handleDragComplete}
							edgeInteractiveCursor="react-stockcharts-move-cursor"
						/>
					);
				})}
			</g>
		);
	}
}

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
InteractiveYCoordinate.propTypes = {
	onChoosePosition: PropTypes.func.isRequired,
	onDragComplete: PropTypes.func.isRequired,
	onSelect: PropTypes.func,
	onDelete: PropTypes.func,

	defaultPriceCoordinate: PropTypes.shape({
		bgFill: PropTypes.string.isRequired,
		bgOpacity: PropTypes.number.isRequired,

		stroke: PropTypes.string.isRequired,
		strokeDasharray: PropTypes.oneOf(strokeDashTypes).isRequired,
		strokeOpacity: PropTypes.number.isRequired,
		strokeWidth: PropTypes.number.isRequired,

		textFill: PropTypes.string.isRequired,
		fontFamily: PropTypes.string.isRequired,
		fontWeight: PropTypes.string.isRequired,
		fontStyle: PropTypes.string.isRequired,
		fontSize: PropTypes.number.isRequired,
		text: PropTypes.string.isRequired,

		textBox: PropTypes.shape({
			height: PropTypes.number.isRequired,
			left: PropTypes.number.isRequired,
			padding: PropTypes.shape({
				left: PropTypes.number.isRequired,
				right: PropTypes.number.isRequired,
			}),
			closeIcon: PropTypes.shape({
				padding: PropTypes.shape({
					left: PropTypes.number.isRequired,
					right: PropTypes.number.isRequired,
				}),
				width: PropTypes.number.isRequired,
			})
		}).isRequired,
		edge: PropTypes.shape({
			stroke: PropTypes.string.isRequired,
			strokeOpacity: PropTypes.number.isRequired,
			strokeWidth: PropTypes.number.isRequired,

			fill: PropTypes.string.isRequired,
			fillOpacity: PropTypes.number.isRequired,
		})
	}).isRequired,

	hoverText: PropTypes.object.isRequired,
	yCoordinateList: PropTypes.array.isRequired,
	enabled: PropTypes.bool.isRequired,
};

InteractiveYCoordinate.defaultProps = {
	onChoosePosition: noop,
	onDragComplete: noop,
	onSelect: noop,
	onDelete: noop,

	defaultPriceCoordinate: {
		bgFill: "#FFFFFF",
		bgOpacity: 1,

		stroke: "#6574CD",
		strokeOpacity: 1,
		strokeDasharray: "ShortDash2",
		strokeWidth: 1,

		textFill: "#6574CD",
		fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
		fontSize: 12,
		fontStyle: "normal",
		fontWeight: "normal",
		text: "Alert",
		textBox: {
			height: 24,
			left: 20,
			padding: { left: 10, right: 5 },
			closeIcon: {
				padding: { left: 5, right: 8 },
				width: 8,
			}
		},
		edge: {
			stroke: "#6574CD",
			strokeOpacity: 1,
			strokeWidth: 1,

			fill: "#FFFFFF",
			fillOpacity: 1,
			orient: "right",
			at: "right",
			arrowWidth: 10,
			dx: 0,
			rectWidth: 50,
			rectHeight: 20,
			displayFormat: format(".2f"),
		}
	},
	hoverText: {
		...HoverTextNearMouse.defaultProps,
		enable: true,
		bgHeight: 18,
		bgWidth: 175,
		text: "Click and drag the edge circles",
	},
	yCoordinateList: [],
};

export default InteractiveYCoordinate;