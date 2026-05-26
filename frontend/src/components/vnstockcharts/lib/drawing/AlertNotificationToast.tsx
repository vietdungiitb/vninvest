import React, { useEffect } from "react";

export interface DrawingAlertToastItem {
	id: string;
	drawingType: string;
	direction: "crossAbove" | "crossBelow";
	price: number;
	timestamp: number;
	directionLabel?: string;
}

export interface AlertNotificationToastProps {
	items: DrawingAlertToastItem[];
	onDismiss: (id: string) => void;
	audioEnabled?: boolean; // default: false
	autoDismissMs?: number; // default: 8000
}

/**
 * Programmatic audio chime using HTML5 AudioContext.
 * Zero-dependency, lightweight, sounds highly premium.
 */
function playAlertChime() {
	try {
		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;
		const ctx = new AudioContextClass();

		// Short premium chime (C5 to G5 major interval)
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		osc.type = "sine";
		osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
		osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5

		gain.gain.setValueAtTime(0.08, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start();
		osc.stop(ctx.currentTime + 0.25);
	} catch (error) {
		// Suppress autoplay policy errors silently
	}
}

export function AlertNotificationToast({
	items,
	onDismiss,
	audioEnabled = false,
	autoDismissMs = 8000,
}: AlertNotificationToastProps) {
	// Auto-dismiss logic for each item
	useEffect(() => {
		if (items.length === 0) return;

		const latest = items[0];
		const elapsed = Date.now() - latest.timestamp;
		const remaining = Math.max(0, autoDismissMs - elapsed);

		const timer = setTimeout(() => {
			onDismiss(latest.id);
		}, remaining);

		return () => clearTimeout(timer);
	}, [items, autoDismissMs, onDismiss]);

	// Play chime on new items
	useEffect(() => {
		if (audioEnabled && items.length > 0) {
			playAlertChime();
		}
	}, [items.length, audioEnabled]);

	if (items.length === 0) return null;

	const containerStyle: React.CSSProperties = {
		position: "fixed",
		bottom: "24px",
		right: "24px",
		zIndex: 9999,
		display: "flex",
		flexDirection: "column",
		gap: "8px",
		pointerEvents: "none",
		maxWidth: "340px",
		width: "100%",
	};

	return (
		<div style={containerStyle} className="rsc-alert-toast-container">
			{items.slice(0, 5).map((item) => {
				const isCrossAbove = item.direction === "crossAbove";
				const borderLeftColor = isCrossAbove ? "#26a69a" : "#ef5350";

				const toastStyle: React.CSSProperties = {
					pointerEvents: "auto",
					background: "rgba(30, 41, 59, 0.95)", // dark slate with transparency
					color: "#f8fafc",
					borderLeft: `4px solid ${borderLeftColor}`,
					borderRadius: "8px",
					padding: "12px 16px",
					boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: "12px",
					animation: "rsc-toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
					backdropFilter: "blur(8px)",
					WebkitBackdropFilter: "blur(8px)",
					border: "1px solid rgba(255, 255, 255, 0.08)",
				};

				return (
					<div key={item.id} style={toastStyle} className="rsc-alert-toast-item">
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span style={{ fontSize: "16px" }} role="img" aria-label="bell">
								🔔
							</span>
							<div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
								<span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
									{item.drawingType}
								</span>
								<span style={{ fontSize: "13px", fontWeight: "500" }}>
									{item.directionLabel || (isCrossAbove ? "Crossed Above" : "Crossed Below")}{" "}
									<strong style={{ color: borderLeftColor }}>{item.price.toFixed(2)}</strong>
								</span>
							</div>
						</div>
						<button
							type="button"
							onClick={() => onDismiss(item.id)}
							style={{
								background: "none",
								border: "none",
								color: "#94a3b8",
								fontSize: "18px",
								cursor: "pointer",
								padding: "0 4px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								transition: "color 0.15s ease",
							}}
							onMouseEnter={(e) => (e.currentTarget.style.color = "#f1f5f9")}
							onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
							aria-label="Dismiss alert"
						>
							&times;
						</button>
					</div>
				);
			})}
		</div>
	);
}
