import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import PropTypes from "prop-types";
class TypeChooser extends Component {
    // NOTE: React 19 no longer runs propTypes validation at runtime.
    // PropTypes kept for documentation and IDE tooling only.
    static propTypes = {
        type: PropTypes.oneOf(["svg", "hybrid"]),
        children: PropTypes.func.isRequired,
        style: PropTypes.object.isRequired,
    };
    static defaultProps = {
        type: "hybrid",
        style: {},
    };
    constructor(props) {
        super(props);
        this.state = {
            type: this.props.type || "hybrid"
        };
        this.handleTypeChange = this.handleTypeChange.bind(this);
    }
    handleTypeChange(e) {
        this.setState({
            type: e.target.value
        });
    }
    render() {
        return (_jsxs("div", { children: [_jsx("label", { children: "Type: " }), _jsxs("select", { name: "type", id: "type", onChange: this.handleTypeChange, value: this.state.type, children: [_jsx("option", { value: "svg", children: "svg" }), _jsx("option", { value: "hybrid", children: "canvas + svg" })] }), _jsx("div", { style: this.props.style, children: this.props.children(this.state.type) })] }));
    }
}
export default TypeChooser;
