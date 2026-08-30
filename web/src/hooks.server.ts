import type { Handle } from '@sveltejs/kit';

// SharedArrayBuffer を使えるようにする。切り抜きの WASM がマルチスレッドで動く
export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
	return response;
};
