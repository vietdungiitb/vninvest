import { jsx as _jsx } from "react/jsx-runtime";
import React, { Component } from "react";
import { isDefined } from "../utils/index.js";
function getDisplayName(Series) {
    const name = Series.displayName || Series.name || "Series";
    return name;
}
export default function fitWidth(WrappedComponent, withRef = true, minWidth = 100) {
    class ResponsiveComponent extends Component {
        node;
        testCanvas;
        constructor(props) {
            super(props);
            this.handleWindowResize = this.handleWindowResize.bind(this);
            this.getWrappedInstance = this.getWrappedInstance.bind(this);
            this.saveNode = this.saveNode.bind(this);
            this.setTestCanvas = this.setTestCanvas.bind(this);
            this.state = {};
        }
        saveNode(node) {
            this.node = node;
        }
        setTestCanvas(node) {
            this.testCanvas = node;
        }
        getRatio() {
            if (isDefined(this.testCanvas)) {
                const context = this.testCanvas.getContext("2d");
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
                return _jsx(WrappedComponent, { width: this.state.width, ratio: this.state.ratio, ...this.props, ...ref });
            }
            else {
                return _jsx("div", { ...ref, children: _jsx("canvas", { ref: this.setTestCanvas }) });
            }
        }
    }
    ResponsiveComponent.displayName = `fitWidth(${getDisplayName(WrappedComponent)})`;
    return ResponsiveComponent;
}
