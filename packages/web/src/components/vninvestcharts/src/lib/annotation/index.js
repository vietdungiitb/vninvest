export { default as Annotate } from "./Annotate.js";
export { default as LabelAnnotation } from "./LabelAnnotation.js";
export { default as SvgPathAnnotation } from "./SvgPathAnnotation.js";
export { default as Label } from "./Label.js";
export { default as BarAnnotation, getArrowForTextIcon } from "./BarAnnotation.js";
const halfWidth = 10;
const bottomWidth = 3;
const height = 20;
export function buyPath({ x, y }) {
    return `M${x} ${y} `
        + `L${x + halfWidth} ${y + halfWidth} `
        + `L${x + bottomWidth} ${y + halfWidth} `
        + `L${x + bottomWidth} ${y + height} `
        + `L${x - bottomWidth} ${y + height} `
        + `L${x - bottomWidth} ${y + halfWidth} `
        + `L${x - halfWidth} ${y + halfWidth} `
        + "Z";
}
export function sellPath({ x, y }) {
    return `M${x} ${y} `
        + `L${x + halfWidth} ${y - halfWidth} `
        + `L${x + bottomWidth} ${y - halfWidth} `
        + `L${x + bottomWidth} ${y - height} `
        + `L${x - bottomWidth} ${y - height} `
        + `L${x - bottomWidth} ${y - halfWidth} `
        + `L${x - halfWidth} ${y - halfWidth} `
        + "Z";
}
