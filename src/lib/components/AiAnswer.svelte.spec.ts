import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import AiAnswer from './AiAnswer.svelte';

afterEach(() => vi.unstubAllGlobals());

describe('opt-in AI search interface', () => {
	it('does not call AI on render; links only real citations and escapes generated HTML', async () => {
		const request = vi.fn().mockResolvedValue(
			Response.json({
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
			vi
				.fn()
				.mockResolvedValue(
					Response.json({
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
		await page.getByRole('button', { name: 'Cancelar IA' }).click();
		expect(signal?.aborted).toBe(true);
		resolve(Response.json({ text: 'Stale answer', sources: [], searches: 1, partial: false }));
		await expect
			.element(page.getByRole('heading', { name: 'Resumo com IA' }))
			.not.toBeInTheDocument();
		await expect.element(page.getByRole('status')).not.toBeInTheDocument();
	});
});
