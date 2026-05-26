function stableStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);
    return `{${entries.join(",")}}`;
}
export function createCanonicalSeriesStore() {
    const store = new Map();
    return {
        get size() {
            return store.size;
        },
        get(key) {
            return store.get(stableStringify(key));
        },
        set(key, value) {
            store.set(stableStringify(key), value);
        },
        delete(key) {
            return store.delete(stableStringify(key));
        },
        clear() {
            store.clear();
        },
    };
}
