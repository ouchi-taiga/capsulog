export type Maker = {
	code: string;
	name: string;
};

export type ProductListItem = {
	id: number;
	name: string;
	price: number | null;
	yearMonth: string | null;
	precision: 'month' | 'period' | 'week' | null;
	detail: string | null;
	totalVariants: number | null;
	officialUrl: string;
	makerCode: string;
	makerName: string;
};

export type YearCount = {
	year: string;
	count: number;
	/** その年の月ごとの件数。商品のある月だけが新しい順に並ぶ */
	months: MonthCount[];
};

export type MonthCount = {
	yearMonth: string;
	count: number;
};

export type MonthGroup = {
	yearMonth: string | null;
	items: ProductListItem[];
	/** その月の総数。読み込めた件数ではない */
	count?: number;
	/** 見出しの文言。月で切らない並びのときに使う */
	heading?: string;
};

export type Variant = {
	name: string;
	isSecret: number;
};

export type ProductDetail = ProductListItem & {
	variants: Variant[];
};
