export { default as Annotate } from "./Annotate";
export { default as LabelAnnotation } from "./LabelAnnotation";
export { default as SvgPathAnnotation } from "./SvgPathAnnotation";
export { default as Label } from "./Label";
export { default as BarAnnotation, getArrowForTextIcon } from "./BarAnnotation";

const halfWidth = 10;
const bottomWidth = 3;
const height = 20;

export function buyPath({ x, y }: any) {
	return `M${x} ${y} `
		+ `L${x + halfWidth} ${y + halfWidth} `
		+ `L${x + bottomWidth} ${y + halfWidth} `
		+ `L${x + bottomWidth} ${y + height} `
		+ `L${x - bottomWidth} ${y + height} `
		+ `L${x - bottomWidth} ${y + halfWidth} `
		+ `L${x - halfWidth} ${y + halfWidth} `
		+ "Z";
}

export function sellPath({ x, y }: any) {
	return `M${x} ${y} `
		+ `L${x + halfWidth} ${y - halfWidth} `
		+ `L${x + bottomWidth} ${y - halfWidth} `
		+ `L${x + bottomWidth} ${y - height} `
		+ `L${x - bottomWidth} ${y - height} `
		+ `L${x - bottomWidth} ${y - halfWidth} `
		+ `L${x - halfWidth} ${y - halfWidth} `
		+ "Z";
}
