export class BaseAdapter {
    baseUrl;
    cacheTtlMs;
    requestCache = new Map();
    constructor(baseUrl = "", cacheTtlMs = 1_000) {
        this.baseUrl = baseUrl;
        this.cacheTtlMs = cacheTtlMs;
    }
    buildUrl(path) {
        const fallbackOrigin = typeof globalThis.location !== "undefined" ? globalThis.location.origin : "http://localhost";
        return new URL(path, this.baseUrl || fallbackOrigin).toString();
    }
    buildWebSocketUrl(path) {
        const url = new URL(path, this.baseUrl || (typeof globalThis.location !== "undefined" ? globalThis.location.origin : "http://localhost"));
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        return url.toString();
    }
    async requestJson(path, init) {
        const response = await fetch(this.buildUrl(path), init);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
    }
    memoize(cacheKey, loader) {
        const cached = this.requestCache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
            return cached.value;
        }
        const value = loader().catch((error) => {
            this.requestCache.delete(cacheKey);
            throw error;
        });
        this.requestCache.set(cacheKey, {
            expiresAt: now + this.cacheTtlMs,
            value: value,
        });
        return value;
    }
    normalizeBar(rawBar, fallbackIndex) {
        const rawDate = rawBar.date;
        return {
            ...rawBar,
            date: rawDate instanceof Date ? rawDate : new Date(rawDate),
            index: rawBar.index ?? fallbackIndex,
            dataIndex: rawBar.dataIndex ?? fallbackIndex,
        };
    }
    normalizeBars(rawBars) {
        return rawBars.map((rawBar, index) => this.normalizeBar(rawBar, index));
    }
}
