import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamSearchAnswer } from './ai-search.ts';
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
) => {
	const base = {
		id: 'chatcmpl-test',
		object: 'chat.completion.chunk',
		created: 1,
		model: config.model
	};
	return new Response(
		[
			{
				...base,
				choices: [
					{
						index: 0,
						delta: {
							role: 'assistant',
							content,
							...(calls ? { tool_calls: calls.map((call, index) => ({ ...call, index })) } : {})
						},
						finish_reason: null
					}
				]
			},
			{
				...base,
				choices: [{ index: 0, delta: {}, finish_reason: calls ? 'tool_calls' : 'stop' }],
				usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
			}
		]
			.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
			.join('') + 'data: [DONE]\n\n',
		{ headers: { 'Content-Type': 'text/event-stream' } }
	);
};
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
		const answer = await streamSearchAnswer({ ...options(), mode: 'summary' });
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
		expect(body.stream).toBe(true);
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
		const answer = await streamSearchAnswer({ ...opts, mode: 'agent' });
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
		const answer = await streamSearchAnswer({ ...opts, mode: 'agent' });
		expect(opts.fetcher).toHaveBeenCalledTimes(3);
		expect(answer.searches).toBe(3);
		expect(answer.sources).toHaveLength(1);
		expect(JSON.parse(modelFetch.mock.calls[1][1].body).tool_choice).toBe('none');
	});
	it('does not call a model or invent a summary when search has no evidence', async () => {
		const modelFetch = vi.fn();
		vi.stubGlobal('fetch', modelFetch);
		await expect(
			streamSearchAnswer({
				...options(),
				mode: 'summary',
				fetcher: vi.fn().mockResolvedValue(Response.json({ results: [] }))
			})
		).rejects.toThrow('No search evidence');
		expect(modelFetch).not.toHaveBeenCalled();
	});
	it('emits source metadata and text before the provider closes, excluding reasoning', async () => {
		let send!: (value: unknown) => void;
		let close!: () => void;
		const response = new Response(
			new ReadableStream({
				start(controller) {
					send = (value) =>
						controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`));
					close = () => controller.close();
				}
			}),
			{ headers: { 'Content-Type': 'text/event-stream' } }
		);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
		const onChunk = vi.fn();
		let finished = false;
		const answer = streamSearchAnswer({ ...options(), mode: 'summary', onChunk }).then((value) => {
			finished = true;
			return value;
		});
		send({
			choices: [
				{
					index: 0,
					delta: { reasoning_content: 'private reasoning', content: 'Primeiro trecho [' },
					finish_reason: null
				}
			]
		});
		await vi.waitFor(() =>
			expect(onChunk).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'text-delta', delta: 'Primeiro trecho [' })
			)
		);
		expect(finished).toBe(false);
		expect(onChunk.mock.calls[0][0]).toMatchObject({
			type: 'data-evidence',
			data: { sources: [{ id: 1 }], complete: false }
		});
		expect(JSON.stringify(onChunk.mock.calls)).not.toContain('private reasoning');
		send({ choices: [{ index: 0, delta: { content: '1].' }, finish_reason: null }] });
		send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
		close();
		expect((await answer).text).toBe('Primeiro trecho [1].');
		expect(onChunk.mock.calls.at(-1)?.[0]).toMatchObject({
			type: 'data-evidence',
			data: { complete: true }
		});
	});
	it('replaces intermediate agent narration with the last answer instead of concatenating it', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValueOnce(completion('Narrativa antes de fontes', [call('one')]))
				.mockResolvedValueOnce(completion('Vou verificar mais.', [call('two', 'call-2')]))
				.mockResolvedValueOnce(completion('Conclusão final [1].'))
		);
		const onChunk = vi.fn();
		const answer = await streamSearchAnswer({ ...options(), mode: 'agent', onChunk });
		expect(answer.text).toBe('Conclusão final [1].');
		expect(JSON.stringify(onChunk.mock.calls)).not.toContain('Narrativa antes de fontes');
		expect(onChunk.mock.calls.filter(([part]) => part.type === 'text-start')).toHaveLength(2);
	});
	it('does not mark an abruptly closed provider stream as a complete answer', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(
					new Response(
						`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Trecho interrompido' }, finish_reason: null }] })}\n\n`,
						{ headers: { 'Content-Type': 'text/event-stream' } }
					)
				)
		);
		const onChunk = vi.fn();
		await expect(streamSearchAnswer({ ...options(), mode: 'summary', onChunk })).rejects.toThrow();
		expect(
			onChunk.mock.calls.some(([part]) => part.type === 'data-evidence' && part.data.complete)
		).toBe(false);
	});
});
