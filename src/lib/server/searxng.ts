import { normalizeResults, type Category } from '#lib/search.ts';
import { engineName, filteredQuery, type SearchFilters } from '#lib/filters.ts';
import { createSearchEndpoint } from './search-config.ts';
import { engineFailures } from './search-status.ts';

export type SearchInput = { q: string; category: Category; page: number; filters: SearchFilters };
export type SearchConnection = { url?: string; extraEngines?: string };
export type SearchFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Shared by ordinary search and the agent. Only the operator controls the upstream URL. */
export async function searchSearxng(
	input: SearchInput,
	connection: SearchConnection,
	fetcher: SearchFetcher = fetch,
	signal?: AbortSignal
) {
	const endpoint = createSearchEndpoint(connection.url);
	endpoint.search = new URLSearchParams({
		q: filteredQuery(input.q, input.filters),
		format: 'json',
		categories: input.category,
		pageno: String(input.page),
		language: input.filters.language,
		safesearch: input.filters.safe,
		time_range: input.filters.time
	}).toString();
	const engine = engineName(input.filters.engine, input.category);
	if (engine) {
		endpoint.searchParams.delete('categories');
		endpoint.searchParams.set('engines', engine);
	} else if (input.category === 'general' && connection.extraEngines) {
		endpoint.searchParams.set('engines', connection.extraEngines);
	}
	const timeout = AbortSignal.timeout(20000);
	const response = await fetcher(endpoint, {
		signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
		headers: { Accept: 'application/json' }
	});
	if (!response.ok) throw new Error('Search service unavailable');
	const body = await response.json();
	if (!Array.isArray(body.results)) throw new Error('Invalid search response');
	const failures = engineFailures(body.unresponsive_engines);
	return {
		results: normalizeResults(body.results),
		suggestions: Array.isArray(body.suggestions)
			? body.suggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 8)
			: [],
		corrections: Array.isArray(body.corrections)
			? body.corrections.filter((s: unknown): s is string => typeof s === 'string').slice(0, 3)
			: [],
		partial: failures.length > 0,
		engineFailures: failures
	};
}
