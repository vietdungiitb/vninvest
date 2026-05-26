import { overlayColors } from "../utils/index.js";
let i = 0;
export default function baseIndicator() {
    let id = i++;
    let accessor;
    let stroke;
    let fill;
    let echo;
    let type;
    function baseIndicator() {
    }
    baseIndicator.id = function (x) {
        if (!arguments.length)
            return id;
        id = x;
        return baseIndicator;
    };
    baseIndicator.accessor = function (x) {
        if (!arguments.length)
            return accessor;
        accessor = x;
        return baseIndicator;
    };
    baseIndicator.stroke = function (x) {
        if (!arguments.length)
            return !stroke ? stroke = overlayColors(String(id)) : stroke;
        stroke = x;
        return baseIndicator;
    };
    baseIndicator.fill = function (x) {
        if (!arguments.length)
            return !fill ? fill = overlayColors(String(id)) : fill;
        fill = x;
        return baseIndicator;
    };
    baseIndicator.echo = function (x) {
        if (!arguments.length)
            return echo;
        echo = x;
        return baseIndicator;
    };
    baseIndicator.type = function (x) {
        if (!arguments.length)
            return type;
        type = x;
        return baseIndicator;
    };
    return baseIndicator;
}
