import {
	AI_ENABLED,
	AI_AGENT_ENABLED,
	AI_API_KEY,
	AI_BASE_URL,
	AI_MODEL,
	AI_MAX_STEPS,
	AI_MAX_OUTPUT_TOKENS
} from '$app/env/private';

export class AiUnavailableError extends Error {
	constructor() {
		super('A IA não está disponível nesta instalação.');
	}
}

export function getAiConfig() {
	if (AI_ENABLED !== 'true' || !AI_API_KEY) throw new AiUnavailableError();
	try {
		const url = new URL(AI_BASE_URL);
		const maxSteps = Number(AI_MAX_STEPS);
		const maxOutputTokens = Number(AI_MAX_OUTPUT_TOKENS);
		if (
			!['http:', 'https:'].includes(url.protocol) ||
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			(url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) ||
			!AI_MODEL ||
			!Number.isInteger(maxSteps) ||
			maxSteps < 2 ||
			maxSteps > 6 ||
			!Number.isInteger(maxOutputTokens) ||
			maxOutputTokens < 128 ||
			maxOutputTokens > 4096
		) {
			throw new AiUnavailableError();
		}
		return {
			apiKey: AI_API_KEY,
			baseURL: url.href.replace(/\/$/, ''),
			model: AI_MODEL,
			maxSteps,
			maxOutputTokens,
			agent: AI_AGENT_ENABLED === 'true'
		};
	} catch {
		throw new AiUnavailableError();
	}
}

/** These booleans are the only configuration exposed to the browser. */
export function aiAvailability() {
	try {
		return { summary: true, agent: getAiConfig().agent };
	} catch {
		return { summary: false, agent: false };
	}
}
