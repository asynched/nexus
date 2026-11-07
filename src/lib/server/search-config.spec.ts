import { describe, expect, it } from 'vitest';
import {
	createSearchEndpoint,
	DEFAULT_SEARXNG_URL,
	SearchConfigurationError
} from './search-config.ts';

describe('SearXNG URL configuration', () => {
	it.each([undefined, '', '  '])('uses the existing instance when the variable is %j', (value) => {
		expect(createSearchEndpoint(value).href).toBe(`${DEFAULT_SEARXNG_URL}search`);
	});
	it.each([
		['https://search.example.com', 'https://search.example.com/search'],
		['https://search.example.com/', 'https://search.example.com/search'],
		['https://search.example.com/searxng', 'https://search.example.com/searxng/search'],
		['https://search.example.com/searxng/', 'https://search.example.com/searxng/search'],
		['https://search.example.com/searxng/search', 'https://search.example.com/searxng/search'],
		['http://localhost:8080/search/', 'http://localhost:8080/search']
	])('resolves %s without dropping a proxy prefix or duplicating /search', (input, expected) => {
		expect(createSearchEndpoint(input).href).toBe(expected);
	});
	it.each([
		'invalid',
		'javascript:alert(1)',
		'file:///tmp/search',
		'ftp://example.com',
		'https://user:secret@example.com/',
		'https://example.com/?token=secret',
		'https://example.com/#fragment'
	])('rejects unsafe or ambiguous configuration without leaking it', (value) => {
		expect(() => createSearchEndpoint(value)).toThrow(SearchConfigurationError);
		try {
			createSearchEndpoint(value);
		} catch (error) {
			expect((error as Error).message).not.toContain(value);
			expect((error as Error).message).not.toContain('secret');
		}
	});
});
