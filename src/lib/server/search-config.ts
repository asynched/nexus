export const DEFAULT_SEARXNG_URL = 'https://search.asynched.tech/';

export class SearchConfigurationError extends Error {
	constructor() {
		super('SEARXNG_URL deve ser uma URL HTTP(S), sem credenciais, parâmetros ou fragmentos.');
		this.name = 'SearchConfigurationError';
	}
}

/** Operator-controlled configuration only. Never accept the upstream URL from a request. */
export function createSearchEndpoint(configuredUrl?: string): URL {
	try {
		const instance = new URL(configuredUrl?.trim() || DEFAULT_SEARXNG_URL);
		if (
			!['http:', 'https:'].includes(instance.protocol) ||
			instance.username ||
			instance.password ||
			instance.search ||
			instance.hash
		)
			throw new SearchConfigurationError();
		// Accept both a base URL and an explicit /search endpoint, including proxy prefixes.
		instance.pathname = instance.pathname.replace(/\/+$/, '').replace(/\/search$/, '') + '/';
		return new URL('search', instance);
	} catch {
		// Do not include the configured value: it could contain sensitive configuration.
		throw new SearchConfigurationError();
	}
}
