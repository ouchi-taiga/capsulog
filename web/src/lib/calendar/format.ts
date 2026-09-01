const PERIOD_LABELS: Record<string, string> = { early: '上旬', mid: '中旬', late: '下旬' };

/** '2026-10' を「2026年10月」にする。null は「発売月不明」 */
export function formatYearMonth(yearMonth: string | null): string {
	if (!yearMonth) return '発売月不明';
	const [year, month] = yearMonth.split('-');
	return `${year}年${Number(month)}月`;
}

/** 粒度の付加情報を短く表す。旬は「上旬」、週は「10/6週」。月までなら null */
export function formatDetail(precision: string | null, detail: string | null): string | null {
	if (!detail) return null;
	if (precision === 'period') return PERIOD_LABELS[detail] ?? null;
	if (precision === 'week') {
		const [month, day] = detail.split('-');
		return `${Number(month)}/${Number(day)}週`;
	}
	return null;
}

/** 発売時期の全体表記。「2026年10月上旬」など */
export function formatRelease(
	yearMonth: string | null,
	precision: string | null,
	detail: string | null
): string {
	const base = formatYearMonth(yearMonth);
	return base + (formatDetail(precision, detail) ?? '');
}

/** 今日から offsetMonths ヶ月後の 'YYYY-MM'。日本時間で数える */
export function currentYearMonth(offsetMonths = 0): string {
	const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
	const total = jst.getUTCFullYear() * 12 + jst.getUTCMonth() + offsetMonths;
	const year = Math.floor(total / 12);
	const month = (total % 12) + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}
