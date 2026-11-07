import { describe, expect, it, vi } from 'vitest';
import { GET } from './+server';

async function request(
	domain: string,
	fetch = vi
		.fn()
		.mockResolvedValue(
			new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } })
		)
) {
	const event = {
		url: new URL(`http://localhost/favicon?domain=${encodeURIComponent(domain)}`),
		fetch
	};
	return { response: await GET(event as unknown as Parameters<typeof GET>[0]), fetch };
}

describe('cached favicon proxy', () => {
	it('fetches only the fixed provider, caches icons and sends no browser credentials', async () => {
		const { response, fetch } = await request('favicon-test.example.com');
		expect(response.status).toBe(200);
		expect(response.headers.get('Content-Type')).toBe('image/png');
		expect(response.headers.get('Cache-Control')).toContain('86400');
		const [url, options] = fetch.mock.calls[0];
		expect(url.origin).toBe('https://www.google.com');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			domain: 'favicon-test.example.com',
			sz: '64'
		});
		expect(options.credentials).toBe('omit');
		const second = await request('favicon-test.example.com');
		expect(second.fetch).not.toHaveBeenCalled();
		expect(second.response.status).toBe(200);
	});
	it('rejects arbitrary hosts, IP addresses and URL injection before any fetch', async () => {
		for (const domain of [
			'localhost',
			'127.0.0.1',
			'evil.com/path',
			'user@evil.com',
			'evil.com?url=http://localhost'
		]) {
			const { response, fetch } = await request(domain);
			expect(response.status).toBe(400);
			expect(fetch).not.toHaveBeenCalled();
		}
	});
	it('returns a cacheable fallback status on network failure', async () => {
		const { response } = await request(
			'offline.example.com',
			vi.fn().mockRejectedValue(new Error('offline'))
		);
		expect(response.status).toBe(404);
		expect(response.headers.get('Cache-Control')).toContain('300');
	});
	it('rejects active content and oversized payloads', async () => {
		const svg = await request(
			'svg.example.com',
			vi
				.fn()
				.mockResolvedValue(new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }))
		);
		expect(svg.response.status).toBe(404);
		const large = await request(
			'large.example.com',
			vi
				.fn()
				.mockResolvedValue(
					new Response(new Uint8Array(70000), { headers: { 'Content-Type': 'image/png' } })
				)
		);
		expect(large.response.status).toBe(404);
	});
});
