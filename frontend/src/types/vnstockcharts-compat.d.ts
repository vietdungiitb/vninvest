import "@vnstockcharts/vn-kline-engine-core";
import "@vnstockcharts/vn-kline-engine-react";

export {};

declare module "@vnstockcharts/vn-kline-engine-core" {
	interface PaneRuntimeSnapshot {
		scaleSlotStates?: Record<string, {
			side?: "left" | "right";
			mode?: "auto" | "fixed" | "normalized";
			visible?: boolean;
			domain?: readonly [number, number];
		} | undefined>;
	}

	interface EngineInstance {
		setEnrichedData?: (data: readonly Record<string, unknown>[]) => void;
	}
}

declare module "@vnstockcharts/vn-kline-engine-react" {
	interface EngineHostProps {
		engineOptions?: {
			useWebGL?: boolean;
		};
	}
}