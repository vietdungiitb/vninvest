export interface CanonicalSeriesStore<TValue> {
	readonly size: number;
	get(key: unknown): TValue | undefined;
	set(key: unknown, value: TValue): void;
	delete(key: unknown): boolean;
	clear(): void;
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}

	if (Array.isArray(value)) {
		return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	}

	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

	return `{${entries.join(",")}}`;
}

export function createCanonicalSeriesStore<TValue>(): CanonicalSeriesStore<TValue> {
	const store = new Map<string, TValue>();

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