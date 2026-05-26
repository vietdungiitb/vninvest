
import React, { Component } from "react";
import PropTypes from "prop-types";

interface TypeChooserProps {
	type?: "svg" | "hybrid";
	children: (type: string) => React.ReactNode;
	style?: React.CSSProperties;
}

interface TypeChooserState {
	type: string;
}

class TypeChooser extends Component<TypeChooserProps, TypeChooserState> {
	// NOTE: React 19 no longer runs propTypes validation at runtime.
	// PropTypes kept for documentation and IDE tooling only.
	static propTypes = {
		type: PropTypes.oneOf(["svg", "hybrid"] as const),
		children: PropTypes.func.isRequired,
		style: PropTypes.object.isRequired,
	};

	static defaultProps = {
		type: "hybrid" as const,
		style: {},
	};

	constructor(props: TypeChooserProps) {
		super(props);
		this.state = {
			type: this.props.type || "hybrid"
		};
		this.handleTypeChange = this.handleTypeChange.bind(this);
	}
	handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
		this.setState({
			type: e.target.value
		});
	}
	render() {
		return (
			<div>
				<label>Type: </label>
				<select name="type" id="type" onChange={this.handleTypeChange} value={this.state.type} >
					<option value="svg">svg</option>
					<option value="hybrid">canvas + svg</option>
				</select>
				<div style={this.props.style}>
					{this.props.children(this.state.type)}
				</div>
			</div>
		);
	}
}

export default TypeChooser;
