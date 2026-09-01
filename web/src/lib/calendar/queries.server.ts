import type { Maker, MonthGroup, ProductDetail, ProductListItem, Variant } from './types';

export type ListFilters = {
	/** 絞り込む発売月。空配列は全期間 */
	yearMonths: string[];
	/** true なら発売月未定だけを出す */
	tbdOnly?: boolean;
	makerCode?: string;
	priceBand?: '300' | '400' | '500';
	keyword?: string;
	sort?: 'release' | 'price';
};

/** 1回で取る上限。超えたら「続きがある」として返す */
const PAGE_LIMIT = 300;

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

	if (filters.tbdOnly) {
		where.push('p.release_year_month IS NULL');
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
		binds.push(`%${filters.keyword.replace(/[\\%_]/g, (c) => '\\' + c)}%`);
	}

	const order =
		filters.sort === 'price' ? 'p.price IS NULL, p.price, p.name' : `${RELEASE_ORDER}, p.name`;
	const sql = `${SELECT_ITEM}
		${where.length ? 'WHERE ' + where.join(' AND ') : ''}
		ORDER BY p.release_year_month IS NULL, p.release_year_month, ${order}
		LIMIT ${PAGE_LIMIT + 1}`;

	const { results } = await db
		.prepare(sql)
		.bind(...binds)
		.all<ProductListItem>();

	const hasMore = results.length > PAGE_LIMIT;
	const items = hasMore ? results.slice(0, PAGE_LIMIT) : results;

	const groups: MonthGroup[] = [];
	for (const item of items) {
		const last = groups.at(-1);
		if (last && last.yearMonth === item.yearMonth) last.items.push(item);
		else groups.push({ yearMonth: item.yearMonth, items: [item] });
	}
	return { groups, total: items.length, hasMore };
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
