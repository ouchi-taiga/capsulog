import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '$lib/common/testing/d1';
import {
	fitToLikePattern,
	getProduct,
	listMakers,
	listProducts,
	listSeriesProducts,
	listYearCounts
} from '../queries.server';

let db: D1Database;
let nextId = 1;

type Seed = {
	name?: string;
	makerCode?: string;
	price?: number | null;
	yearMonth?: string | null;
	precision?: string | null;
	detail?: string | null;
	variants?: { name: string; isSecret?: boolean }[];
};

/** 商品を1件入れて id を返す。指定しない列は妥当な既定値で埋める */
async function seed(overrides: Seed = {}): Promise<number> {
	const id = nextId++;
	await db
		.prepare(
			`INSERT INTO products
				(id, maker_id, source_id, name, price, release_year_month, release_precision,
				 release_detail, official_url, content_hash, fetched_at, created_at, updated_at)
			 VALUES (?, (SELECT id FROM makers WHERE code = ?), ?, ?, ?, ?, ?, ?, ?, '', '', '', '')`
		)
		.bind(
			id,
			overrides.makerCode ?? 'kitan',
			`s${id}`,
			overrides.name ?? `商品${id}`,
			overrides.price === undefined ? 300 : overrides.price,
			overrides.yearMonth === undefined ? '2026-09' : overrides.yearMonth,
			overrides.precision ?? null,
			overrides.detail ?? null,
			`https://example.com/${id}`
		)
		.run();
	for (const [index, variant] of (overrides.variants ?? []).entries()) {
		await db
			.prepare(
				'INSERT INTO variants (product_id, name, display_order, is_secret) VALUES (?, ?, ?, ?)'
			)
			.bind(id, variant.name, index, variant.isSecret ? 1 : 0)
			.run();
	}
	return id;
}

async function names(filters: Parameters<typeof listProducts>[1]): Promise<string[]> {
	const { groups } = await listProducts(db, filters);
	return groups.flatMap((group) => group.items.map((item) => item.name));
}

beforeEach(() => {
	db = createTestDb();
	nextId = 1;
});

describe('listProducts の絞り込み', () => {
	it('価格帯は 300 / 301〜499 / 500 で切る', async () => {
		await seed({ name: 'A', price: 300 });
		await seed({ name: 'B', price: 301 });
		await seed({ name: 'C', price: 499 });
		await seed({ name: 'D', price: 500 });
		await seed({ name: 'E', price: null });

		expect(await names({ yearMonths: [], priceBand: '300' })).toEqual(['A']);
		expect(await names({ yearMonths: [], priceBand: '400' })).toEqual(['B', 'C']);
		expect(await names({ yearMonths: [], priceBand: '500' })).toEqual(['D']);
	});

	it('キーワードの % と _ はリテラルとして扱う', async () => {
		await seed({ name: 'カニ100%' });
		await seed({ name: 'カニ100円' });
		await seed({ name: 'AB_C' });
		await seed({ name: 'ABXC' });

		expect(await names({ yearMonths: [], keyword: '100%' })).toEqual(['カニ100%']);
		expect(await names({ yearMonths: [], keyword: 'B_C' })).toEqual(['AB_C']);
	});

	it('発売月で絞り込み、不明だけも出せる', async () => {
		await seed({ name: '9月', yearMonth: '2026-09' });
		await seed({ name: '10月', yearMonth: '2026-10' });
		await seed({ name: '不明', yearMonth: null });

		expect(await names({ yearMonths: ['2026-09'] })).toEqual(['9月']);
		expect(await names({ yearMonths: [], unknownOnly: true })).toEqual(['不明']);
	});

	it('以降の指定は境界の月を含み、不明を含まない', async () => {
		await seed({ name: '10月', yearMonth: '2026-10' });
		await seed({ name: '11月', yearMonth: '2026-11' });
		await seed({ name: '12月', yearMonth: '2026-12' });
		await seed({ name: '不明', yearMonth: null });

		expect(await names({ yearMonths: [], fromYearMonth: '2026-11' })).toEqual(['11月', '12月']);
	});

	it('以前の指定は境界の月を含み、新しい月から順に返す', async () => {
		await seed({ name: '6月', yearMonth: '2026-06' });
		await seed({ name: '7月', yearMonth: '2026-07' });
		await seed({ name: '8月', yearMonth: '2026-08' });
		await seed({ name: '不明', yearMonth: null });

		expect(await names({ yearMonths: [], untilYearMonth: '2026-07' })).toEqual(['7月', '6月']);
	});

	it('メーカーで絞り込める', async () => {
		await seed({ name: '奇譚', makerCode: 'kitan' });
		await seed({ name: 'ターリン', makerCode: 'tarlin' });

		expect(await names({ yearMonths: [], makerCode: 'tarlin' })).toEqual(['ターリン']);
	});
});

describe('listProducts の並び', () => {
	it('月ごとにまとまり、不明が最後', async () => {
		await seed({ name: '10月', yearMonth: '2026-10' });
		await seed({ name: '不明', yearMonth: null });
		await seed({ name: '9月', yearMonth: '2026-09' });

		const { groups } = await listProducts(db, { yearMonths: [] });
		expect(groups.map((group) => group.yearMonth)).toEqual(['2026-09', '2026-10', null]);
	});

	it('月の中は 月まで → 上旬 → 中旬 → 下旬 の順で、週は日付で旬に換算する', async () => {
		await seed({ name: '下旬', precision: 'period', detail: 'late' });
		await seed({ name: '9/8週', precision: 'week', detail: '09-08' });
		await seed({ name: '月まで', precision: 'month' });
		await seed({ name: '上旬', precision: 'period', detail: 'early' });

		// 9/8 は (8+9)/10 = 1 で上旬と同格。名前順で「9/8週」が「上旬」の前
		expect(await names({ yearMonths: ['2026-09'] })).toEqual(['月まで', '9/8週', '上旬', '下旬']);
	});

	it('価格ソートは安い順で、価格未定が最後', async () => {
		await seed({ name: '高い', price: 500 });
		await seed({ name: '未定', price: null });
		await seed({ name: '安い', price: 200 });

		expect(await names({ yearMonths: [], sort: 'price-asc' })).toEqual(['安い', '高い', '未定']);
	});

	it('価格の高い順でも価格未定が最後', async () => {
		await seed({ name: '高い', price: 500 });
		await seed({ name: '未定', price: null });
		await seed({ name: '安い', price: 200 });

		expect(await names({ yearMonths: [], sort: 'price-desc' })).toEqual(['高い', '安い', '未定']);
	});

	it('発売が新しい順は月をさかのぼる', async () => {
		await seed({ name: '9月', yearMonth: '2026-09' });
		await seed({ name: '11月', yearMonth: '2026-11' });
		await seed({ name: '10月', yearMonth: '2026-10' });

		expect(await names({ yearMonths: [], sort: 'release-desc' })).toEqual(['11月', '10月', '9月']);
	});

	it('発売が新しい順では月の中も下旬から並ぶ', async () => {
		await seed({ name: '下旬', precision: 'period', detail: 'late' });
		await seed({ name: '月まで', precision: 'month' });
		await seed({ name: '上旬', precision: 'period', detail: 'early' });

		expect(await names({ yearMonths: ['2026-09'], sort: 'release-desc' })).toEqual([
			'下旬',
			'上旬',
			'月まで'
		]);
	});

	it('明示した並び順は、過去をさかのぼる表示の既定より優先する', async () => {
		await seed({ name: '6月', yearMonth: '2026-06' });
		await seed({ name: '7月', yearMonth: '2026-07' });

		// untilYearMonth の既定は新しい順。古い順を選んだらそちらが勝つ
		expect(await names({ yearMonths: [], untilYearMonth: '2026-07', sort: 'release-asc' })).toEqual(
			['6月', '7月']
		);
	});

	it('価格順は月をまたいで並べる', async () => {
		await seed({ name: '9月の高い', yearMonth: '2026-09', price: 500 });
		await seed({ name: '10月の安い', yearMonth: '2026-10', price: 200 });

		// 月を先に見ると月の中だけの価格順になり、全体の高安が出ない
		expect(await names({ yearMonths: [], sort: 'price-asc' })).toEqual(['10月の安い', '9月の高い']);
	});

	it('価格順は月ではなく価格で切る', async () => {
		await seed({ name: 'A', yearMonth: '2026-09', price: 200 });
		await seed({ name: 'B', yearMonth: '2026-10', price: 300 });
		await seed({ name: 'C', yearMonth: '2026-11', price: 300 });

		const { groups } = await listProducts(db, { yearMonths: [], sort: 'price-asc' });
		expect(groups.map((group) => group.heading)).toEqual(['¥200', '¥300']);
		// 見出しの件数は読み込めた分ではなく、その価格の総数
		expect(groups.map((group) => group.count)).toEqual([1, 2]);
		expect(groups[1]?.items).toHaveLength(2);
	});

	it('価格順で価格が無いものは価格不明にまとめる', async () => {
		await seed({ name: 'A', price: 200 });
		await seed({ name: 'B', price: null });

		const { groups } = await listProducts(db, { yearMonths: [], sort: 'price-asc' });
		expect(groups.map((group) => group.heading)).toEqual(['¥200', '価格不明']);
	});
});

describe('getProduct', () => {
	it('ラインナップを表示順で返す', async () => {
		const id = await seed({
			name: '本体',
			variants: [{ name: '1番' }, { name: '2番' }, { name: 'ヒミツ', isSecret: true }]
		});

		const product = await getProduct(db, id);
		expect(product?.name).toBe('本体');
		expect(product?.variants.map((variant) => variant.name)).toEqual(['1番', '2番', 'ヒミツ']);
		expect(product?.variants[2]?.isSecret).toBe(1);
	});

	it('存在しない id は null', async () => {
		expect(await getProduct(db, 9999)).toBeNull();
	});
});

describe('listSeriesProducts', () => {
	async function itemAt(id: number) {
		const product = await getProduct(db, id);
		if (!product) throw new Error(`product not found: ${id}`);
		return product;
	}

	it('名前の頭が同じ商品を新しい順に返す', async () => {
		const id = await seed({ name: '合掌する動物たち 第2弾', yearMonth: '2026-10' });
		await seed({ name: '合掌する動物たち', yearMonth: '2025-04' });
		await seed({ name: '合掌する動物たち 第3弾', yearMonth: '2026-12' });
		await seed({ name: '合掌ペンギン', yearMonth: '2026-10' });

		const series = await listSeriesProducts(db, await itemAt(id));
		expect(series.map((item) => item.name)).toEqual(['合掌する動物たち 第3弾', '合掌する動物たち']);
	});

	it('末尾の数字を無視して同名シリーズを拾う', async () => {
		const id = await seed({ name: 'トミカキーホルダー8' });
		await seed({ name: 'トミカキーホルダー7' });

		const series = await listSeriesProducts(db, await itemAt(id));
		expect(series.map((item) => item.name)).toEqual(['トミカキーホルダー7']);
	});

	it('名前が長くても引ける。D1 は LIKE のパターンが長いと落ちる', async () => {
		// 19文字。そのまま LIKE に渡すと 58 バイトで上限を超える
		const id = await seed({ name: 'ヒトツブカンロのグミッツェルマスコット３' });
		await seed({ name: 'ヒトツブカンロのグミッツェルマスコット２' });

		const series = await listSeriesProducts(db, await itemAt(id));
		expect(series.map((item) => item.name)).toEqual(['ヒトツブカンロのグミッツェルマスコット２']);
	});
});

describe('listProducts のページング', () => {
	/* 同じ月・同じ名前でも並びが決まることを確かめたいので、区別のつかない商品を入れる */
	async function seedMany(count: number): Promise<void> {
		for (let index = 0; index < count; index++) {
			await seed({ name: '同じ名前', yearMonth: '2026-09' });
		}
	}

	it('limit までで切り、続きがあることを伝える', async () => {
		await seedMany(5);

		const first = await listProducts(db, { yearMonths: [], limit: 3 });
		expect(first.total).toBe(3);
		expect(first.hasMore).toBe(true);
	});

	it('ちょうど limit 件なら続きはない', async () => {
		await seedMany(3);

		const result = await listProducts(db, { yearMonths: [], limit: 3 });
		expect(result.total).toBe(3);
		expect(result.hasMore).toBe(false);
	});

	it('月の件数は総数を返す。読み込めた分ではない', async () => {
		await seedMany(5);

		const { groups } = await listProducts(db, { yearMonths: [], limit: 3 });
		// 3件しか読めていなくても、その月には5件ある
		expect(groups[0]?.items).toHaveLength(3);
		expect(groups[0]?.count).toBe(5);
	});

	it('価格順の件数も総数を返す', async () => {
		await seedMany(5);

		const { groups } = await listProducts(db, { yearMonths: [], sort: 'price-asc', limit: 3 });
		expect(groups[0]?.items).toHaveLength(3);
		expect(groups[0]?.count).toBe(5);
	});

	it('絞り込みは月の件数にも効く', async () => {
		await seed({ yearMonth: '2026-09', makerCode: 'kitan' });
		await seed({ yearMonth: '2026-09', makerCode: 'tarlin' });

		const { groups } = await listProducts(db, { yearMonths: [], makerCode: 'kitan' });
		expect(groups[0]?.count).toBe(1);
	});

	it('offset で続きを取ると、重複も取りこぼしも出ない', async () => {
		await seedMany(7);

		const ids = async (offset: number) =>
			(await listProducts(db, { yearMonths: [], limit: 3, offset })).groups.flatMap((group) =>
				group.items.map((item) => item.id)
			);

		const page1 = await ids(0);
		const page2 = await ids(3);
		const page3 = await ids(6);
		const all = [...page1, ...page2, ...page3];

		// 並びが揺れると、読み進めたときに同じ商品が二度出たり抜けたりする
		expect(all).toHaveLength(7);
		expect(new Set(all).size).toBe(7);
	});

	it('offset が全体を超えたら空で返す', async () => {
		await seedMany(3);

		const result = await listProducts(db, { yearMonths: [], limit: 3, offset: 10 });
		expect(result.total).toBe(0);
		expect(result.hasMore).toBe(false);
	});
});

describe('listYearCounts', () => {
	it('年ごとにまとめ、新しい年から返す', async () => {
		await seed({ yearMonth: '2024-03' });
		await seed({ yearMonth: '2024-08' });
		await seed({ yearMonth: '2023-05' });
		await seed({ yearMonth: null });

		const years = await listYearCounts(db, '2026-09');
		expect(years.map((year) => [year.year, year.count])).toEqual([
			['2024', 2],
			['2023', 1]
		]);
	});

	it('今年までは載っていない月も 0 件で並べる', async () => {
		await seed({ yearMonth: '2024-03' });
		await seed({ yearMonth: '2024-08' });

		const [year] = await listYearCounts(db, '2026-09');
		// 掲載の前後は切る。3月から8月までが並ぶ
		expect(year?.months).toEqual([
			{ yearMonth: '2024-08', count: 1 },
			{ yearMonth: '2024-07', count: 0 },
			{ yearMonth: '2024-06', count: 0 },
			{ yearMonth: '2024-05', count: 0 },
			{ yearMonth: '2024-04', count: 0 },
			{ yearMonth: '2024-03', count: 1 }
		]);
	});

	it('来年以降は載っている月だけを出す', async () => {
		await seed({ yearMonth: '2026-09' });
		await seed({ yearMonth: '2027-02' });

		const years = await listYearCounts(db, '2026-09');
		// まだ発表されていないだけなので、0 件では並べない
		expect(years[0]).toEqual({
			year: '2027',
			count: 1,
			months: [{ yearMonth: '2027-02', count: 1 }]
		});
	});
});

describe('listProducts の年の絞り込み', () => {
	it('年で絞り、上限の月より後は出さない', async () => {
		await seed({ name: '7月', yearMonth: '2026-07' });
		await seed({ name: '9月', yearMonth: '2026-09' });
		await seed({ name: '前年', yearMonth: '2025-12' });

		// 年一覧の件数と、押した先の件数を合わせる
		expect(await names({ yearMonths: [], year: '2026', untilYearMonth: '2026-07' })).toEqual([
			'7月'
		]);
	});
});

describe('fitToLikePattern', () => {
	/* D1 の LIKE は 50 バイトが上限。エスケープ後の長さで測る */
	function patternBytes(value: string): number {
		const escaped = fitToLikePattern(value).replace(/[\\%_]/g, (character) => '\\' + character);
		return new TextEncoder().encode(escaped + '%').length;
	}

	it('短い名前はそのまま', () => {
		expect(fitToLikePattern('トミカ')).toBe('トミカ');
	});

	it('長い日本語を上限内に収める', () => {
		expect(patternBytes('ヒトツブカンロのグミッツェルマスコット')).toBeLessThanOrEqual(50);
	});

	it('4バイト文字が並んでも上限を超えない', () => {
		// 文字数で切ると 1文字4バイトで溢れる
		expect(patternBytes('🎉'.repeat(20))).toBeLessThanOrEqual(50);
	});

	it('エスケープで膨らむ記号が並んでも上限を超えない', () => {
		expect(patternBytes('%'.repeat(40))).toBeLessThanOrEqual(50);
	});

	it('4バイト文字を途中で割らない', () => {
		const fitted = fitToLikePattern('🎉'.repeat(20));
		expect(fitted).toBe('🎉'.repeat([...fitted].length));
	});
});

describe('listMakers', () => {
	it('商品を持つメーカーだけ返す', async () => {
		await seed({ makerCode: 'kitan' });
		await seed({ makerCode: 'qualia' });

		const makers = await listMakers(db);
		expect(makers.map((maker) => maker.code)).toEqual(['kitan', 'qualia']);
	});
});
