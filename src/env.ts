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
	},
	AI_ENABLED: { public: false, static: false, schema: (value) => value ?? 'false' },
	AI_AGENT_ENABLED: { public: false, static: false, schema: (value) => value ?? 'true' },
	AI_API_KEY: { public: false, static: false, schema: (value) => value?.trim() || undefined },
	AI_BASE_URL: {
		public: false,
		static: false,
		schema: (value) => value?.trim() || 'https://opencode.ai/inference/go/openai/v1'
	},
	AI_MODEL: {
		public: false,
		static: false,
		schema: (value) => value?.trim() || 'deepseek-v4.1-flash'
	},
	AI_MAX_STEPS: { public: false, static: false, schema: (value) => value ?? '4' },
	AI_MAX_OUTPUT_TOKENS: { public: false, static: false, schema: (value) => value ?? '1800' }
});
