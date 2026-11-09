import type { UIMessage } from 'ai';

export type AiMode = 'summary' | 'agent';
export type AiSource = { id: number; title: string; url: string; domain: string };
export type AiAnswer = { text: string; sources: AiSource[]; searches: number; partial: boolean };
export type AiEvidence = Omit<AiAnswer, 'text'> & { complete: boolean };
export type AiUIMessage = UIMessage<unknown, { evidence: AiEvidence }>;
export const AI_STREAM_ERROR =
	'Não foi possível gerar uma resposta com fontes. A busca comum continua disponível.';
export const AI_INTERRUPTED_ERROR =
	'A transmissão foi interrompida. A resposta pode estar incompleta; tente novamente.';
export const AI_TIMEOUT_ERROR =
	'A IA demorou demais. A resposta pode estar incompleta; tente novamente.';

/** Only turn numeric references into links; generated HTML/Markdown is never executed. */
export function citationParts(text: string, sources: AiSource[]) {
	const byId = new Map(sources.map((source) => [source.id, source]));
	return text.split(/(\[\d{1,3}\])/g).map((text) => ({
		text,
		source: /^\[\d{1,3}\]$/.test(text) ? byId.get(Number(text.slice(1, -1))) : undefined
	}));
}
