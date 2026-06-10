/**
 * TDM-D: useFavoriteTools — tracks user's pinned drawing tools, persisted in localStorage
 */
import { useState, useCallback } from "react";
const STORAGE_KEY = "rsc_favorite_tools";
function loadFavorites() {
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
function saveFavorites(tools) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tools));
    }
    catch {
        // ignore storage errors
    }
}
export function useFavoriteTools() {
    const [favoriteTools, setFavoriteTools] = useState(loadFavorites);
    const toggleFavorite = useCallback((toolId) => {
        setFavoriteTools((prev) => {
            const next = prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId];
            saveFavorites(next);
            return next;
        });
    }, []);
    const isFavorite = useCallback((toolId) => favoriteTools.includes(toolId), [favoriteTools]);
    return { favoriteTools, toggleFavorite, isFavorite };
}
