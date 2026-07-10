import { useState, useCallback } from "react";
import { isWidgetTestEnvironment } from "../utils/widgetHelpers.js";

export function useLocalStorageState(key, defaultValue, { parse, stringify } = {}) {
    const [state, setState] = useState(() => {
        try {
            const raw = typeof localStorage !== "undefined" && !isWidgetTestEnvironment() && localStorage.getItem(key);
            if (raw === null || raw === false)
                return defaultValue;
            return parse ? parse(raw) : raw;
        }
        catch (_a) {
            return defaultValue;
        }
    });
    var setAndPersist = useCallback(function (next) {
        setState(next);
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(key, stringify ? stringify(next) : String(next));
            }
        }
        catch (_a) { }
    }, [key, stringify]);
    return [state, setAndPersist];
}
