import { categories, normalizeResults, type Category } from '#lib/search.ts';
import type { PageServerLoad } from './$types';
import { SEARXNG_URL, SEARXNG_EXTRA_ENGINES } from '$app/env/private';
import { SearchConfigurationError } from '#lib/server/search-config.ts';
import { engineFailures } from '#lib/server/search-status.ts';
import { searchSearxng } from '#lib/server/searxng.ts';
import { aiAvailability } from '#lib/server/ai-config.ts';
import { allowed, languageOptions, safeOptions, readFilters } from '#lib/filters.ts';

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
		ai: aiAvailability(),
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
		const result = await searchSearxng(
			{ q, category, page, filters },
			{ url: SEARXNG_URL, extraEngines: SEARXNG_EXTRA_ENGINES },
			fetch
		);
		return {
			...base,
			...result,
			elapsed: (performance.now() - started) / 1000
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
