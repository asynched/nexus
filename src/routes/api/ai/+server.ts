import { z } from 'zod';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { AI_STREAM_ERROR, AI_TIMEOUT_ERROR, type AiUIMessage } from '#lib/ai.ts';
import { AI_ENABLED, SEARXNG_URL, SEARXNG_EXTRA_ENGINES } from '$app/env/private';
import { getAiConfig } from '#lib/server/ai-config.ts';
import { streamSearchAnswer } from '#lib/server/ai-search.ts';
import { aiLimiter } from '#lib/server/ai-limit.ts';
import { readFilters, allowed, languageOptions, safeOptions } from '#lib/filters.ts';
import type { SearchInput } from '#lib/server/searxng.ts';
import type { RequestHandler } from './$types';

const schema = z
	.object({ mode: z.enum(['summary', 'agent']), search: z.string().max(4000) })
	.strict();
const reply = (body: unknown, status = 200) =>
	Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) }
	});

async function readBody(request: Request) {
	if (!request.headers.get('content-type')?.startsWith('application/json'))
		throw new Error('Invalid body');
	const reader = request.body?.getReader();
	if (!reader) throw new Error('Missing body');
	let text = '';
	let size = 0;
	const decoder = new TextDecoder();
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 8192) {
				await reader.cancel();
				throw new Error('Body too large');
			}
			text += decoder.decode(value, { stream: true });
		}
		return schema.parse(JSON.parse(text + decoder.decode()));
	} finally {
		reader.releaseLock();
	}
}

export const POST: RequestHandler = async ({ request, url, cookies, fetch, getClientAddress }) => {
	// Paid inference is opt-in and never happens on a GET, SSR render, or cross-origin request.
	if (request.headers.get('origin') !== url.origin)
		return reply({ error: 'Origem da requisição não permitida.' }, 403);
	if (AI_ENABLED !== 'true') return reply({ error: 'A IA está desativada nesta instalação.' }, 503);
	let body: z.infer<typeof schema>;
	try {
		body = await readBody(request);
	} catch {
		return reply({ error: 'Informe uma pesquisa válida.' }, 400);
	}
	const params = new URLSearchParams(body.search);
	const q = (params.get('q') || '').trim();
	if (!q || q.length > 500)
		return reply({ error: 'Informe uma pesquisa com até 500 caracteres.' }, 400);
	const category = params.get('category') || 'general';
	if (category !== 'general' && category !== 'news')
		return reply({ error: 'A IA está disponível para Tudo e Notícias.' }, 400);
	let config: ReturnType<typeof getAiConfig>;
	try {
		config = getAiConfig();
	} catch {
		return reply({ error: 'A IA não está disponível nesta instalação.' }, 503);
	}
	if (body.mode === 'agent' && !config.agent)
		return reply({ error: 'A pesquisa com agente está desativada.' }, 503);
	const release = aiLimiter.acquire(getClientAddress());
	if (!release)
		return reply(
			{ error: 'Limite de IA atingido. Aguarde um minuto antes de tentar novamente.' },
			429
		);
	const deadline = AbortSignal.timeout(60000);
	const disconnected = new AbortController();
	let released = false;
	const releaseOnce = () => {
		if (!released) {
			released = true;
			release();
		}
	};
	try {
		let session = cookies.get('nexus-ai-session');
		if (!session || !/^[a-f0-9-]{36}$/i.test(session)) {
			session = crypto.randomUUID();
			cookies.set('nexus-ai-session', session, {
				path: '/api/ai',
				httpOnly: true,
				sameSite: 'strict',
				secure: url.protocol === 'https:',
				maxAge: 1800
			});
		}
		const preferences = {
			language: allowed(cookies.get('language'), languageOptions, 'all'),
			safe: allowed(cookies.get('safesearch'), safeOptions, '1')
		};
		const input: SearchInput = {
			q,
			category,
			page:
				body.mode === 'agent'
					? 1
					: Math.min(100, Math.max(1, Math.floor(Number(params.get('pageno')) || 1))),
			filters: readFilters(params, preferences, category)
		};
		const stream = createUIMessageStream<AiUIMessage>({
			execute: async ({ writer }) => {
				writer.write({ type: 'start' });
				try {
					await streamSearchAnswer({
						mode: body.mode,
						input,
						connection: { url: SEARXNG_URL, extraEngines: SEARXNG_EXTRA_ENGINES },
						config,
						fetcher: fetch,
						session,
						onChunk: (chunk) => writer.write(chunk),
						signal: AbortSignal.any([request.signal, deadline, disconnected.signal])
					});
					writer.write({ type: 'finish' });
				} finally {
					releaseOnce();
				}
			},
			// SDK errors may contain provider bodies/credentials. Send only fixed messages.
			onError: () => (deadline.aborted ? AI_TIMEOUT_ERROR : AI_STREAM_ERROR)
		});
		const reader = stream.getReader();
		const cancellable = new ReadableStream({
			async pull(controller) {
				const { value, done } = await reader.read();
				if (done) controller.close();
				else controller.enqueue(value);
			},
			async cancel() {
				disconnected.abort();
				await reader.cancel();
			}
		});
		return createUIMessageStreamResponse({
			stream: cancellable,
			keepAliveMs: 10000,
			headers: { 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' }
		});
	} catch {
		disconnected.abort();
		releaseOnce();
		if (request.signal.aborted) return reply({ error: 'Pesquisa cancelada.' }, 499);
		if (deadline.aborted) return reply({ error: 'A IA demorou demais. Tente novamente.' }, 504);
		// SDK errors can contain API keys, headers and provider bodies. Never log or serialize them.
		return reply({ error: AI_STREAM_ERROR }, 502);
	}
};
