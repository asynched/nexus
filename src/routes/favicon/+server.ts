import { normalizeDomain } from '#lib/filters.ts';
import type { RequestHandler } from './$types';

const cache = new Map<string, { bytes: ArrayBuffer; type: string; expires: number }>();
const pending = new Map<string, Promise<{ bytes: ArrayBuffer; type: string } | null>>();
const types = new Set([
	'image/png',
	'image/x-icon',
	'image/vnd.microsoft.icon',
	'image/jpeg',
	'image/gif',
	'image/webp'
]);

export const GET: RequestHandler = async ({ url, fetch }) => {
	const domain = normalizeDomain(url.searchParams.get('domain') || '');
	if (!domain) return new Response(null, { status: 400 });
	const cached = cache.get(domain);
	let image: { bytes: ArrayBuffer; type: string } | null =
		cached && cached.expires > Date.now() ? cached : null;
	if (!image) {
		let request = pending.get(domain);
		if (!request) {
			request = (async () => {
				try {
					// Only contact this fixed provider, never a user-supplied host.
					const endpoint = new URL('https://www.google.com/s2/favicons');
					endpoint.search = new URLSearchParams({ domain, sz: '64' }).toString();
					const response = await fetch(endpoint, {
						signal: AbortSignal.timeout(4500),
						credentials: 'omit'
					});
					const type = response.headers.get('content-type')?.split(';')[0] || '';
					if (
						!response.ok ||
						!types.has(type) ||
						Number(response.headers.get('content-length')) > 65536
					)
						return null;
					// Bound memory even when the provider does not send Content-Length.
					const reader = response.body?.getReader();
					if (!reader) return null;
					const chunks: Uint8Array[] = [];
					let length = 0;
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						length += value.length;
						if (length > 65536) {
							await reader.cancel();
							return null;
						}
						chunks.push(value);
					}
					if (!length) return null;
					const bytes = new Uint8Array(length);
					let offset = 0;
					for (const chunk of chunks) {
						bytes.set(chunk, offset);
						offset += chunk.length;
					}
					const result = { bytes: bytes.buffer, type };
					if (cache.size >= 256) cache.delete(cache.keys().next().value!);
					cache.set(domain, { ...result, expires: Date.now() + 86400000 });
					return result;
				} catch {
					return null;
				}
			})();
			pending.set(domain, request);
		}
		try {
			image = await request;
		} finally {
			pending.delete(domain);
		}
	}
	if (!image)
		return new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=300' } });
	return new Response(image.bytes, {
		headers: {
			'Content-Type': image.type,
			'Cache-Control': 'public, max-age=86400',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'"
		}
	});
};
