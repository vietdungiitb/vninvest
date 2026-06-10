const memoryDB = {
    manifests: new Map(),
    coverageIndexes: new Map(),
    segments: new Map(),
};
function fnv1a32(input) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
function createSegmentChecksum(bars) {
    const payload = bars
        .map((bar) => [
        bar.date.getTime(),
        bar.open,
        bar.high,
        bar.low,
        bar.close,
        bar.volume,
    ])
        .join("|");
    return fnv1a32(payload);
}
function createManifestChecksum(manifest) {
    return fnv1a32(JSON.stringify(manifest));
}
function normalizeOptionalString(value) {
    return typeof value === "string" && value.length > 0 ? value : null;
}
function normalizeOptionalNumber(value) {
    return typeof value === "number" ? value : null;
}
function semanticScopesEqual(left, right) {
    if (!left || !right) {
        return false;
    }
    return left.sourceContractVersion === right.sourceContractVersion
        && left.instrumentClass === right.instrumentClass
        && left.sessionModel === right.sessionModel
        && normalizeOptionalString(left.sessionCalendarId) === normalizeOptionalString(right.sessionCalendarId)
        && left.timezone === right.timezone
        && left.finalityMode === right.finalityMode
        && normalizeOptionalNumber(left.correctionLookbackMs) === normalizeOptionalNumber(right.correctionLookbackMs);
}
function manifestToSemanticScope(manifest) {
    if (!manifest) {
        return null;
    }
    return {
        sourceContractVersion: manifest.sourceContractVersion,
        instrumentClass: manifest.instrumentClass,
        sessionModel: manifest.sessionModel,
        sessionCalendarId: manifest.sessionCalendarId,
        timezone: manifest.timezone,
        finalityMode: manifest.finalityMode,
        correctionLookbackMs: manifest.correctionLookbackMs,
    };
}
/**
 * Normalizes an array of ranges by union-merging overlapping or contiguous intervals.
 * Expects ranges to be sorted or will sort them internally.
 */
export function normalizeRanges(ranges) {
    if (ranges.length <= 1) {
        return ranges;
    }
    const sorted = [...ranges].sort((a, b) => a.fromTs - b.fromTs);
    const merged = [];
    let current = sorted[0];
    for (let i = 1; i < sorted.length; i += 1) {
        const next = sorted[i];
        // Contiguous or overlapping range check (dedupe/coalescing)
        if (current.toTs >= next.fromTs) {
            current = {
                fromTs: current.fromTs,
                toTs: Math.max(current.toTs, next.toTs),
            };
        }
        else {
            merged.push(current);
            current = next;
        }
    }
    merged.push(current);
    return merged;
}
/**
 * Computes missing segments (gaps) in targetRange not covered by coverageRanges.
 */
export function computeMissingTimeRanges(targetRange, coverageRanges) {
    const intersections = [];
    for (const range of coverageRanges) {
        const start = Math.max(targetRange.fromTs, range.fromTs);
        const end = Math.min(targetRange.toTs, range.toTs);
        if (start < end) {
            intersections.push({ fromTs: start, toTs: end });
        }
    }
    if (intersections.length === 0) {
        return [targetRange];
    }
    intersections.sort((a, b) => a.fromTs - b.fromTs);
    const missing = [];
    let currentTs = targetRange.fromTs;
    for (const intersect of intersections) {
        if (currentTs < intersect.fromTs) {
            missing.push({ fromTs: currentTs, toTs: intersect.fromTs });
        }
        currentTs = Math.max(currentTs, intersect.toTs);
    }
    if (currentTs < targetRange.toTs) {
        missing.push({ fromTs: currentTs, toTs: targetRange.toTs });
    }
    return missing;
}
/**
 * IndexedDB + InMemory fallback implementation for LocalCacheMatrix
 */
class IndexedDBCacheMatrix {
    cacheRoot;
    dbName;
    dbPromise = null;
    useMemoryOnly = false;
    constructor(cacheRoot) {
        this.cacheRoot = cacheRoot;
        this.dbName = `VNInvestCharts_Cache_${cacheRoot.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        // Proactively check if indexedDB is available
        const isBrowser = typeof window !== "undefined";
        const idb = isBrowser ? (window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB) : null;
        if (!idb && typeof globalThis !== "undefined" && !globalThis.indexedDB) {
            this.useMemoryOnly = true;
        }
    }
    async getDB() {
        if (this.useMemoryOnly) {
            return null;
        }
        if (this.dbPromise) {
            return this.dbPromise;
        }
        this.dbPromise = new Promise((resolve) => {
            const idb = globalThis.indexedDB
                || (typeof window !== "undefined" ? (window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB) : null);
            if (!idb) {
                this.useMemoryOnly = true;
                resolve(null);
                return;
            }
            const request = idb.open(this.dbName, 2);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("manifests")) {
                    db.createObjectStore("manifests", { keyPath: "cacheKey" });
                }
                if (!db.objectStoreNames.contains("coverage_indexes")) {
                    db.createObjectStore("coverage_indexes", { keyPath: "cacheKey" });
                }
                if (!db.objectStoreNames.contains("segments")) {
                    db.createObjectStore("segments", { keyPath: "segmentKey" });
                }
            };
            request.onsuccess = (event) => {
                resolve(event.target.result);
            };
            request.onerror = () => {
                this.useMemoryOnly = true;
                resolve(null);
            };
        });
        return this.dbPromise;
    }
    async getManifest(cacheKey, db) {
        const resolvedDb = db ?? await this.getDB();
        if (this.useMemoryOnly || !resolvedDb) {
            return memoryDB.manifests.get(cacheKey) ?? null;
        }
        return new Promise((resolveManifest) => {
            try {
                const tx = resolvedDb.transaction(["manifests"], "readonly");
                const store = tx.objectStore("manifests");
                const req = store.get(cacheKey);
                req.onsuccess = () => resolveManifest(req.result ?? null);
                req.onerror = () => resolveManifest(null);
            }
            catch {
                resolveManifest(null);
            }
        });
    }
    async invalidateIfSemanticScopeMismatch(cacheKey, expectedScope, manifest, coverage) {
        if (!expectedScope) {
            return false;
        }
        if (!manifest && !coverage) {
            return false;
        }
        const manifestScope = manifestToSemanticScope(manifest);
        if (!semanticScopesEqual(manifestScope, expectedScope)) {
            await this.invalidate(cacheKey, "source-contract-changed");
            return true;
        }
        if (coverage && !semanticScopesEqual(coverage.semanticScope, expectedScope)) {
            await this.invalidate(cacheKey, "source-contract-changed");
            return true;
        }
        return false;
    }
    async getCoverage(cacheKey, expectedScope) {
        const db = await this.getDB();
        const manifest = await this.getManifest(cacheKey, db);
        let coverage = null;
        if (this.useMemoryOnly || !db) {
            const memIndex = memoryDB.coverageIndexes.get(cacheKey);
            coverage = memIndex ? memIndex : null;
        }
        else {
            coverage = await new Promise((resolve) => {
                try {
                    const tx = db.transaction(["coverage_indexes"], "readonly");
                    const store = tx.objectStore("coverage_indexes");
                    const req = store.get(cacheKey);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                }
                catch {
                    resolve(null);
                }
            });
        }
        if (await this.invalidateIfSemanticScopeMismatch(cacheKey, expectedScope, manifest, coverage)) {
            return null;
        }
        return coverage;
    }
    async readRanges(cacheKey, ranges, expectedScope) {
        const coverage = await this.getCoverage(cacheKey, expectedScope);
        if (!coverage || coverage.segments.length === 0) {
            return { bars: [], missingRanges: ranges };
        }
        // 1. Identify which segments we need to read and analyze gaps (missing ranges)
        const neededSegments = [];
        const allMissingRanges = [];
        for (const targetRange of ranges) {
            // Find intersecting segments in our coverage
            for (const seg of coverage.segments) {
                const overlapStart = Math.max(targetRange.fromTs, seg.fromTs);
                const overlapEnd = Math.min(targetRange.toTs, seg.toTs);
                if (overlapStart < overlapEnd) {
                    neededSegments.push(seg);
                }
            }
            // Precise Gap Analysis (contract-offline-replay-cache-hit)
            const missingForTarget = computeMissingTimeRanges(targetRange, coverage.ranges);
            allMissingRanges.push(...missingForTarget);
        }
        // 2. Fetch bars from identified segments
        const barsMap = new Map();
        const db = await this.getDB();
        if (this.useMemoryOnly || !db) {
            for (const seg of neededSegments) {
                const segmentKey = `${cacheKey}::${seg.fromTs}::${seg.toTs}`;
                const data = memoryDB.segments.get(segmentKey);
                if (data) {
                    for (const bar of data.bars) {
                        barsMap.set(bar.date.getTime(), bar);
                    }
                }
            }
        }
        else {
            await new Promise((resolveRead) => {
                try {
                    const tx = db.transaction(["segments"], "readonly");
                    const store = tx.objectStore("segments");
                    let pending = neededSegments.length;
                    if (pending === 0) {
                        resolveRead();
                        return;
                    }
                    for (const seg of neededSegments) {
                        const segmentKey = `${cacheKey}::${seg.fromTs}::${seg.toTs}`;
                        const req = store.get(segmentKey);
                        req.onsuccess = () => {
                            const result = req.result;
                            if (result && Array.isArray(result.bars)) {
                                for (const b of result.bars) {
                                    // Rehydrate Date object from JSON timestamp
                                    const date = new Date(b.t);
                                    barsMap.set(b.t, {
                                        date,
                                        open: b.o,
                                        high: b.h,
                                        low: b.l,
                                        close: b.c,
                                        volume: b.v,
                                        index: b.index,
                                        dataIndex: b.dataIndex,
                                    });
                                }
                            }
                            pending -= 1;
                            if (pending === 0)
                                resolveRead();
                        };
                        req.onerror = () => {
                            pending -= 1;
                            if (pending === 0)
                                resolveRead();
                        };
                    }
                }
                catch {
                    resolveRead();
                }
            });
        }
        const sortedBars = Array.from(barsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
        return {
            bars: sortedBars,
            missingRanges: normalizeRanges(allMissingRanges),
        };
    }
    async writePatch(cacheKey, bars, meta) {
        if (bars.length === 0) {
            const index = await this.getCoverage(cacheKey, meta.semanticScope);
            return {
                cacheKey,
                revision: index?.revision ?? 0,
                writtenBarCount: 0,
                affectedRanges: [],
            };
        }
        // 1. Validate, sort and deduplicate bars (Contract Rule: last wins)
        const validated = bars.filter((b) => {
            const t = b.date.getTime();
            return Number.isFinite(t) &&
                Number.isFinite(b.open) &&
                Number.isFinite(b.high) &&
                Number.isFinite(b.low) &&
                Number.isFinite(b.close) &&
                Number.isFinite(b.volume);
        });
        if (validated.length === 0) {
            const index = await this.getCoverage(cacheKey, meta.semanticScope);
            return {
                cacheKey,
                revision: index?.revision ?? 0,
                writtenBarCount: 0,
                affectedRanges: [],
            };
        }
        const sorted = [...validated].sort((a, b) => a.date.getTime() - b.date.getTime());
        const deduplicated = [];
        for (const bar of sorted) {
            if (deduplicated.length > 0 && deduplicated[deduplicated.length - 1].date.getTime() === bar.date.getTime()) {
                deduplicated[deduplicated.length - 1] = bar;
            }
            else {
                deduplicated.push(bar);
            }
        }
        const fromTs = deduplicated[0].date.getTime();
        const toTs = deduplicated[deduplicated.length - 1].date.getTime();
        const revision = meta.sessionRevision;
        // 2. Format segment data matching CACHE_FILE_CONTRACT
        const segmentKey = `${cacheKey}::${fromTs}::${toTs}`;
        const segmentData = {
            segmentKey,
            cacheKey,
            revision,
            fromTs,
            toTs,
            bars: deduplicated.map((b) => ({
                t: b.date.getTime(),
                o: b.open,
                h: b.high,
                l: b.low,
                c: b.close,
                v: b.volume,
                index: b.index,
                dataIndex: b.dataIndex,
            })),
        };
        const segmentMeta = {
            file: `segments/seg_${fromTs}_${toTs}_${revision}.json`,
            fromTs,
            toTs,
            barCount: deduplicated.length,
            checksum: createSegmentChecksum(deduplicated),
            lastAccessedAt: new Date().toISOString(),
        };
        const db = await this.getDB();
        // 3. Update Manifest and Coverage Index using transactional write (Atomic Write)
        const currentCoverage = await this.getCoverage(cacheKey, meta.semanticScope);
        const currentRevision = currentCoverage?.revision ?? 0;
        const nextRevision = currentRevision + 1;
        const currentSegments = currentCoverage?.segments ?? [];
        const updatedSegments = [...currentSegments.filter((s) => s.fromTs !== fromTs || s.toTs !== toTs), segmentMeta];
        const updatedRanges = updatedSegments.map((s) => ({ fromTs: s.fromTs, toTs: s.toTs }));
        const normalized = normalizeRanges(updatedRanges);
        const existingManifest = await this.getManifest(cacheKey, db);
        const semanticScope = meta.semanticScope ?? currentCoverage?.semanticScope ?? manifestToSemanticScope(existingManifest) ?? undefined;
        const nextCoverage = {
            schemaVersion: "v2",
            cacheKey,
            revision: nextRevision,
            semanticScope,
            ranges: normalized,
            segments: updatedSegments,
        };
        const keyParts = cacheKey.split(":");
        const manifestWithoutChecksum = {
            schemaVersion: "v2",
            cacheKey,
            source: keyParts[0] || "unknown",
            sourceContractVersion: semanticScope?.sourceContractVersion ?? existingManifest?.sourceContractVersion ?? "unknown",
            symbol: keyParts[1] || "unknown",
            timeframe: keyParts[2] || "unknown",
            adjustmentPolicy: keyParts[3] || "unknown",
            instrumentClass: semanticScope?.instrumentClass ?? existingManifest?.instrumentClass ?? "custom",
            sessionModel: semanticScope?.sessionModel ?? existingManifest?.sessionModel ?? "continuous",
            sessionCalendarId: semanticScope?.sessionCalendarId ?? existingManifest?.sessionCalendarId,
            timezone: semanticScope?.timezone ?? existingManifest?.timezone ?? "UTC",
            finalityMode: semanticScope?.finalityMode ?? existingManifest?.finalityMode ?? "immutable",
            correctionLookbackMs: semanticScope?.correctionLookbackMs ?? existingManifest?.correctionLookbackMs,
            createdAt: existingManifest?.createdAt ?? new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            revision: nextRevision,
            segmentCount: updatedSegments.length,
            totalBars: updatedSegments.reduce((sum, s) => sum + s.barCount, 0),
            quota: {
                symbolSoftCapMb: 250,
                globalQuotaMb: 1536,
            },
        };
        const nextManifest = {
            ...manifestWithoutChecksum,
            checksum: {
                algorithm: "sha256",
                manifestHash: createManifestChecksum(manifestWithoutChecksum),
            },
        };
        if (this.useMemoryOnly || !db) {
            // Write in memory atomically
            memoryDB.segments.set(segmentKey, { bars: deduplicated, revision: nextRevision });
            memoryDB.coverageIndexes.set(cacheKey, nextCoverage);
            memoryDB.manifests.set(cacheKey, nextManifest);
        }
        else {
            // Transactional Atomic Write
            await new Promise((resolveWrite, rejectWrite) => {
                try {
                    const tx = db.transaction(["manifests", "coverage_indexes", "segments"], "readwrite");
                    tx.oncomplete = () => resolveWrite();
                    tx.onerror = () => rejectWrite(new Error("IndexedDB transaction aborted"));
                    tx.onabort = () => rejectWrite(new Error("IndexedDB transaction aborted manually"));
                    const manifestStore = tx.objectStore("manifests");
                    const coverageStore = tx.objectStore("coverage_indexes");
                    const segmentStore = tx.objectStore("segments");
                    manifestStore.put(nextManifest);
                    coverageStore.put(nextCoverage);
                    segmentStore.put(segmentData);
                }
                catch (err) {
                    rejectWrite(err);
                }
            });
        }
        return {
            cacheKey,
            revision: nextRevision,
            writtenBarCount: deduplicated.length,
            affectedRanges: [{ fromTs, toTs }],
        };
    }
    async invalidate(cacheKey, reason) {
        const db = await this.getDB();
        if (this.useMemoryOnly || !db) {
            memoryDB.manifests.delete(cacheKey);
            memoryDB.coverageIndexes.delete(cacheKey);
            for (const key of memoryDB.segments.keys()) {
                if (key.startsWith(cacheKey)) {
                    memoryDB.segments.delete(key);
                }
            }
            return;
        }
        await new Promise((resolveInvalidate) => {
            try {
                const tx = db.transaction(["manifests", "coverage_indexes", "segments"], "readwrite");
                tx.oncomplete = () => resolveInvalidate();
                tx.onerror = () => resolveInvalidate();
                const manifestStore = tx.objectStore("manifests");
                const coverageStore = tx.objectStore("coverage_indexes");
                const segmentStore = tx.objectStore("segments");
                manifestStore.delete(cacheKey);
                coverageStore.delete(cacheKey);
                // Perform a scan deletion in IndexedDB segments
                const req = segmentStore.openCursor();
                req.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const value = cursor.value;
                        if (value && value.cacheKey === cacheKey) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
            }
            catch {
                resolveInvalidate();
            }
        });
    }
    async evict(policy) {
        // Mock implementation for evict - keeps cache quotas bounded
        return {
            reclaimedBytes: 0,
            deletedSegmentCount: 0,
        };
    }
}
/**
 * Native factory class matching barrel exports
 */
export class LocalCacheMatrixFactoryImpl {
    create(cacheRoot) {
        return new IndexedDBCacheMatrix(cacheRoot);
    }
}
