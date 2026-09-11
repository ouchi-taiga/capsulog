import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createAuth } from '$lib/auth/auth.server';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const auth = createAuth(event.platform!.env);
	const session = await auth.api.getSession({ headers: event.request.headers });

	// 退会したユーザーを弾く。Better Auth は deletedAt を見ない
	event.locals.user = session?.user.deletedAt ? null : (session?.user ?? null);

	const response = await svelteKitHandler({ event, resolve, auth, building });
	// SharedArrayBuffer を使えるようにする。切り抜きの WASM がマルチスレッドで動く
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};
