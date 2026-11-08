import type { Category } from './search.ts';

export type Option = { value: string; label: string; description?: string };
export const timeOptions: Option[] = [
	{ value: '', label: 'Qualquer data' },
	{ value: 'day', label: 'Últimas 24 horas' },
	{ value: 'week', label: 'Última semana' },
	{ value: 'month', label: 'Último mês' },
	{ value: 'year', label: 'Último ano' }
];
export const languageOptions: Option[] = [
	{ value: 'all', label: 'Todos os idiomas' },
	{ value: 'pt-BR', label: 'Português (Brasil)' },
	{ value: 'pt-PT', label: 'Português (Portugal)' },
	{ value: 'en-US', label: 'English (US)' },
	{ value: 'es', label: 'Español' },
	{ value: 'fr', label: 'Français' },
	{ value: 'de', label: 'Deutsch' }
];
export const safeOptions: Option[] = [
	{ value: '0', label: 'Desativada', description: 'Não filtrar conteúdo explícito' },
	{ value: '1', label: 'Moderada', description: 'Equilíbrio entre proteção e resultados' },
	{ value: '2', label: 'Restrita', description: 'Filtro de conteúdo mais rigoroso' }
];
export const engineOptions: Option[] = [
	{ value: '', label: 'Todos os buscadores', description: 'Combine diferentes fontes' },
	{ value: 'brave', label: 'Brave' },
	{ value: 'duckduckgo', label: 'DuckDuckGo' },
	{ value: 'google', label: 'Google' },
	{ value: 'bing', label: 'Bing' }
];
export const fileOptions: Option[] = [
	{ value: '', label: 'Qualquer formato' },
	{ value: 'pdf', label: 'PDF', description: 'Documentos e publicações' },
	{ value: 'docx', label: 'Word (.docx)' },
	{ value: 'xlsx', label: 'Excel (.xlsx)' },
	{ value: 'pptx', label: 'PowerPoint (.pptx)' },
	{ value: 'txt', label: 'Texto (.txt)' }
];
export type SearchFilters = {
	time: string;
	language: string;
	safe: string;
	engine: string;
	site: string;
	filetype: string;
};
export type Preferences = Pick<SearchFilters, 'language' | 'safe'>;
export const defaultFilters = (preferences: Preferences): SearchFilters => ({
	time: '',
	engine: '',
	site: '',
	filetype: '',
	...preferences
});
export function allowed(
	value: string | null | undefined,
	options: Option[],
	fallback: string
): string {
	return options.some((option) => option.value === value) ? value! : fallback;
}
export function normalizeDomain(input: string): string {
	const value = input
		.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/\/$/, '')
		.toLowerCase();
	if (!value || /[\s/:@?#\\]/.test(value)) return '';
	try {
		const host = new URL(`https://${value}`).hostname;
		return host.length <= 253 &&
			/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
			? host
			: '';
	} catch {
		return '';
	}
}
export function readFilters(
	params: URLSearchParams,
	preferences: Preferences,
	category: Category
): SearchFilters {
	return {
		time: allowed(params.get('time_range'), timeOptions, ''),
		language: allowed(params.get('language'), languageOptions, preferences.language),
		safe: allowed(params.get('safesearch'), safeOptions, preferences.safe),
		engine: allowed(params.get('engine'), engineOptions, ''),
		site: normalizeDomain(params.get('site') || ''),
		filetype: category === 'general' ? allowed(params.get('filetype'), fileOptions, '') : ''
	};
}
export function filterParams(filters: SearchFilters, preferences?: Preferences): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (
			!value ||
			(key === 'language' && preferences?.language === value) ||
			(key === 'safe' && preferences?.safe === value)
		)
			continue;
		params.set(key === 'time' ? 'time_range' : key === 'safe' ? 'safesearch' : key, value);
	}
	return params;
}
export function engineName(engine: string, category: Category): string {
	if (!engine) return '';
	if (category === 'general') return engine === 'google' ? 'google,google cse' : engine;
	if (engine === 'google' && category === 'images') return 'google images,google cse images';
	return `${engine}${engine === 'brave' ? '.' : ' '}${category}`;
}
export function filteredQuery(q: string, filters: SearchFilters): string {
	return [
		q,
		filters.site && `site:${filters.site}`,
		filters.filetype && `filetype:${filters.filetype}`
	]
		.filter(Boolean)
		.join(' ');
}
export function filterChips(filters: SearchFilters, preferences: Preferences) {
	const groups = {
		time: timeOptions,
		language: languageOptions,
		safe: safeOptions,
		engine: engineOptions,
		filetype: fileOptions
	};
	return (Object.keys(filters) as (keyof SearchFilters)[]).flatMap((key) => {
		const value = filters[key];
		if (
			!value ||
			(key === 'language' && value === preferences.language) ||
			(key === 'safe' && value === preferences.safe)
		)
			return [];
		const label =
			key === 'site' ? value : groups[key].find((o) => o.value === value)?.label || value;
		return [{ key, label: key === 'safe' ? `Proteção: ${label.toLowerCase()}` : label }];
	});
}
