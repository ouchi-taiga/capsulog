import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = platform?.env.DB;
	if (!db) {
		return { db: false, tables: [] };
	}

	// D1 に届いているかの確認。テーブルはまだ無い
	const { results } = await db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
		.all<{ name: string }>();

	return { db: true, tables: results.map((r) => r.name) };
};
