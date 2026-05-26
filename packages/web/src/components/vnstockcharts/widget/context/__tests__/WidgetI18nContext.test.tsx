// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;
console.error = (..._args: unknown[]) => {};

let act: typeof import("react").act;
let createRoot: typeof import("react-dom/client").createRoot;
let WidgetI18nProvider: typeof import("../WidgetI18nContext").WidgetI18nProvider;
let useWidgetI18n: typeof import("../WidgetI18nContext").useWidgetI18n;

beforeAll(async () => {
	({ act } = await import("react"));
	({ createRoot } = await import("react-dom/client"));
	({ WidgetI18nProvider, useWidgetI18n } = await import("../WidgetI18nContext"));
});

type Locale = "vi" | "en";

let setLocaleForTest: ((locale: Locale) => void) | null = null;

function WidgetI18nProbe() {
	const { locale, setLocale, t } = useWidgetI18n();
	setLocaleForTest = setLocale;

	return (
		<div
			data-locale={locale}
			data-loading-label={t("widget.loading")}
			data-no-data-label={t("widget.noData")}
			data-measurement-title={t("measurement.title")}
			data-measurement-bars={t("measurement.bars")}
			data-measurement-price={t("measurement.price")}
		>
			{locale}
		</div>
	);
}

describe("WidgetI18nProvider", () => {
	let container: HTMLDivElement | null = null;
	let root: ReturnType<typeof createRoot> | null = null;

	beforeEach(() => {
		window.localStorage.clear();
		document.documentElement.lang = "en";
	});

	afterEach(() => {
		root?.unmount();
		root = null;
		container?.remove();
		container = null;
		window.localStorage.clear();
		document.documentElement.lang = "en";
		setLocaleForTest = null;
	});

	afterAll(() => {
		console.error = originalConsoleError;
	});

	it("falls back to document language and syncs DOM lang on locale changes", async () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<WidgetI18nProvider>
					<WidgetI18nProbe />
				</WidgetI18nProvider>,
			);
		});

		const probe = container.querySelector("div");
		expect(probe?.getAttribute("data-locale")).toBe("en");
		expect(probe?.getAttribute("data-loading-label")).toBe("Loading chart…");
		expect(probe?.getAttribute("data-measurement-title")).toBe("Measure");
		expect(document.documentElement.lang).toBe("en");

		await act(async () => {
			setLocaleForTest?.("vi");
			await Promise.resolve();
		});

		expect(probe?.getAttribute("data-locale")).toBe("vi");
		expect(probe?.getAttribute("data-no-data-label")).toBe("Chưa có dữ liệu");
		expect(document.documentElement.lang).toBe("vi");
	});

	it("honors an explicit locale prop over document.lang", async () => {
		document.documentElement.lang = "vi";
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<WidgetI18nProvider locale="en">
					<WidgetI18nProbe />
				</WidgetI18nProvider>,
			);
		});

		const probe = container.querySelector("div");
		expect(probe?.getAttribute("data-locale")).toBe("en");
		expect(document.documentElement.lang).toBe("en");
	});

	it("falls back to vi when the document language is unsupported", async () => {
		document.documentElement.lang = "fr";
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		await act(async () => {
			root?.render(
				<WidgetI18nProvider>
					<WidgetI18nProbe />
				</WidgetI18nProvider>,
			);
		});

		const probe = container.querySelector("div");
		expect(probe?.getAttribute("data-locale")).toBe("vi");
		expect(probe?.getAttribute("data-measurement-bars")).toBe("Số nến");
		expect(probe?.getAttribute("data-measurement-price")).toBe("Δ giá");
		expect(document.documentElement.lang).toBe("vi");
	});
});
