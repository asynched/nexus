import { describe, expect, it } from 'vitest';
import { normalizeResults, safeUrl } from './search.ts';

describe('search response normalization', () => {
	it('only allows public web protocols', () => {
		expect(safeUrl('https://svelte.dev/docs')).toBe('https://svelte.dev/docs');
		for (const value of [
			'javascript:alert(1)',
			'data:text/html,test',
			'file:///etc/passwd',
			'//example.com',
			null
		]) {
			expect(safeUrl(value)).toBe('');
		}
	});

	it('handles missing or malformed results', () => {
		expect(normalizeResults(null)).toEqual([]);
		expect(normalizeResults([null, {}, { url: 'javascript:alert(1)' }])).toEqual([]);
	});

	it('normalizes content without interpreting HTML', () => {
		const [result] = normalizeResults([
			{
				url: 'https://www.example.com/docs/start',
				title: '<script>test</script>',
				content: '<b>text</b>',
				img_src: 'javascript:test',
				thumbnail: 'https://example.com/photo.jpg',
				engines: ['brave', 12]
			}
		]);
		expect(result).toMatchObject({
			domain: 'example.com',
			path: 'docs › start',
			title: '<script>test</script>',
			content: '<b>text</b>',
			image: 'https://example.com/photo.jpg',
			engines: ['brave']
		});
	});

	it('uses the domain as a missing title and has stable unique IDs', () => {
		const results = normalizeResults([
			{ url: 'https://example.com/' },
			{ url: 'https://example.com/' }
		]);
		expect(results[0].title).toBe('example.com');
		expect(results[0].path).toBe('');
		expect(results[0].id).not.toBe(results[1].id);
	});
});
