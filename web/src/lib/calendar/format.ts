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

/** 発売時期の全体表記。「2026年10月上旬」「2026年6月 6/15週」など */
export function formatRelease(
	yearMonth: string | null,
	precision: string | null,
	detail: string | null
): string {
	const base = formatYearMonth(yearMonth);
	const suffix = formatDetail(precision, detail);
	if (!suffix) return base;
	// 週は日付が続いて読めるため、区切りを入れる
	return precision === 'week' ? `${base} ${suffix}` : base + suffix;
}

/* 旬・週が今月の何日目までかかるか。発売済みの判定にだけ使う */
function segmentEndDay(precision: string | null, detail: string | null): number {
	if (precision === 'period' && detail) return { early: 10, mid: 20, late: 31 }[detail] ?? 31;
	if (precision === 'week' && detail) return Number(detail.split('-')[1]) + 6;
	return 31;
}

/** 発売の状況を短く言う。「発売済み」「今月発売」「来月発売」「発売まであと約3ヶ月」。不明は null */
export function releaseStatus(
	yearMonth: string | null,
	precision: string | null,
	detail: string | null
): string | null {
	if (!yearMonth) return null;
	const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
	const current = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}`;
	if (yearMonth < current) return '発売済み';
	if (yearMonth > current) {
		const [year, month] = yearMonth.split('-').map(Number);
		const monthsAhead =
			((year ?? 0) - jst.getUTCFullYear()) * 12 + ((month ?? 0) - (jst.getUTCMonth() + 1));
		return monthsAhead === 1 ? '来月発売' : `発売まであと約${monthsAhead}ヶ月`;
	}
	return jst.getUTCDate() > segmentEndDay(precision, detail) ? '発売済み' : '今月発売';
}

/* 旬・週が今月の何日目から始まるか。発売の近さの判定に使う */
function segmentStartDay(precision: string | null, detail: string | null): number {
	if (precision === 'period' && detail) return { early: 1, mid: 11, late: 21 }[detail] ?? 1;
	if (precision === 'week' && detail) return Number(detail.split('-')[1]);
	return 1;
}

/**
 * 一覧で目を引かせる印。「発売中」「まもなく」だけを返し、そうでなければ null
 *
 * 月までしか分からない商品には出さない。月内のいつかを断定できず、
 * 出すと今月の全商品に付いて強弱にならない。
 */
export function releaseHighlight(
	yearMonth: string | null,
	precision: string | null,
	detail: string | null
): '発売中' | 'まもなく' | null {
	if (!yearMonth || !detail) return null;
	if (precision !== 'period' && precision !== 'week') return null;
	const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
	const current = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}`;
	if (yearMonth !== current) return null;

	const today = jst.getUTCDate();
	const start = segmentStartDay(precision, detail);
	const end = segmentEndDay(precision, detail);
	// 期間に入っていれば発売中。手前1週間はまもなく
	if (today >= start && today <= end) return '発売中';
	return start - today <= 7 && start > today ? 'まもなく' : null;
}

/** 今日から offsetMonths ヶ月後の 'YYYY-MM'。日本時間で数える */
export function currentYearMonth(offsetMonths = 0): string {
	const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
	const total = jst.getUTCFullYear() * 12 + jst.getUTCMonth() + offsetMonths;
	const year = Math.floor(total / 12);
	const month = (total % 12) + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}
