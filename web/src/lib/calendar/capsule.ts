/* カプセルの配色。商品 id を種にして商品ごとに固定の並びになる */

const COLORS = ['#f2766b', '#64bfae', '#8a92e3', '#e8a94f', '#e884b8', '#7cc0e8'];

export function capsuleColorAt(seed: number, index: number): string {
	return COLORS[(seed + index) % COLORS.length] ?? '#f2766b';
}
