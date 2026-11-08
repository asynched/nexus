import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	SEARXNG_URL: {
		public: false,
		static: false,
		schema: (value) => value?.trim() || undefined,
		description: 'Server-only SearXNG base URL. Defaults to https://search.asynched.tech/.'
	},
	SEARXNG_EXTRA_ENGINES: {
		public: false,
		static: false,
		schema: (value) => (value === undefined ? 'bing,yahoo' : value.trim()),
		description: 'Additional engines for unfiltered general searches. Empty disables additions.'
	}
});
