function isDate(date) {
    return Object.prototype.toString.call(date) === "[object Date]";
}
function isEqual(val1, val2) {
    return (isDate(val1) && isDate(val2))
        ? val1.getTime() === val2.getTime()
        : val1 === val2;
}
export default function shallowEqual(a, b) {
    if (!a && !b) {
        return true;
    }
    if ((!a && b) || (a && !b)) {
        return false;
    }
    let numKeysA = 0, numKeysB = 0, key;
    for (key in b) {
        numKeysB++;
        if ((b.hasOwnProperty(key) && !a.hasOwnProperty(key)) || !isEqual(a[key], b[key])) {
            return false;
        }
    }
    for (key in a) {
        numKeysA++;
    }
    return numKeysA === numKeysB;
}
