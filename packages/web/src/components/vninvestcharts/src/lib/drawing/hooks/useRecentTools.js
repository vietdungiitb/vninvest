/**
 * TDM-D: useRecentTools — tracks the last N used drawing tools, persisted in localStorage
 */
import { useState, useCallback } from "react";
const STORAGE_KEY = "rsc_recent_tools";
const MAX_RECENT = 5;
function loadRecent() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveRecent(tools) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
    }
    catch {
        // ignore storage errors
    }
}
export function useRecentTools() {
    const [recentTools, setRecentTools] = useState(loadRecent);
    const pushRecent = useCallback((toolId) => {
        setRecentTools((prev) => {
            const next = [toolId, ...prev.filter((id) => id !== toolId)].slice(0, MAX_RECENT);
            saveRecent(next);
            return next;
        });
    }, []);
    const clearRecent = useCallback(() => {
        setRecentTools([]);
        saveRecent([]);
    }, []);
    return { recentTools, pushRecent, clearRecent };
}
