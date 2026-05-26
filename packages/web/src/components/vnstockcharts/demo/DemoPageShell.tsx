import type { ReactNode } from "react";

export interface DemoPageShellProps {
	children: ReactNode;
	className?: string;
	frameClassName?: string;
}

export default function DemoPageShell({ children, className = "", frameClassName = "" }: DemoPageShellProps) {
	const pageClassName = ["demo-page", className].filter(Boolean).join(" ");
	const frameClassNameValue = ["demo-frame", frameClassName].filter(Boolean).join(" ");

	return (
		<main className={pageClassName}>
			<div className={frameClassNameValue}>{children}</div>
		</main>
	);
}