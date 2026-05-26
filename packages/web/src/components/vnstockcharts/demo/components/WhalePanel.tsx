/**
 * OB-M03 — WhalePanel
 * Display shark/whale/small buy/sell money flow in tỷ VND.
 */
import { useDemoI18n } from "../i18n";
import type { WhaleFeedResponse } from "../vninvest/types";

export interface WhalePanelProps {
	data: WhaleFeedResponse | null;
}

function formatBillion(value: number): string {
	const billion = value / 1_000_000_000;
	return `${billion.toFixed(2)}`;
}

export function WhalePanel({ data }: WhalePanelProps) {
	const { t } = useDemoI18n();

	if (!data) {
		return null;
	}

	const { summary } = data;

	const rows: Array<{ label: string; buy: number; sell: number }> = [
		{ label: t("vninvest.whale.whale"), buy: summary.whale_buy, sell: summary.whale_sell },
		{ label: t("vninvest.whale.shark"), buy: summary.shark_buy, sell: summary.shark_sell },
		{ label: t("vninvest.whale.small"), buy: summary.small_buy, sell: summary.small_sell },
	];

	const netFlow = summary.buy_value - summary.sell_value;
	const isNetPositive = netFlow >= 0;

	return (
		<div className="gc-whale-panel">
			<div className="gc-whale-panel__title">{t("vninvest.whale.summary")}</div>
			<div className="gc-whale-panel__net" data-positive={isNetPositive}>
				<span className="gc-whale-panel__net-label">
					{isNetPositive ? t("vninvest.whale.buy") : t("vninvest.whale.sell")}
				</span>
				<span className="gc-whale-panel__net-value">
					{formatBillion(Math.abs(netFlow))} {t("vninvest.whale.unit")}
				</span>
			</div>
			<table className="gc-whale-panel__table">
				<thead>
					<tr>
						<th></th>
						<th>{t("vninvest.whale.buy")}</th>
						<th>{t("vninvest.whale.sell")}</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr key={row.label}>
							<td className="gc-whale-panel__row-label">{row.label}</td>
							<td className="gc-whale-panel__buy">{formatBillion(row.buy)} {t("vninvest.whale.unit")}</td>
							<td className="gc-whale-panel__sell">{formatBillion(row.sell)} {t("vninvest.whale.unit")}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
