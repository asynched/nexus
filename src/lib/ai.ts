export type AiMode = 'summary' | 'agent';
export type AiSource = { id: number; title: string; url: string; domain: string };
export type AiAnswer = { text: string; sources: AiSource[]; searches: number; partial: boolean };

/** Only turn numeric references into links; generated HTML/Markdown is never executed. */
export function citationParts(text: string, sources: AiSource[]) {
	const byId = new Map(sources.map((source) => [source.id, source]));
	return text.split(/(\[\d{1,3}\])/g).map((text) => ({
		text,
		source: /^\[\d{1,3}\]$/.test(text) ? byId.get(Number(text.slice(1, -1))) : undefined
	}));
}
