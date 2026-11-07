import { beforeEach, describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

const environment = vi.hoisted(() => ({}) as Record<string, string>);
vi.mock('$app/env/private', () => ({
	get SEARXNG_URL() {
		return environment.SEARXNG_URL;
	}
}));
beforeEach(() => {
	delete environment.SEARXNG_URL;
});

async function run(
	query: string,
	fetch = vi.fn().mockResolvedValue(Response.json({ results: [] })),
	preferences: Record<string, string> = {}
) {
	const event = {
		url: new URL(`http://localhost/${query}`),
		fetch,
		cookies: { get: (name: string) => preferences[name] }
	};
	return { result: await load(event as unknown as Parameters<typeof load>[0]), fetch };
}

describe('server-side SearXNG integration', () => {
	it('reads the server environment URL and preserves custom proxy paths', async () => {
		environment.SEARXNG_URL = 'http://searxng.internal:8080/private/search/';
		const { fetch } = await run('?q=nexus&category=news');
		const endpoint = fetch.mock.calls[0][0] as URL;
		expect(endpoint.origin).toBe('http://searxng.internal:8080');
		expect(endpoint.pathname).toBe('/private/search');
		expect(endpoint.searchParams.get('q')).toBe('nexus');
		expect(endpoint.searchParams.get('categories')).toBe('news');
	});
	it('reports invalid operator configuration without contacting an upstream or exposing its value', async () => {
		environment.SEARXNG_URL = 'https://user:secret@private.example.com/';
		const { result, fetch } = await run('?q=nexus');
		expect(fetch).not.toHaveBeenCalled();
		expect(result?.error).toContain('Verifique SEARXNG_URL');
		expect(JSON.stringify(result)).not.toContain('secret');
		expect(JSON.stringify(result)).not.toContain('private.example.com');
	});
	it('does not contact the service for an empty query', async () => {
		const { result, fetch } = await run('?q=%20%20');
		expect(fetch).not.toHaveBeenCalled();
		expect(result?.q).toBe('');
	});

	it('forwards categories, pagination, time and saved preferences', async () => {
		const { fetch } = await run('?q=svelte&category=images&pageno=2&time_range=week', undefined, {
			language: 'pt-BR',
			safesearch: '2'
		});
		const url = fetch.mock.calls[0][0] as URL;
		expect(url.origin).toBe('https://search.asynched.tech');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			q: 'svelte',
			categories: 'images',
			pageno: '2',
			time_range: 'week',
			language: 'pt-BR',
			safesearch: '2',
			format: 'json'
		});
	});

	it('validates unsupported parameters and limits pagination', async () => {
		const { result } = await run(
			'?q=svelte&category=invalid&pageno=200&time_range=forever',
			undefined,
			{ language: 'unknown', safesearch: '10' }
		);
		expect(result).toMatchObject({
			category: 'general',
			page: 100,
			time: '',
			language: 'all',
			safe: '1'
		});
	});
	it('forwards per-search overrides and operators without modifying the displayed query', async () => {
		const { result, fetch } = await run(
			'?q=design&time_range=year&language=en-US&safesearch=2&engine=google&site=vercel.com&filetype=pdf',
			undefined,
			{ language: 'pt-BR', safesearch: '0' }
		);
		const url = fetch.mock.calls[0][0] as URL;
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			q: 'design site:vercel.com filetype:pdf',
			language: 'en-US',
			safesearch: '2',
			engines: 'google cse',
			time_range: 'year'
		});
		expect(url.searchParams.has('categories')).toBe(false);
		expect(result).toMatchObject({
			q: 'design',
			preferences: { language: 'pt-BR', safe: '0' },
			filters: { engine: 'google', site: 'vercel.com', filetype: 'pdf' }
		});
	});

	it('uses the correct engine for each non-web category', async () => {
		for (const [category, expected] of [
			['images', 'brave.images'],
			['videos', 'brave.videos'],
			['news', 'brave.news']
		]) {
			const { result, fetch } = await run(
				`?q=svelte&category=${category}&engine=brave&filetype=pdf`
			);
			expect((fetch.mock.calls[0][0] as URL).searchParams.get('engines')).toBe(expected);
			expect(result?.filters.filetype).toBe('');
		}
	});

	it('returns real results, suggestions and partial-service status', async () => {
		const fetch = vi.fn().mockResolvedValue(
			Response.json({
				results: [{ title: 'Svelte', url: 'https://svelte.dev/' }],
				suggestions: ['sveltekit', null],
				corrections: ['svelte'],
				unresponsive_engines: [['brave', 'timeout']]
			})
		);
		const { result } = await run('?q=svelte', fetch);
		expect(result?.results).toHaveLength(1);
		expect(result).toMatchObject({
			suggestions: ['sveltekit'],
			corrections: ['svelte'],
			partial: true,
			error: ''
		});
	});

	it.each(['network', 'http', 'malformed'])(
		'handles %s failures without crashing',
		async (failure) => {
			const fetch =
				failure === 'network'
					? vi.fn().mockRejectedValue(new Error('offline'))
					: vi
							.fn()
							.mockResolvedValue(
								failure === 'http'
									? new Response('', { status: 503 })
									: Response.json({ unexpected: true })
							);
			const { result } = await run('?q=svelte', fetch);
			expect(result?.error).toContain('não respondeu');
			expect(result?.results).toEqual([]);
		}
	);
});
