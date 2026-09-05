import { error } from '@sveltejs/kit';
import { currentYearMonth } from '$lib/calendar/format';
import {
	countProducts,
	listMakers,
	listProducts,
	type ListFilters,
	type Sort
} from '$lib/calendar/queries.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
	const db = platform?.env.DB;
	if (!db) error(500, 'D1 に接続できない');

	const month = url.searchParams.get('month');
	const makerCode = url.searchParams.get('maker') ?? undefined;
	const priceBand = url.searchParams.get('price') ?? undefined;
	const keyword = url.searchParams.get('q')?.trim() || undefined;

	const SORTS: Sort[] = ['release-asc', 'release-desc', 'price-asc', 'price-desc'];
	const requested = SORTS.find((value) => value === url.searchParams.get('sort'));
	// 検索は月の絞り込みが外れるため、指定が無いと最古の年から並ぶ。新作を探す動機に合わせる
	const sort = requested ?? (keyword ? 'release-desc' : undefined);

	// 月の指定がなければ今月と来月。検索時は全期間から探す
	let yearMonths: string[] = [];
	let fromYearMonth: string | undefined;
	let untilYearMonth: string | undefined;
	if (month === null && !keyword) yearMonths = [currentYearMonth(0), currentYearMonth(1)];
	else if (month === 'later') fromYearMonth = currentYearMonth(2);
	else if (month === 'earlier') untilYearMonth = currentYearMonth(-2);
	else if (month && /^\d{4}-\d{2}$/.test(month)) yearMonths = [month];

	const filters: ListFilters = {
		yearMonths,
		fromYearMonth,
		untilYearMonth,
		unknownOnly: month === 'unknown',
		makerCode,
		priceBand:
			priceBand === '300' || priceBand === '400' || priceBand === '500' ? priceBand : undefined,
		keyword,
		sort
	};

	const [makers, list, counts] = await Promise.all([
		listMakers(db),
		listProducts(db, filters),
		countProducts(db, currentYearMonth(0))
	]);
	return {
		makers,
		counts,
		...list,
		previousYearMonth: currentYearMonth(-1),
		thisYearMonth: currentYearMonth(0),
		nextYearMonth: currentYearMonth(1),
		laterYearMonth: currentYearMonth(2),
		earlierYearMonth: currentYearMonth(-2),
		// sort は URL で選ばれた値、activeSort は既定を含めて実際に効いている値
		filters: { month, makerCode, priceBand, keyword, sort },
		activeSort: sort ?? (month === 'earlier' ? 'release-desc' : 'release-asc')
	};
};
