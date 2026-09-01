import { error } from '@sveltejs/kit';
import { getProduct, listSeriesProducts } from '$lib/calendar/queries.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, params }) => {
	const db = platform?.env.DB;
	if (!db) error(500, 'D1 に接続できない');

	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, '商品が見つかりません');

	const product = await getProduct(db, id);
	if (!product) error(404, '商品が見つかりません');

	const series = await listSeriesProducts(db, product);
	return { product, series };
};
