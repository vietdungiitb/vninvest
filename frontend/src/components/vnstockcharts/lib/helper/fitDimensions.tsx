
import React, { Component } from "react";

import { isDefined } from "../utils";

function getDisplayName(Series: any) {
	const name = Series.displayName || Series.name || "Series";
	return name;
}

export default function fitDimensions(WrappedComponent: any, props: any = {}) {

	const {
		minWidth = 100,
		minHeight = 100,
		ratio,
		width,
		height,
	} = props;

	function getDimensions(el: any) {
		const w = el.parentNode.clientWidth;
		const h = el.parentNode.clientHeight;

		return {
			width: isDefined(width) ? width : Math.max(w, minWidth),
			height: isDefined(height) ? height : Math.max(h, minHeight),
		};
	}
	class ResponsiveComponent extends Component<any, any> {
		node: any;
		wrappedNode: any;
		testCanvas: any;

		constructor(props: any) {
			super(props);
			this.handleWindowResize = this.handleWindowResize.bind(this);
			this.getWrappedInstance = this.getWrappedInstance.bind(this);
			this.saveNode = this.saveNode.bind(this);
			this.saveWrappedNode = this.saveWrappedNode.bind(this);
			this.setTestCanvas = this.setTestCanvas.bind(this);
			this.state = {};
		}
		saveNode(node: any) {
			this.node = node;
		}
		saveWrappedNode(node: any) {
			this.wrappedNode = node;
		}
		setTestCanvas(node: any) {
			this.testCanvas = node;
		}
		getRatio() {
			if (isDefined(this.testCanvas)) {
				const context = this.testCanvas.getContext("2d") as any;

				const devicePixelRatio = window.devicePixelRatio || 1;
				const backingStoreRatio = context.webkitBackingStorePixelRatio ||
								context.mozBackingStorePixelRatio ||
								context.msBackingStorePixelRatio ||
								context.oBackingStorePixelRatio ||
								context.backingStorePixelRatio || 1;

				const ratio = devicePixelRatio / backingStoreRatio;
				return ratio;
			}
			return 1;
		}
		componentDidMount() {
			window.addEventListener("resize", this.handleWindowResize);
			const dimensions = getDimensions(this.node);

			/* eslint-disable react/no-did-mount-set-state */
			this.setState({
				...dimensions,
				ratio: isDefined(ratio) ? ratio : this.getRatio(),
			});
			/* eslint-enable react/no-did-mount-set-state */
		}
		componentWillUnmount() {
			window.removeEventListener("resize", this.handleWindowResize);
		}
		handleWindowResize() {
			const node = this.node;
			if (!node || !node.parentNode) return;
			this.setState(getDimensions(node));
		}
		getWrappedInstance() {
			return this.wrappedNode;
		}
		render() {
			const ref = { ref: this.saveNode };

			if (this.state.width) {
				return <div {...ref}>
					<WrappedComponent
						ref={this.saveWrappedNode}
						height={this.state.height}
						width={this.state.width}
						ratio={this.state.ratio}
						{...this.props}
					/>
				</div>;
			} else {
				return <div {...ref}>
					<canvas ref={this.setTestCanvas}  />
				</div>;
			}
		}
	}

	(ResponsiveComponent as any).displayName = `fitDimensions(${ getDisplayName(WrappedComponent) })`;

	return ResponsiveComponent;
}
