import { categories, normalizeResults, type Category } from '#lib/search.ts';
import type { PageServerLoad } from './$types';
import { SEARXNG_URL, SEARXNG_EXTRA_ENGINES } from '$app/env/private';
import { createSearchEndpoint, SearchConfigurationError } from '#lib/server/search-config.ts';
import { engineFailures } from '#lib/server/search-status.ts';
import {
	allowed,
	languageOptions,
	safeOptions,
	readFilters,
	filteredQuery,
	engineName
} from '#lib/filters.ts';

export const load: PageServerLoad = async ({ url, fetch, cookies }) => {
	const q = (url.searchParams.get('q') || '').trim().slice(0, 500);
	const requestedCategory = url.searchParams.get('category') || 'general';
	const category: Category = categories.includes(requestedCategory as Category)
		? (requestedCategory as Category)
		: 'general';
	const page = Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get('pageno')) || 1)));
	const preferences = {
		language: allowed(cookies.get('language'), languageOptions, 'all'),
		safe: allowed(cookies.get('safesearch'), safeOptions, '1')
	};
	const filters = readFilters(url.searchParams, preferences, category);
	const { time, language, safe } = filters;
	const base = {
		q,
		category,
		page,
		time,
		language,
		safe,
		filters,
		preferences,
		results: [] as ReturnType<typeof normalizeResults>,
		suggestions: [] as string[],
		corrections: [] as string[],
		elapsed: 0,
		error: '',
		partial: false,
		engineFailures: [] as ReturnType<typeof engineFailures>
	};
	if (!q) return base;
	const started = performance.now();
	try {
		const endpoint = createSearchEndpoint(SEARXNG_URL);
		endpoint.search = new URLSearchParams({
			q: filteredQuery(q, filters),
			format: 'json',
			categories: category,
			pageno: String(page),
			language,
			safesearch: safe,
			time_range: time
		}).toString();
		const engine = engineName(filters.engine, category);
		if (engine) {
			// Categories add their default engines. An exclusive provider must use engines alone.
			endpoint.searchParams.delete('categories');
			endpoint.searchParams.set('engines', engine);
		} else if (category === 'general' && SEARXNG_EXTRA_ENGINES) {
			// SearXNG unions explicit engines with category defaults. Keep enabled sources,
			// but also query Bing/Yahoo, which are disabled by default on many instances.
			endpoint.searchParams.set('engines', SEARXNG_EXTRA_ENGINES);
		}
		const response = await fetch(endpoint, {
			signal: AbortSignal.timeout(20000),
			headers: { Accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`Search returned ${response.status}`);
		const body = await response.json();
		if (!Array.isArray(body.results)) throw new Error('Invalid search response');
		const failures = engineFailures(body.unresponsive_engines);
		return {
			...base,
			results: normalizeResults(body.results),
			suggestions: Array.isArray(body.suggestions)
				? body.suggestions.filter((s: unknown): s is string => typeof s === 'string').slice(0, 8)
				: [],
			corrections: Array.isArray(body.corrections)
				? body.corrections.filter((s: unknown): s is string => typeof s === 'string').slice(0, 3)
				: [],
			elapsed: (performance.now() - started) / 1000,
			partial: failures.length > 0,
			engineFailures: failures
		};
	} catch (error) {
		return {
			...base,
			error:
				error instanceof SearchConfigurationError
					? 'A instância de pesquisa não está configurada corretamente. Verifique SEARXNG_URL no servidor.'
					: 'O serviço de pesquisa não respondeu. Tente novamente em alguns instantes.'
		};
	}
};
