import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloneDrawingSnapshot } from "../clipboard";
import { createLocalStorageAdapter } from "../DrawingStorage";
import { getSelectedObjectIds } from "../stateMachine";
import type { DrawingObject, DrawingToolType } from "../types";
import { useDrawingInteraction } from "../useDrawingInteraction";
import { useDrawingStorage, type UseDrawingStorageReturn } from "../useDrawingStorage";

export type DrawingWorkspaceTool = DrawingToolType | "cursor" | "crosshair";
export type DrawingDockTab = "properties" | "objects" | "templates";

export interface DrawingWorkspaceState {
	activeTool: DrawingWorkspaceTool;
	clipboard: DrawingObject | null;
	dock: {
		isOpen: boolean;
		activeTab: DrawingDockTab;
	};
	drawings: readonly DrawingObject[];
	selectedDrawing: DrawingObject | null;
	selectedIds: readonly string[];
}

export interface DrawingWorkspaceController {
	interaction: ReturnType<typeof useDrawingInteraction>;
	storage: UseDrawingStorageReturn;
	state: DrawingWorkspaceState;
	setActiveTool: (tool: DrawingWorkspaceTool) => void;
	setClipboard: (drawing: DrawingObject | null) => void;
	copySelected: () => void;
	clearClipboard: () => void;
	openDock: (tab?: DrawingDockTab) => void;
	closeDock: () => void;
	setDockTab: (tab: DrawingDockTab) => void;
	selectDrawing: (objectId: string | null) => void;
	cloneClipboard: () => DrawingObject | null;
}

export interface UseDrawingWorkspaceControllerOptions {
	defaultDockTab?: DrawingDockTab;
	defaultDrawings?: readonly DrawingObject[];
	drawings?: readonly DrawingObject[];
	drawingStorageKey?: string;
	enabled?: boolean;
	onDrawingsChange?: (drawings: readonly DrawingObject[]) => void;
	symbol: string;
	timeframe: string;
}

function cloneDrawings(drawings: readonly DrawingObject[]) {
	return drawings.map((drawing) => cloneDrawingSnapshot(drawing));
}

function areDrawingsEqual(left: readonly DrawingObject[], right: readonly DrawingObject[]) {
	if (left === right) {
		return true;
	}
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index += 1) {
		if (left[index].id !== right[index].id || left[index].updatedAt !== right[index].updatedAt) {
			return false;
		}
	}
	return true;
}

function getSelectedDrawing(drawings: readonly DrawingObject[], selectedIds: readonly string[]) {
	if (selectedIds.length === 0) {
		return null;
	}
	return drawings.find((drawing) => drawing.id === selectedIds[0]) ?? null;
}

export function useDrawingWorkspaceController({
	defaultDockTab = "properties",
	defaultDrawings,
	drawings,
	drawingStorageKey,
	enabled = true,
	onDrawingsChange,
	symbol,
	timeframe,
}: UseDrawingWorkspaceControllerOptions): DrawingWorkspaceController {
	const isControlled = drawings !== undefined;
	const initialDrawingsRef = useRef<readonly DrawingObject[]>(drawings ?? defaultDrawings ?? []);
	const interaction = useDrawingInteraction(initialDrawingsRef.current);
	const [activeTool, setActiveTool] = useState<DrawingWorkspaceTool>("cursor");
	const [clipboard, setClipboard] = useState<DrawingObject | null>(null);
	const [dock, setDock] = useState<{ isOpen: boolean; activeTab: DrawingDockTab }>({
		isOpen: false,
		activeTab: defaultDockTab,
	});
	const syncingFromExternalRef = useRef(false);
	const storageAdapter = useMemo(() => createLocalStorageAdapter(drawingStorageKey), [drawingStorageKey]);
	const allDrawings = interaction.allDrawings;
	const replaceDrawings = interaction.replaceDrawings;

	const handleStorageLoad = useCallback((loadedDrawings: DrawingObject[]) => {
		if (isControlled) {
			onDrawingsChange?.(cloneDrawings(loadedDrawings));
			return;
		}
		replaceDrawings(loadedDrawings);
	}, [isControlled, onDrawingsChange, replaceDrawings]);

	const storage = useDrawingStorage(
		symbol,
		timeframe,
		allDrawings,
		handleStorageLoad,
		storageAdapter,
		{ enabled: enabled && !isControlled },
	);

	useEffect(() => {
		if (!enabled || !isControlled) {
			return;
		}
		const nextDrawings = drawings ?? [];
		if (areDrawingsEqual(nextDrawings, allDrawings)) {
			return;
		}
		syncingFromExternalRef.current = true;
		replaceDrawings(nextDrawings);
	}, [allDrawings, drawings, enabled, isControlled, replaceDrawings]);

	useEffect(() => {
		if (!enabled || !onDrawingsChange) {
			return;
		}
		if (syncingFromExternalRef.current) {
			syncingFromExternalRef.current = false;
			return;
		}
		onDrawingsChange(cloneDrawings(allDrawings));
	}, [allDrawings, enabled, onDrawingsChange]);

	const selectedIds = useMemo(() => getSelectedObjectIds(interaction.drawingState), [interaction.drawingState]);
	const selectedDrawing = useMemo(
		() => getSelectedDrawing(allDrawings, selectedIds),
		[allDrawings, selectedIds],
	);

	const copySelected = useCallback(() => {
		if (!selectedDrawing) {
			return;
		}
		setClipboard(cloneDrawingSnapshot(selectedDrawing));
	}, [selectedDrawing]);

	const clearClipboard = useCallback(() => {
		setClipboard(null);
	}, []);

	const openDock = useCallback((tab?: DrawingDockTab) => {
		setDock((current) => ({
			isOpen: true,
			activeTab: tab ?? current.activeTab,
		}));
	}, []);

	const closeDock = useCallback(() => {
		setDock((current) => ({ ...current, isOpen: false }));
	}, []);

	const setDockTab = useCallback((tab: DrawingDockTab) => {
		setDock({ isOpen: true, activeTab: tab });
	}, []);

	const selectDrawing = useCallback((objectId: string | null) => {
		if (!objectId) {
			interaction.cancelDrawing();
			return;
		}
		interaction.selectObject(objectId);
	}, [interaction]);

	const cloneClipboard = useCallback(() => {
		return clipboard ? cloneDrawingSnapshot(clipboard) : null;
	}, [clipboard]);

	const state = useMemo<DrawingWorkspaceState>(() => ({
		activeTool,
		clipboard,
		dock,
		drawings: allDrawings,
		selectedDrawing,
		selectedIds,
	}), [activeTool, allDrawings, clipboard, dock, selectedDrawing, selectedIds]);

	return useMemo(() => ({
		interaction,
		storage,
		state,
		setActiveTool,
		setClipboard,
		copySelected,
		clearClipboard,
		openDock,
		closeDock,
		setDockTab,
		selectDrawing,
		cloneClipboard,
	}), [clearClipboard, cloneClipboard, closeDock, copySelected, interaction, openDock, selectDrawing, setDockTab, state, storage]);
}