export type User = {
	id: number;
	email: string | null;
	displayName: string | null;
	xHandle: string | null;
	agreedTermsVersion: string | null;
};

/** ログイン手段。1人が複数持てる */
export type Provider = 'google' | 'password';
