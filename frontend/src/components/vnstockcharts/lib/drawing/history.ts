import type { DrawingObject } from "./types";

export interface DrawingHistory {
	past: DrawingObject[][];
	present: DrawingObject[];
	future: DrawingObject[][];
}

export type DrawingHistoryAction =
	| { type: "PUSH"; drawing: DrawingObject }
	| { type: "REPLACE"; drawings: DrawingObject[] }
	| { type: "UNDO" }
	| { type: "REDO" }
	| { type: "CLEAR" };

function cloneDrawings(drawings: readonly DrawingObject[]) {
	return drawings.map((drawing) => ({
		...drawing,
		points: drawing.points.map((point) => ({ ...point })),
		style: { ...drawing.style },
	}));
}

export function createDrawingHistory(drawings: readonly DrawingObject[] = []): DrawingHistory {
	return {
		past: [],
		present: cloneDrawings(drawings),
		future: [],
	};
}

export function historyReducer(state: DrawingHistory, action: DrawingHistoryAction): DrawingHistory {
	switch (action.type) {
		case "PUSH":
			return {
				past: [...state.past, cloneDrawings(state.present)],
				present: [...state.present, action.drawing],
				future: [],
			};
		case "REPLACE":
			return {
				past: [...state.past, cloneDrawings(state.present)],
				present: cloneDrawings(action.drawings),
				future: [],
			};
		case "UNDO": {
			if (state.past.length === 0) {
				return state;
			}

			const nextPast = state.past.slice(0, -1);
			const previousPresent = state.past[state.past.length - 1];
			return {
				past: nextPast,
				present: cloneDrawings(previousPresent),
				future: [cloneDrawings(state.present), ...state.future],
			};
		}
		case "REDO": {
			if (state.future.length === 0) {
				return state;
			}

			const [nextPresent, ...remainingFuture] = state.future;
			return {
				past: [...state.past, cloneDrawings(state.present)],
				present: cloneDrawings(nextPresent),
				future: remainingFuture,
			};
		}
		case "CLEAR":
			return {
				past: [...state.past, cloneDrawings(state.present)],
				present: [],
				future: [],
			};
		default:
			return state;
	}
}