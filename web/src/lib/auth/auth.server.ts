import { betterAuth } from 'better-auth';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';

/*
 * リクエストごとに作る。D1 のバインディングはリクエストの中でしか取れない。
 * テーブル名は既存の呼び方に寄せる。id は INTEGER のまま使う
 */
export function createAuth(env: App.Platform['env']) {
	return betterAuth({
		database: env.DB,
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,

		emailAndPassword: {
			enabled: true,
			// 確認が済むまでログインさせない。他人のアドレスで登録したものを動かさないため
			requireEmailVerification: true,
			revokeSessionsOnPasswordReset: true,
			resetPasswordTokenExpiresIn: 60 * 60
		},
		emailVerification: {
			sendOnSignUp: true,
			expiresIn: 60 * 60 * 24
		},

		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID,
				clientSecret: env.GOOGLE_CLIENT_SECRET
			}
		},
		account: {
			modelName: 'user_identities',
			// アクセストークンを平文で置かない
			encryptOAuthTokens: true,
			accountLinking: {
				enabled: true,
				// 確認済みのメールでだけ繋ぐ。未確認だと他人のアドレスを名乗れる
				trustedProviders: ['google'],
				allowDifferentEmails: false
			}
		},

		user: {
			modelName: 'users',
			additionalFields: {
				xHandle: { type: 'string', required: false, input: false },
				icalToken: { type: 'string', required: false, input: false },
				agreedTermsVersion: { type: 'string', required: false },
				// 退会の印。Better Auth は見ないので、弾くのは自分でやる
				deletedAt: { type: 'date', required: false, input: false }
			}
		},
		session: {
			modelName: 'sessions',
			expiresIn: 60 * 60 * 24 * 7,
			updateAge: 60 * 60 * 24
		},
		verification: {
			modelName: 'auth_tokens',
			// 確認とリセットのトークンはハッシュで持つ
			storeIdentifier: 'hashed'
		},

		advanced: {
			database: { generateId: 'serial' }
		},

		// 必ず最後に置く
		plugins: [sveltekitCookies(getRequestEvent)]
	});
}

export type Auth = ReturnType<typeof createAuth>;
