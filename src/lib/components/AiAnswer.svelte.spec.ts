import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AiAnswer from './AiAnswer.svelte';
import { createUIMessageStreamResponse, type InferUIMessageChunk } from 'ai';
import { AI_STREAM_ERROR, type AiUIMessage, type AiAnswer as Answer } from '#lib/ai.ts';

function answerResponse(answer: Answer) {
	return createUIMessageStreamResponse({
		stream: new ReadableStream<InferUIMessageChunk<AiUIMessage>>({
			start(controller) {
				for (const chunk of [
					{ type: 'start' },
					{
						type: 'data-evidence',
						id: 'evidence',
						data: {
							sources: answer.sources,
							searches: answer.searches,
							partial: answer.partial,
							complete: false
						}
					},
					{ type: 'text-start', id: 'text' },
					{ type: 'text-delta', id: 'text', delta: answer.text },
					{ type: 'text-end', id: 'text' },
					{
						type: 'data-evidence',
						id: 'evidence',
						data: {
							sources: answer.sources,
							searches: answer.searches,
							partial: answer.partial,
							complete: true
						}
					},
					{ type: 'finish' }
				] satisfies InferUIMessageChunk<AiUIMessage>[])
					controller.enqueue(chunk);
				controller.close();
			}
		})
	});
}

afterEach(() => vi.unstubAllGlobals());

describe('opt-in AI search interface', () => {
	it('does not call AI on render; links only real citations and escapes generated HTML', async () => {
		const request = vi.fn().mockResolvedValue(
			answerResponse({
				text: 'Resposta [1]. <img src=x onerror=alert(1)> [99]',
				searches: 1,
				partial: false,
				sources: [
					{ id: 1, title: 'Documentação', url: 'https://svelte.dev/docs', domain: 'svelte.dev' }
				]
			})
		);
		vi.stubGlobal('fetch', request);
		render(AiAnswer, { search: 'q=SvelteKit', agentEnabled: true });
		expect(request).not.toHaveBeenCalled();
		await page.getByRole('button', { name: 'Resumir com IA' }).click();
		await expect.element(page.getByRole('heading', { name: 'Resumo com IA' })).toBeVisible();
		await expect
			.element(page.getByRole('link', { name: 'Fonte 1: Documentação' }))
			.toHaveAttribute('href', 'https://svelte.dev/docs');
		await expect
			.element(page.getByText('<img src=x onerror=alert(1)>', { exact: false }))
			.toBeVisible();
		expect(document.querySelector('.ai-text img')).toBeNull();
		expect(request).toHaveBeenCalledTimes(1);
		expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
			mode: 'summary',
			search: 'q=SvelteKit'
		});
	});
	it('offers an agent that calls the dedicated mode and displays its research count', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				answerResponse({
					text: 'Conclusão [1].',
					searches: 2,
					partial: true,
					sources: [{ id: 1, title: 'Fonte', url: 'https://example.com', domain: 'example.com' }]
				})
			)
		);
		render(AiAnswer, { search: 'q=pesquisa', agentEnabled: true });
		await page.getByRole('button', { name: 'Pesquisar com agente' }).click();
		await expect.element(page.getByRole('heading', { name: 'Pesquisa com agente' })).toBeVisible();
		await expect.element(page.getByText('2 buscas realizadas.', { exact: false })).toBeVisible();
		await expect
			.element(page.getByText('Algumas fontes não responderam.', { exact: false }))
			.toBeVisible();
	});
	it('hides the agent when disabled and shows safe failures without breaking search', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(Response.json({ error: 'A IA não está disponível.' }, { status: 503 }))
		);
		render(AiAnswer, { search: 'q=test', agentEnabled: false });
		await expect
			.element(page.getByRole('button', { name: 'Pesquisar com agente' }))
			.not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Resumir com IA' }).click();
		await expect.element(page.getByRole('alert')).toHaveTextContent('A IA não está disponível.');
		await page.getByRole('button', { name: 'Fechar resposta da IA' }).click();
		await expect.element(page.getByRole('alert')).not.toBeInTheDocument();
	});
	it('cancels an in-flight request without displaying a stale response', async () => {
		let signal: AbortSignal | undefined;
		let resolve: (response: Response) => void = () => {};
		vi.stubGlobal(
			'fetch',
			vi.fn((_url, init) => {
				signal = init.signal;
				return new Promise<Response>((done) => {
					resolve = done;
				});
			})
		);
		render(AiAnswer, { search: 'q=test', agentEnabled: true });
		await page.getByRole('button', { name: 'Resumir com IA' }).click();
		await expect.element(page.getByRole('status')).toBeVisible();
		await vi.waitFor(() => expect(signal).toBeDefined());
		await page.getByRole('button', { name: 'Cancelar IA' }).click();
		expect(signal?.aborted).toBe(true);
		resolve(answerResponse({ text: 'Stale answer', sources: [], searches: 1, partial: false }));
		await expect
			.element(page.getByRole('heading', { name: 'Resumo com IA' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
	it('renders tokens and split citations before the response is finished', async () => {
		let send!: (chunk: InferUIMessageChunk<AiUIMessage>) => void;
		let close!: () => void;
		const stream = new ReadableStream<InferUIMessageChunk<AiUIMessage>>({
			start(controller) {
				send = (chunk) => controller.enqueue(chunk);
				close = () => controller.close();
			}
		});
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createUIMessageStreamResponse({ stream })));
		render(AiAnswer, { search: 'q=test', agentEnabled: true });
		await page.getByRole('button', { name: 'Resumir com IA' }).click();
		const evidence = {
			sources: [{ id: 1, title: 'Fonte', url: 'https://example.com', domain: 'example.com' }],
			searches: 1,
			partial: false,
			complete: false
		};
		send({ type: 'start' });
		send({ type: 'data-evidence', id: 'evidence', data: evidence });
		send({ type: 'text-start', id: 'text' });
		send({ type: 'text-delta', id: 'text', delta: 'Resposta parcial [' });
		await expect.element(page.getByText('Resposta parcial [', { exact: true })).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Cancelar IA' })).toBeVisible();
		await expect.element(page.getByText('Resposta em andamento.', { exact: false })).toBeVisible();
		send({ type: 'text-delta', id: 'text', delta: '1].' });
		await expect.element(page.getByRole('link', { name: 'Fonte 1: Fonte' })).toBeVisible();
		send({ type: 'text-end', id: 'text' });
		send({ type: 'data-evidence', id: 'evidence', data: { ...evidence, complete: true } });
		send({ type: 'finish' });
		close();
		await expect.element(page.getByRole('button', { name: 'Resumir com IA' })).toBeEnabled();
	});
	it.each(['provider-error', 'truncated'])(
		'keeps partial text visibly incomplete after %s',
		async (failure) => {
			const stream = new ReadableStream<InferUIMessageChunk<AiUIMessage>>({
				start(controller) {
					controller.enqueue({ type: 'start' });
					controller.enqueue({
						type: 'data-evidence',
						id: 'evidence',
						data: { sources: [], searches: 1, partial: false, complete: false }
					});
					controller.enqueue({ type: 'text-start', id: 'text' });
					controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Texto incompleto' });
					if (failure === 'provider-error')
						controller.enqueue({ type: 'error', errorText: AI_STREAM_ERROR });
					controller.close();
				}
			});
			vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createUIMessageStreamResponse({ stream })));
			render(AiAnswer, { search: 'q=test', agentEnabled: true });
			await page.getByRole('button', { name: 'Resumir com IA' }).click();
			await expect.element(page.getByRole('alert')).toBeVisible();
			await expect.element(page.getByText('Texto incompleto', { exact: true })).toBeVisible();
			await expect.element(page.getByText('Resposta incompleta.', { exact: false })).toBeVisible();
		}
	);
});
