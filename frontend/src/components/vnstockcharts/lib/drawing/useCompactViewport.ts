import { useEffect, useState } from "react";

const DEFAULT_MAX_WIDTH = 767;

function resolveViewportMatch(maxWidth: number) {
	if (typeof window === "undefined") {
		return false;
	}

	return window.innerWidth <= maxWidth;
}

export function useCompactViewport(maxWidth = DEFAULT_MAX_WIDTH) {
	const [isCompactViewport, setIsCompactViewport] = useState(() => resolveViewportMatch(maxWidth));

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const updateViewportMatch = () => {
			setIsCompactViewport(resolveViewportMatch(maxWidth));
		};

		updateViewportMatch();
		window.addEventListener("resize", updateViewportMatch);
		window.addEventListener("orientationchange", updateViewportMatch);

		return () => {
			window.removeEventListener("resize", updateViewportMatch);
			window.removeEventListener("orientationchange", updateViewportMatch);
		};
	}, [maxWidth]);

	return isCompactViewport;
}