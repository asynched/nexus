import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateSearchAnswer } from './ai-search.ts';
import { defaultFilters } from '#lib/filters.ts';

const config = {
	apiKey: 'test-only-private-token',
	baseURL: 'https://model.example/v1',
	model: 'deepseek-v4.1-flash',
	maxSteps: 4,
	maxOutputTokens: 1800,
	agent: true
};
const input = {
	q: 'SvelteKit',
	category: 'general' as const,
	page: 1,
	filters: defaultFilters({ language: 'pt-BR', safe: '2' })
};
const completion = (
	content: string | null,
	calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
) =>
	Response.json({
		id: 'chatcmpl-test',
		object: 'chat.completion',
		created: 1,
		model: config.model,
		choices: [
			{
				index: 0,
				message: { role: 'assistant', content, ...(calls ? { tool_calls: calls } : {}) },
				finish_reason: calls ? 'tool_calls' : 'stop'
			}
		],
		usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
	});
const call = (query: string, id = 'call-1') => ({
	id,
	type: 'function',
	function: { name: 'searchWeb', arguments: JSON.stringify({ query }) }
});
const upstream = () =>
	vi.fn().mockImplementation(() =>
		Promise.resolve(
			Response.json({
				results: [
					{
						title: 'SvelteKit docs',
						url: 'https://svelte.dev/docs/kit',
						content: 'SvelteKit builds web apps.',
						engines: ['bing']
					}
				],
				unresponsive_engines: [['google', 'access denied']]
			})
		)
	);
const options = () => ({
	input,
	config,
	connection: { url: 'https://search.example/', extraEngines: 'bing,yahoo' },
	signal: new AbortController().signal,
	session: 'test-session',
	fetcher: upstream()
});

afterEach(() => vi.unstubAllGlobals());

describe('AI SDK OpenAI-compatible search', () => {
	it('summarizes actual server-side evidence and keeps credentials out of prompts and output', async () => {
		const modelFetch = vi.fn().mockResolvedValue(completion('SvelteKit cria aplicações web [1].'));
		vi.stubGlobal('fetch', modelFetch);
		const answer = await generateSearchAnswer({ ...options(), mode: 'summary' });
		expect(answer).toMatchObject({
			text: 'SvelteKit cria aplicações web [1].',
			searches: 1,
			partial: true,
			sources: [{ id: 1, url: 'https://svelte.dev/docs/kit' }]
		});
		const [url, request] = modelFetch.mock.calls[0];
		expect(String(url)).toBe('https://model.example/v1/chat/completions');
		const headers = new Headers(request.headers);
		expect(headers.get('authorization')).toBe(`Bearer ${config.apiKey}`);
		expect(headers.get('user-agent')).toBe('nexus/0.0.1');
		expect(headers.get('x-opencode-session')).toBe('test-session');
		expect(request.redirect).toBe('error');
		const body = JSON.parse(request.body);
		expect(body.model).toBe(config.model);
		expect(body.messages.at(-1).content).toContain('SvelteKit builds web apps.');
		expect(request.body).not.toContain(config.apiKey);
		expect(JSON.stringify(answer)).not.toContain(config.apiKey);
	});
	it('executes a real tool-call round trip, retains filters, and produces source IDs', async () => {
		const modelFetch = vi
			.fn()
			.mockResolvedValueOnce(completion(null, [call('SvelteKit documentation')]))
			.mockResolvedValueOnce(completion('Resposta verificada [1].'));
		vi.stubGlobal('fetch', modelFetch);
		const opts = options();
		opts.input = { ...input, filters: { ...input.filters, engine: 'bing', site: 'svelte.dev' } };
		const answer = await generateSearchAnswer({ ...opts, mode: 'agent' });
		expect(modelFetch).toHaveBeenCalledTimes(2);
		expect(answer).toMatchObject({ text: 'Resposta verificada [1].', searches: 1 });
		const url = opts.fetcher.mock.calls[0][0] as URL;
		expect(url.searchParams.get('q')).toBe('SvelteKit documentation site:svelte.dev');
		expect(url.searchParams.get('engines')).toBe('bing');
		expect(url.searchParams.get('safesearch')).toBe('2');
		expect(url.searchParams.has('categories')).toBe(false);
		const nextBody = JSON.parse(modelFetch.mock.calls[1][1].body);
		expect(nextBody.messages.some((message: { role: string }) => message.role === 'tool')).toBe(
			true
		);
	});
	it('bounds parallel searches, deduplicates sources and forces a final response', async () => {
		const modelFetch = vi
			.fn()
			.mockResolvedValueOnce(
				completion(
					null,
					['one', 'two', 'three', 'four', 'one'].map((q, i) => call(q, `call-${i}`))
				)
			)
			.mockResolvedValueOnce(completion('Conclusão [1].'));
		vi.stubGlobal('fetch', modelFetch);
		const opts = options();
		const answer = await generateSearchAnswer({ ...opts, mode: 'agent' });
		expect(opts.fetcher).toHaveBeenCalledTimes(3);
		expect(answer.searches).toBe(3);
		expect(answer.sources).toHaveLength(1);
		expect(JSON.parse(modelFetch.mock.calls[1][1].body).tool_choice).toBe('none');
	});
	it('does not call a model or invent a summary when search has no evidence', async () => {
		const modelFetch = vi.fn();
		vi.stubGlobal('fetch', modelFetch);
		await expect(
			generateSearchAnswer({
				...options(),
				mode: 'summary',
				fetcher: vi.fn().mockResolvedValue(Response.json({ results: [] }))
			})
		).rejects.toThrow('No search evidence');
		expect(modelFetch).not.toHaveBeenCalled();
	});
});
