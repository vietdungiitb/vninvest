import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";
import { bisector } from "d3-array";
import noop from "./noop.js";
import identity from "./identity.js";
export { default as rebind } from "./rebind.js";
export { default as zipper } from "./zipper.js";
export { default as merge } from "./merge.js";
export { default as slidingWindow } from "./slidingWindow.js";
export { default as identity } from "./identity.js";
export { default as noop } from "./noop.js";
export { default as shallowEqual } from "./shallowEqual.js";
export { default as mappedSlidingWindow } from "./mappedSlidingWindow.js";
export { default as accumulatingWindow } from "./accumulatingWindow.js";
export { default as PureComponent } from "./PureComponent.js";
export * from "./barWidth.js";
export * from "./strokeDasharray.js";
export * from "./timezoneFormatter.js";
const isProduction = globalThis.process?.env?.NODE_ENV === "production";
export function getLogger(prefix) {
    let logger = noop;
    if (!isProduction) {
        logger = (...args) => console.log(`[vninvestcharts:${prefix}]`, ...args);
    }
    return logger;
}
export function sign(x) {
    return (x > 0 ? 1 : 0) - (x < 0 ? 1 : 0);
}
export const yes = () => true;
export function path(loc = []) {
    const key = Array.isArray(loc) ? loc : [loc];
    const length = key.length;
    return function (obj, defaultValue) {
        if (length === 0)
            return isDefined(obj) ? obj : defaultValue;
        let index = 0;
        while (obj != null && index < length) {
            obj = obj[key[index++]];
        }
        return (index === length) ? obj : defaultValue;
    };
}
export function functor(v) {
    return typeof v === "function" ? v : () => v;
}
export function createVerticalLinearGradient(stops) {
    return function (moreProps, ctx) {
        const { chartConfig: { height } } = moreProps;
        const grd = ctx.createLinearGradient(0, height, 0, 0);
        stops.forEach(each => {
            grd.addColorStop(each.stop, each.color);
        });
        return grd;
    };
}
export function getClosestItemIndexes2(array, value, accessor) {
    let left = bisector(accessor).left(array, value);
    left = Math.max(left - 1, 0);
    let right = Math.min(left + 1, array.length - 1);
    const item = accessor(array[left]);
    if (item >= value && item <= value)
        right = left;
    return { left, right };
}
export function degrees(radians) {
    return radians * 180 / Math.PI;
}
export function radians(degreesValue) {
    return degreesValue * Math.PI / 180;
}
export function getClosestValue(inputValue, currentValue) {
    const values = isArray(inputValue) ? inputValue : [inputValue];
    const diff = values
        .map(each => each - currentValue)
        .reduce((diff1, diff2) => Math.abs(diff1) < Math.abs(diff2) ? diff1 : diff2);
    return currentValue + diff;
}
export function find(list, predicate, context = this) {
    for (let i = 0; i < list.length; ++i) {
        if (predicate.call(context, list[i], i, list)) {
            return list[i];
        }
    }
    return undefined;
}
export function d3Window(node) {
    const d3win = node
        && (node.ownerDocument && node.ownerDocument.defaultView
            || node.document && node
            || node.defaultView);
    return d3win;
}
export const MOUSEENTER = "mouseenter.interaction";
export const MOUSELEAVE = "mouseleave.interaction";
export const MOUSEMOVE = "mousemove.pan";
export const MOUSEUP = "mouseup.pan";
export const TOUCHMOVE = "touchmove.pan";
export const TOUCHEND = "touchend.pan touchcancel.pan";
export function getTouchProps(touch) {
    if (!touch)
        return {};
    return {
        pageX: touch.pageX,
        pageY: touch.pageY,
        clientX: touch.clientX,
        clientY: touch.clientY
    };
}
export function getClosestItemIndexes(array, value, accessor, log) {
    let lo = 0, hi = array.length - 1;
    while (hi - lo > 1) {
        const mid = Math.round((lo + hi) / 2);
        if (accessor(array[mid]) <= value) {
            lo = mid;
        }
        else {
            hi = mid;
        }
    }
    if (accessor(array[lo]).valueOf() === value.valueOf())
        hi = lo;
    if (accessor(array[hi]).valueOf() === value.valueOf())
        lo = hi;
    if (accessor(array[lo]) < value && accessor(array[hi]) < value)
        lo = hi;
    if (accessor(array[lo]) > value && accessor(array[hi]) > value)
        hi = lo;
    if (log) {
        // console.log(lo, accessor(array[lo]), value, accessor(array[hi]), hi);
        // console.log(accessor(array[lo]), lo, value, accessor(array[lo]) >= value);
        // console.log(value, hi, accessor(array[hi]), accessor(array[lo]) <= value);
    }
    return { left: lo, right: hi };
}
export function getClosestItem(array, value, accessor, log) {
    const { left, right } = getClosestItemIndexes(array, value, accessor, log);
    if (left === right) {
        return array[left];
    }
    const closest = (Math.abs(accessor(array[left]) - value) < Math.abs(accessor(array[right]) - value))
        ? array[left]
        : array[right];
    if (log) {
    }
    return closest;
}
export const overlayColors = scaleOrdinal(schemeCategory10);
export function head(array, accessor) {
    if (accessor && array) {
        let value;
        for (let i = 0; i < array.length; i++) {
            value = array[i];
            if (isDefined(accessor(value)))
                return value;
        }
        return undefined;
    }
    return array ? array[0] : undefined;
}
export function tail(array, accessor) {
    if (accessor && array) {
        return array.map(accessor).slice(1);
    }
    return array ? array.slice(1) : undefined;
}
export const first = head;
export function last(array, accessor) {
    if (accessor && array) {
        let value;
        for (let i = array.length - 1; i >= 0; i--) {
            value = array[i];
            if (isDefined(accessor(value)))
                return value;
        }
        return undefined;
    }
    const length = array ? array.length : 0;
    return length ? array[length - 1] : undefined;
}
export function isDefined(d) {
    return d !== null && typeof d != "undefined";
}
export function isNotDefined(d) {
    return !isDefined(d);
}
export function isObject(d) {
    return isDefined(d) && typeof d === "object" && !Array.isArray(d);
}
export const isArray = Array.isArray;
export function touchPosition(touch, e) {
    const container = e.target, rect = container.getBoundingClientRect(), x = touch.clientX - rect.left - container.clientLeft, y = touch.clientY - rect.top - container.clientTop, xy = [Math.round(x), Math.round(y)];
    return xy;
}
export function mousePosition(e, defaultRect) {
    const container = e.currentTarget;
    const rect = defaultRect || container.getBoundingClientRect(), x = e.clientX - rect.left - container.clientLeft, y = e.clientY - rect.top - container.clientTop, xy = [Math.round(x), Math.round(y)];
    return xy;
}
export function clearCanvas(canvasList, ratio) {
    canvasList.forEach((each) => {
        each.setTransform(1, 0, 0, 1, 0, 0);
        each.clearRect(-1, -1, each.canvas.width + 2, each.canvas.height + 2);
        each.scale(ratio, ratio);
    });
}
export function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
}
export function hexToRGBA(inputHex, opacity) {
    if (!inputHex) {
        return "transparent";
    }
    const rgbaMatch = inputHex.match(/^rgba?\(([^)]+)\)$/i);
    if (rgbaMatch) {
        const parts = rgbaMatch[1].split(",").map((part) => part.trim());
        if (parts.length >= 3) {
            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${opacity})`;
        }
    }
    let hex = inputHex.replace("#", "");
    if (inputHex.indexOf("#") > -1 && (hex.length === 3 || hex.length === 6 || hex.length === 8)) {
        if (hex.length === 3) {
            hex = hex.split("").map((char) => `${char}${char}`).join("");
        }
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    return inputHex;
}
export function toObject(array, iteratee = identity) {
    return array.reduce((returnObj, a) => {
        const [key, value] = iteratee(a);
        return {
            ...returnObj,
            [key]: value
        };
    }, {});
}
// copied from https://github.com/lodash/lodash/blob/master/mapValue.js
export function mapValue(object, iteratee) {
    object = Object(object);
    // eslint-disable-next-line prefer-const
    let result = {};
    Object.keys(object).forEach(key => {
        const mappedValue = iteratee(object[key], key, object);
        if (isDefined(mappedValue)) {
            result[key] = mappedValue;
        }
    });
    return result;
}
// copied from https://github.com/lodash/lodash/blob/master/mapObject.js
export function mapObject(object = {}, iteratee = identity) {
    const props = Object.keys(object);
    // eslint-disable-next-line prefer-const
    let result = new Array(props.length);
    props.forEach((key, index) => {
        result[index] = iteratee(object[key], key, object);
    });
    return result;
}
export function replaceAtIndex(array, index, value) {
    if (isDefined(array) && array.length > index) {
        return array.slice(0, index)
            .concat(value)
            .concat(array.slice(index + 1));
    }
    return array;
}
// copied from https://github.com/lodash/lodash/blob/master/forOwn.js
export function forOwn(obj, iteratee) {
    const object = Object(obj);
    Object.keys(object)
        .forEach(key => iteratee(object[key], key, object));
}
