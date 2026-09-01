import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '$lib/common/testing/d1';
import { getProduct, listMakers, listProducts } from '../queries.server';

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

	it('発売月で絞り込み、未定だけも出せる', async () => {
		await seed({ name: '9月', yearMonth: '2026-09' });
		await seed({ name: '10月', yearMonth: '2026-10' });
		await seed({ name: '未定', yearMonth: null });

		expect(await names({ yearMonths: ['2026-09'] })).toEqual(['9月']);
		expect(await names({ yearMonths: [], tbdOnly: true })).toEqual(['未定']);
	});

	it('メーカーで絞り込める', async () => {
		await seed({ name: '奇譚', makerCode: 'kitan' });
		await seed({ name: 'ターリン', makerCode: 'tarlin' });

		expect(await names({ yearMonths: [], makerCode: 'tarlin' })).toEqual(['ターリン']);
	});
});

describe('listProducts の並び', () => {
	it('月ごとにまとまり、未定が最後', async () => {
		await seed({ name: '10月', yearMonth: '2026-10' });
		await seed({ name: '未定', yearMonth: null });
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

		expect(await names({ yearMonths: [], sort: 'price' })).toEqual(['安い', '高い', '未定']);
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

describe('listMakers', () => {
	it('商品を持つメーカーだけ返す', async () => {
		await seed({ makerCode: 'kitan' });
		await seed({ makerCode: 'qualia' });

		const makers = await listMakers(db);
		expect(makers.map((maker) => maker.code)).toEqual(['kitan', 'qualia']);
	});
});
