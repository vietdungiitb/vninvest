import { useEffect, type CSSProperties } from "react";

export interface DrawingContextMenuItem {
	key: string;
	label: string;
	onSelect: () => void;
	disabled?: boolean;
	danger?: boolean;
}

export interface DrawingContextMenuProps {
	ariaLabel: string;
	items: readonly DrawingContextMenuItem[];
	onClose: () => void;
	position: { x: number; y: number } | null;
	title?: string;
	isDark?: boolean;
}

function resolvePalette(isDark: boolean | undefined) {
	if (isDark) {
		return {
			backdrop: "rgba(15, 23, 42, 0.12)",
			panel: "rgba(15, 23, 42, 0.96)",
			border: "rgba(148, 163, 184, 0.22)",
			text: "#f8fafc",
			subtleText: "rgba(248, 250, 252, 0.7)",
			hover: "rgba(148, 163, 184, 0.12)",
			danger: "#fca5a5",
		};
	}

	return {
		backdrop: "rgba(15, 23, 42, 0.08)",
		panel: "rgba(255, 255, 255, 0.98)",
		border: "rgba(15, 23, 42, 0.14)",
		text: "#0f172a",
		subtleText: "rgba(15, 23, 42, 0.64)",
		hover: "rgba(59, 130, 246, 0.08)",
		danger: "#b91c1c",
	};
}

export function DrawingContextMenu({ ariaLabel, items, onClose, position, title, isDark }: DrawingContextMenuProps) {
	useEffect(() => {
		if (!position || typeof window === "undefined") {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, position]);

	if (!position || items.length === 0) {
		return null;
	}

	const palette = resolvePalette(isDark);

	const overlayStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		zIndex: 40,
		pointerEvents: "auto",
	};

	const backdropStyle: CSSProperties = {
		position: "absolute",
		inset: 0,
		background: palette.backdrop,
	};

	const panelStyle: CSSProperties = {
		position: "absolute",
		left: position.x,
		top: position.y,
		minWidth: 240,
		maxWidth: 280,
		padding: 10,
		borderRadius: 16,
		border: `1px solid ${palette.border}`,
		background: palette.panel,
		boxShadow: "0 20px 40px rgba(15, 23, 42, 0.22)",
		backdropFilter: "blur(14px)",
		WebkitBackdropFilter: "blur(14px)",
		color: palette.text,
	};

	const titleStyle: CSSProperties = {
		margin: "0 0 8px",
		padding: "0 2px 4px",
		fontSize: 11,
		fontWeight: 700,
		letterSpacing: "0.08em",
		textTransform: "uppercase",
		color: palette.subtleText,
	};

	const itemListStyle: CSSProperties = {
		display: "flex",
		flexDirection: "column",
		gap: 4,
	};

	return (
		<div style={overlayStyle}>
			<button
				type="button"
				aria-label={ariaLabel}
				style={backdropStyle}
				onMouseDown={onClose}
			/>
			<div style={panelStyle} role="menu" aria-label={ariaLabel} onMouseDown={(event) => event.stopPropagation()}>
				{title && <div style={titleStyle}>{title}</div>}
				<div style={itemListStyle}>
					{items.map((item) => (
						<button
							key={item.key}
							type="button"
							role="menuitem"
							disabled={item.disabled}
							aria-disabled={item.disabled}
							onClick={() => {
								if (item.disabled) {
									return;
								}
								item.onSelect();
								onClose();
							}}
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								width: "100%",
								padding: "10px 12px",
								borderRadius: 12,
								border: "none",
								background: item.danger ? "rgba(220, 38, 38, 0.08)" : "transparent",
								color: item.disabled ? palette.subtleText : item.danger ? palette.danger : palette.text,
								fontSize: 13,
								fontWeight: 600,
								lineHeight: 1.2,
								cursor: item.disabled ? "not-allowed" : "pointer",
								transition: "background 160ms ease, transform 160ms ease",
								textAlign: "left",
							}}
							onMouseEnter={(event) => {
								if (!item.disabled) {
									event.currentTarget.style.background = item.danger ? "rgba(220, 38, 38, 0.12)" : palette.hover;
								}
							}}
							onMouseLeave={(event) => {
								event.currentTarget.style.background = item.danger ? "rgba(220, 38, 38, 0.08)" : "transparent";
							}}
						>
							<span>{item.label}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}