export const categories = ['general', 'images', 'videos', 'news'] as const;
export type Category = (typeof categories)[number];

export type SearchResult = {
	id: string;
	title: string;
	url: string;
	domain: string;
	path: string;
	content: string;
	image: string;
	engines: string[];
	published: string;
};

export function safeUrl(value: unknown): string {
	if (typeof value !== 'string') return '';
	try {
		const url = new URL(value);
		return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
	} catch {
		return '';
	}
}

export function normalizeResults(input: unknown): SearchResult[] {
	if (!Array.isArray(input)) return [];
	return input.flatMap((item, index) => {
		if (!item || typeof item !== 'object') return [];
		const url = safeUrl(item.url);
		if (!url) return [];
		const parsed = new URL(url);
		return [
			{
				id: `${index}-${url}`,
				title: typeof item.title === 'string' ? item.title : parsed.hostname,
				url,
				domain: parsed.hostname.replace(/^www\./, ''),
				path: parsed.pathname === '/' ? '' : parsed.pathname.split('/').filter(Boolean).join(' › '),
				content: typeof item.content === 'string' ? item.content : '',
				image: safeUrl(item.thumbnail) || safeUrl(item.img_src),
				engines: Array.isArray(item.engines)
					? item.engines.filter((e: unknown) => typeof e === 'string')
					: [],
				published: typeof item.publishedDate === 'string' ? item.publishedDate : ''
			}
		];
	});
}
