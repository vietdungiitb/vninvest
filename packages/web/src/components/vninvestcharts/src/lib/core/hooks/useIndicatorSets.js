import { useCallback, useEffect, useMemo, useState } from "react";
import { listRegistered } from "../registry/SeriesRegistry.js";
import { BUILTIN_INDICATOR_SETS } from "../sets/builtins.js";
import { buildIndicatorSetFileName, cloneIndicatorSet, createIndicatorSet, indicatorSetToPaneLayout, loadIndicatorSets, sanitizeIndicatorSet, saveIndicatorSets, stringifyIndicatorSet, } from "../sets/indicatorSetCodec.js";
function pickStorage(storage) {
    if (storage) {
        return storage;
    }
    if (typeof localStorage === "undefined") {
        return undefined;
    }
    return localStorage;
}
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
        reader.readAsText(file);
    });
}
function mergeSets(builtinSets, userSets) {
    const merged = new Map();
    builtinSets.forEach((set) => {
        merged.set(set.id, cloneIndicatorSet({ ...set, isBuiltin: true }));
    });
    userSets.forEach((set) => {
        if (!merged.has(set.id)) {
            merged.set(set.id, cloneIndicatorSet({ ...set, isBuiltin: false }));
        }
    });
    return [...merged.values()].sort((left, right) => {
        if (left.isBuiltin !== right.isBuiltin) {
            return left.isBuiltin ? -1 : 1;
        }
        return right.updatedAt - left.updatedAt;
    });
}
export function useIndicatorSets(options) {
    const storage = useMemo(() => pickStorage(options.storage), [options.storage]);
    const allowedSeriesTypes = useMemo(() => listRegistered(), []);
    const builtinSets = BUILTIN_INDICATOR_SETS;
    const [userSets, setUserSets] = useState(() => {
        const loaded = loadIndicatorSets(storage, { allowedSeriesTypes });
        return loaded.map((set) => cloneIndicatorSet({ ...set, isBuiltin: false }));
    });
    useEffect(() => {
        saveIndicatorSets(storage, userSets);
    }, [storage, userSets]);
    const sets = useMemo(() => mergeSets(builtinSets, userSets), [builtinSets, userSets]);
    const getSetById = useCallback((id) => sets.find((set) => set.id === id), [sets]);
    const saveCurrentAsSet = useCallback((name) => {
        const trimmed = name.trim();
        if (!trimmed) {
            return null;
        }
        const nextSet = createIndicatorSet(trimmed, options.currentPanes);
        setUserSets((current) => [nextSet, ...current.filter((set) => set.id !== nextSet.id)]);
        return nextSet;
    }, [options.currentPanes]);
    const applySet = useCallback((id) => {
        const set = sets.find((item) => item.id === id);
        if (!set) {
            return false;
        }
        options.onApplyPanes?.(indicatorSetToPaneLayout(set));
        return true;
    }, [options.onApplyPanes, sets]);
    const renameSet = useCallback((id, name) => {
        const trimmed = name.trim();
        if (!trimmed) {
            return false;
        }
        let renamed = false;
        setUserSets((current) => current.map((set) => {
            if (set.id !== id || set.isBuiltin) {
                return set;
            }
            renamed = true;
            return {
                ...set,
                name: trimmed,
                updatedAt: Date.now(),
            };
        }));
        return renamed;
    }, []);
    const deleteSet = useCallback((id) => {
        let removed = false;
        setUserSets((current) => current.filter((set) => {
            if (set.id !== id || set.isBuiltin) {
                return true;
            }
            removed = true;
            return false;
        }));
        return removed;
    }, []);
    const exportSet = useCallback((id) => {
        const set = sets.find((item) => item.id === id);
        if (!set || typeof document === "undefined") {
            return false;
        }
        try {
            const blob = new Blob([stringifyIndicatorSet(set)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = buildIndicatorSetFileName(set.name, set.createdAt);
            link.click();
            URL.revokeObjectURL(url);
            return true;
        }
        catch {
            return false;
        }
    }, [sets]);
    const importSet = useCallback(async (file) => {
        try {
            const text = await readFileAsText(file);
            const parsed = JSON.parse(text);
            const imported = sanitizeIndicatorSet(parsed, { allowedSeriesTypes, preserveBuiltin: false });
            if (!imported) {
                return null;
            }
            const nextSet = {
                ...imported,
                isBuiltin: false,
                updatedAt: Date.now(),
            };
            setUserSets((current) => [nextSet, ...current.filter((set) => set.id !== nextSet.id)]);
            return nextSet;
        }
        catch {
            return null;
        }
    }, [allowedSeriesTypes]);
    return {
        sets,
        builtinSets,
        userSets,
        getSetById,
        saveCurrentAsSet,
        applySet,
        renameSet,
        deleteSet,
        exportSet,
        importSet,
    };
}
