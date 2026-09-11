import type { Handle } from '@sveltejs/kit';
import { SESSION_COOKIE, findUserBySession, sessionCookieOptions } from '$lib/auth/session.server';

// SharedArrayBuffer を使えるようにする。切り抜きの WASM がマルチスレッドで動く
export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(SESSION_COOKIE);
	const session = token ? await findUserBySession(event.platform!.env.DB, token) : null;
	event.locals.user = session;

	if (token && !session) {
		event.cookies.delete(SESSION_COOKIE, { path: '/' });
	} else if (session?.renewedToken) {
		event.cookies.set(SESSION_COOKIE, session.renewedToken, sessionCookieOptions());
	}

	const response = await resolve(event);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};
