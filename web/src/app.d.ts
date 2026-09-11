// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Auth } from '$lib/auth/auth.server';

type Session = Awaited<ReturnType<Auth['api']['getSession']>>;

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** ログインしていなければ null */
			user: NonNullable<Session>['user'] | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database;
				BETTER_AUTH_URL: string;
				BETTER_AUTH_SECRET: string;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
			};
		}
	}
}

export {};
