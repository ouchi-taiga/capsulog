import type {
	Maker,
	MonthGroup,
	ProductDetail,
	ProductListItem,
	Variant,
	YearCount
} from './types';

export type ListFilters = {
	/** 絞り込む発売月。空配列は全期間 */
	yearMonths: string[];
	/** この月以降を出す。「再来月以降」用。yearMonths より優先 */
	fromYearMonth?: string;
	/** この月以前を出す。「先々月以前」用。新しい月から順に返す */
	untilYearMonth?: string;
	/** この年のものだけを出す。'YYYY'。過去を年で辿るときに使う */
	year?: string;
	/** true なら発売月不明だけを出す */
	unknownOnly?: boolean;
	makerCode?: string;
	priceBand?: '300' | '400' | '500';
	keyword?: string;
	/** 並び順。省略時は月の絞り込みに合わせて向きを決める */
	sort?: Sort;
	/** 何件返すか */
	limit?: number;
	/** 何件目から返すか。続きだけを取るときに使う */
	offset?: number;
};

export type Sort = 'release-asc' | 'release-desc' | 'price-asc' | 'price-desc';

/*
 * 1回で取る件数。スクロールで続きを足していく。
 * 既定表示は 20 件前後、年で辿っても月あたり 12 件ほど。
 * 大きくしても最初の1画面より下は読まれず、待ち時間だけ延びる。
 */
export const PAGE_SIZE = 60;

/* 読み進められる上限。URL に極端な limit や offset を渡されても、D1 を酷使させない */
export const MAX_LIMIT = 1200;

const SELECT_ITEM = `
	SELECT p.id, p.name, p.price,
	       p.release_year_month AS yearMonth,
	       p.release_precision  AS precision,
	       p.release_detail     AS detail,
	       p.total_variants     AS totalVariants,
	       p.official_url       AS officialUrl,
	       m.code AS makerCode, m.name AS makerName
	FROM products p JOIN makers m ON m.id = p.maker_id
`;

/* 月の中の並び。旬は 上→中→下、週は日付を旬の位置に換算して混ぜる。月までの商品が先頭 */
const RELEASE_ORDER = `
	CASE p.release_precision
		WHEN 'period' THEN CASE p.release_detail WHEN 'early' THEN 1 WHEN 'mid' THEN 2 ELSE 3 END
		WHEN 'week'   THEN (CAST(substr(p.release_detail, 4, 2) AS INTEGER) + 9) / 10
		ELSE 0
	END
`;

function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (character) => '\\' + character);
}

/** 商品を持つメーカーの一覧 */
export async function listMakers(db: D1Database): Promise<Maker[]> {
	const { results } = await db
		.prepare(
			`SELECT code, name FROM makers m
			 WHERE EXISTS (SELECT 1 FROM products p WHERE p.maker_id = m.id) ORDER BY m.id`
		)
		.all<Maker>();
	return results;
}

/** 絞り込み条件に合う商品を発売月ごとにまとめて返す */
export async function listProducts(
	db: D1Database,
	filters: ListFilters
): Promise<{ groups: MonthGroup[]; total: number; hasMore: boolean }> {
	const where: string[] = [];
	const binds: (string | number)[] = [];

	if (filters.unknownOnly) {
		where.push('p.release_year_month IS NULL');
	} else if (filters.year) {
		where.push('substr(p.release_year_month, 1, 4) = ?');
		binds.push(filters.year);
		// 年の一覧は先々月以前の件数で出している。押した先も同じ範囲に合わせる
		if (filters.untilYearMonth) {
			where.push('p.release_year_month <= ?');
			binds.push(filters.untilYearMonth);
		}
	} else if (filters.fromYearMonth) {
		where.push('p.release_year_month >= ?');
		binds.push(filters.fromYearMonth);
	} else if (filters.untilYearMonth) {
		where.push('p.release_year_month <= ?');
		binds.push(filters.untilYearMonth);
	} else if (filters.yearMonths.length > 0) {
		where.push(`p.release_year_month IN (${filters.yearMonths.map(() => '?').join(', ')})`);
		binds.push(...filters.yearMonths);
	}
	if (filters.makerCode) {
		where.push('m.code = ?');
		binds.push(filters.makerCode);
	}
	if (filters.priceBand === '300') where.push('p.price <= 300');
	if (filters.priceBand === '400') where.push('p.price BETWEEN 301 AND 499');
	if (filters.priceBand === '500') where.push('p.price >= 500');
	if (filters.keyword) {
		where.push(`p.name LIKE ? ESCAPE '\\'`);
		binds.push(`%${escapeLike(filters.keyword)}%`);
	}

	// 指定が無ければ現在から遠ざかる向き。過去をさかのぼる表示だけ新しい月が先になる
	const goingBack = Boolean(filters.untilYearMonth || filters.year);
	const sort: Sort = filters.sort ?? (goingBack ? 'release-desc' : 'release-asc');
	const descending = sort.endsWith('-desc');
	const direction = descending ? 'DESC' : 'ASC';

	// 価格順は月を挟まない。月を先に見ると、月の中だけの価格順になって全体の高安が出ない
	const order = sort.startsWith('price')
		? `p.price IS NULL, p.price ${direction}, p.name`
		: // 月をまたぐ向きに月の中も揃える。新しい順なら下旬が先に来る
			`p.release_year_month ${direction}, ${RELEASE_ORDER} ${direction}, p.name`;
	// 続きを足していくため、並びが毎回同じでなければならない。同名の商品があるので id で決着させる
	const sql = `${SELECT_ITEM}
		${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY p.release_year_month IS NULL, ${order}, p.id
		LIMIT ? OFFSET ?`;

	const limit = filters.limit ?? PAGE_SIZE;
	const { results } = await db
		.prepare(sql)
		.bind(...binds, limit + 1, filters.offset ?? 0)
		.all<ProductListItem>();

	const hasMore = results.length > limit;
	const items = hasMore ? results.slice(0, limit) : results;

	/*
	 * 総数を別に数える。
	 * 読み込めた分だけで数えると、続きを読むたびに見出しの件数が増えていく。
	 */
	const { results: totals } = await db
		.prepare(
			`SELECT p.release_year_month AS yearMonth, count(*) AS count
			 FROM products p JOIN makers m ON m.id = p.maker_id
			 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
			 GROUP BY p.release_year_month`
		)
		.bind(...binds)
		.all<{ yearMonth: string | null; count: number }>();
	const countOf = new Map(totals.map((row) => [row.yearMonth, row.count]));

	// 価格順は月が飛び飛びに並ぶ。月で切ると1件だけの見出しが延々と続くため、ひとまとめにする
	if (sort.startsWith('price')) {
		const heading = sort === 'price-asc' ? '価格が安い順' : '価格が高い順';
		const total = totals.reduce((sum, row) => sum + row.count, 0);
		const groups = items.length > 0 ? [{ yearMonth: null, items, count: total, heading }] : [];
		return { groups, total: items.length, hasMore };
	}

	const groups: MonthGroup[] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (last && last.yearMonth === item.yearMonth) last.items.push(item);
		else
			groups.push({
				yearMonth: item.yearMonth,
				items: [item],
				count: countOf.get(item.yearMonth) ?? 0
			});
	}
	return { groups, total: items.length, hasMore };
}

/**
 * 指定した月以前を年ごとにまとめた件数。新しい年から順に返す
 *
 * 過去は 185 ヶ月あり、月をそのまま並べると一覧にならない。まず年を選ばせる。
 */
export async function listYearCounts(db: D1Database, untilYearMonth: string): Promise<YearCount[]> {
	const { results } = await db
		.prepare(
			`SELECT substr(release_year_month, 1, 4) AS year, count(*) AS count
			 FROM products
			 WHERE release_year_month IS NOT NULL AND release_year_month <= ?
			 GROUP BY year ORDER BY year DESC`
		)
		.bind(untilYearMonth)
		.all<YearCount>();
	return results;
}

/** ヒーローに出す件数。今月の新作の数と掲載の全体数 */
export async function countProducts(
	db: D1Database,
	yearMonth: string
): Promise<{ thisMonth: number; total: number }> {
	const row = await db
		.prepare(
			`SELECT (SELECT count(*) FROM products WHERE release_year_month = ?) AS thisMonth,
			        count(*) AS total
			 FROM products`
		)
		.bind(yearMonth)
		.first<{ thisMonth: number; total: number }>();
	return row ?? { thisMonth: 0, total: 0 };
}

/*
 * LIKE のパターンが長いと D1 が「pattern too complex」で落ちる。上限は 50 バイト。
 * 文字数で切ると絵文字などで超えるため、エスケープ後のバイト数で測る。
 */
const LIKE_PATTERN_MAX_BYTES = 48;

/** 末尾を削り、LIKE のパターンとして収まる長さにする */
export function fitToLikePattern(value: string): string {
	const encoder = new TextEncoder();
	let fitted = value;
	while (fitted && encoder.encode(escapeLike(fitted)).length > LIKE_PATTERN_MAX_BYTES) {
		fitted = [...fitted].slice(0, -1).join('');
	}
	return fitted;
}

/** シリーズ判定に使う商品名の頭。最初の語から末尾の数字を落とす */
function seriesPrefix(name: string): string | null {
	const token = name.split(/\s+/)[0] ?? '';
	const prefix = fitToLikePattern(token.replace(/[0-9０-９]+$/, ''));
	return prefix.length >= 2 ? prefix : null;
}

/** 名前の頭が同じ商品。シリーズの前作・続編を新しい順に返す */
export async function listSeriesProducts(
	db: D1Database,
	product: ProductListItem
): Promise<ProductListItem[]> {
	const prefix = seriesPrefix(product.name);
	if (!prefix) return [];
	const { results } = await db
		.prepare(
			`${SELECT_ITEM} WHERE p.id != ? AND p.name LIKE ? ESCAPE '\\'
			 ORDER BY p.release_year_month DESC LIMIT 6`
		)
		.bind(product.id, `${escapeLike(prefix)}%`)
		.all<ProductListItem>();
	return results;
}

/** 商品1件と、そのラインナップ */
export async function getProduct(db: D1Database, id: number): Promise<ProductDetail | null> {
	const product = await db
		.prepare(`${SELECT_ITEM} WHERE p.id = ?`)
		.bind(id)
		.first<ProductListItem>();
	if (!product) return null;

	const { results: variants } = await db
		.prepare(
			`SELECT name, is_secret AS isSecret FROM variants
			 WHERE product_id = ? ORDER BY display_order`
		)
		.bind(id)
		.all<Variant>();
	return { ...product, variants };
}
