import { describe, expect, it } from 'vitest';
import {
	defaultFilters,
	normalizeDomain,
	readFilters,
	filterParams,
	filterChips,
	engineName,
	filteredQuery
} from './filters.ts';

const preferences = { language: 'all', safe: '1' };
describe('search filters', () => {
	it('normalizes domains without allowing query operators, credentials or paths', () => {
		expect(normalizeDomain('HTTPS://Svelte.DEV/')).toBe('svelte.dev');
		for (const input of [
			'localhost',
			'127.0.0.1',
			'x.com/path',
			'x.com:8080',
			'user@x.com',
			'x.com site:evil.com',
			'https://x.com?foo=bar'
		])
			expect(normalizeDomain(input)).toBe('');
	});
	it('round-trips every filter through the URL and counts active filters', () => {
		const filters = {
			time: 'month',
			language: 'pt-BR',
			safe: '2',
			engine: 'brave',
			site: 'svelte.dev',
			filetype: 'pdf'
		};
		expect(readFilters(filterParams(filters, preferences), preferences, 'general')).toEqual(
			filters
		);
		expect(filterChips(filters, preferences)).toHaveLength(6);
		expect(filterChips(defaultFilters(preferences), preferences)).toHaveLength(0);
	});
	it('rejects invalid values and omits file types outside web search', () => {
		const filters = readFilters(
			new URLSearchParams(
				'time_range=forever&language=bad&safesearch=9&engine=unknown&site=invalid&filetype=pdf'
			),
			preferences,
			'images'
		);
		expect(filters).toEqual(defaultFilters(preferences));
	});
	it('maps provider families to the real configured SearXNG engines', () => {
		expect(engineName('brave', 'images')).toBe('brave.images');
		expect(engineName('google', 'general')).toBe('google,google cse');
		expect(engineName('google', 'images')).toBe('google images,google cse images');
		expect(engineName('duckduckgo', 'news')).toBe('duckduckgo news');
		expect(engineName('bing', 'videos')).toBe('bing videos');
		expect(engineName('', 'general')).toBe('');
	});
	it('builds operators independently of the displayed search text', () => {
		expect(
			filteredQuery('design systems', {
				...defaultFilters(preferences),
				site: 'vercel.com',
				filetype: 'pdf'
			})
		).toBe('design systems site:vercel.com filetype:pdf');
	});
});
