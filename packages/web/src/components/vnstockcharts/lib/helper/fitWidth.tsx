
import React, { Component } from "react";

import { isDefined } from "../utils";

function getDisplayName(Series: any) {
	const name = Series.displayName || Series.name || "Series";
	return name;
}

export default function fitWidth(WrappedComponent: any, withRef = true, minWidth = 100) {
	class ResponsiveComponent extends Component<any, any> {
		node: any;
		testCanvas: any;

		constructor(props: any) {
			super(props);
			this.handleWindowResize = this.handleWindowResize.bind(this);
			this.getWrappedInstance = this.getWrappedInstance.bind(this);
			this.saveNode = this.saveNode.bind(this);
			this.setTestCanvas = this.setTestCanvas.bind(this);
			this.state = {};
		}
		saveNode(node: any) {
			this.node = node;
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
			this.handleWindowResize();
			/* eslint-disable react/no-did-mount-set-state */
			this.setState({
				ratio: this.getRatio(),
			});
			/* eslint-enable react/no-did-mount-set-state */
		}
		componentWillUnmount() {
			window.removeEventListener("resize", this.handleWindowResize);
		}
		handleWindowResize() {
			this.setState({
				width: 0
			}, () => {
				const el = this.node;
				const { width, paddingLeft, paddingRight } = window.getComputedStyle(el.parentNode);

				const w = parseFloat(width) - (parseFloat(paddingLeft) + parseFloat(paddingRight));

				this.setState({
					width: Math.round(Math.max(w, minWidth))
				});
			});
		}
		getWrappedInstance() {
			return this.node;
		}
		render() {
			const ref = withRef ? { ref: this.saveNode } : {};

			if (this.state.width) {
				return <WrappedComponent width={this.state.width} ratio={this.state.ratio} {...this.props} {...ref} />;
			} else {
				return <div {...ref}>
					<canvas ref={this.setTestCanvas}  />
				</div>;
			}
		}
	}

	(ResponsiveComponent as any).displayName = `fitWidth(${ getDisplayName(WrappedComponent) })`;

	return ResponsiveComponent;
}
