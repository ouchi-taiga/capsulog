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

export type MonthGroup = {
	yearMonth: string | null;
	items: ProductListItem[];
};

export type Variant = {
	name: string;
	isSecret: number;
};

export type ProductDetail = ProductListItem & {
	variants: Variant[];
};
