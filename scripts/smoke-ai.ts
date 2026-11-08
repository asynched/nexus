import { strict as assert } from 'node:assert';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Real production server + AI SDK + tool loop. Only the external services are simulated.
const secret = 'nexus-ai-smoke-private-token';
let modelCalls = 0;
let searchCalls = 0;
let failProvider = false;
const sessions = new Set<string>();
const upstream = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === '/search') {
			searchCalls++;
			return Response.json({
				results: [
					{
						title: 'SvelteKit — documentação',
						url: 'https://svelte.dev/docs/kit',
						content: 'SvelteKit é um framework para criar aplicações web com Svelte.',
						engines: ['bing', 'yahoo']
					}
				]
			});
		}
		if (url.pathname !== '/v1/chat/completions') return new Response(null, { status: 404 });
		modelCalls++;
		assert.equal(request.headers.get('authorization'), `Bearer ${secret}`);
		assert.equal(request.headers.get('user-agent'), 'nexus/0.0.1');
		const session = request.headers.get('x-opencode-session');
		assert(session);
		sessions.add(session);
		const body = await request.json();
		assert.equal(body.model, 'deepseek-v4.1-flash');
		assert(!JSON.stringify(body).includes(secret));
		if (failProvider)
			return Response.json(
				{ error: { message: `Provider error with secret ${secret}` } },
				{ status: 400 }
			);
		const toolResults = body.messages.filter(
			(message: { role: string }) => message.role === 'tool'
		).length;
		const callTool = body.tools && body.tool_choice !== 'none' && toolResults < 2;
		return Response.json({
			id: `test-${modelCalls}`,
			object: 'chat.completion',
			created: 1,
			model: body.model,
			choices: [
				{
					index: 0,
					message: callTool
						? {
								role: 'assistant',
								content: null,
								tool_calls: [
									{
										id: `tool-${modelCalls}`,
										type: 'function',
										function: {
											name: 'searchWeb',
											arguments: JSON.stringify({
												query: toolResults
													? 'SvelteKit documentação oficial'
													: 'SvelteKit framework'
											})
										}
									}
								]
							}
						: {
								role: 'assistant',
								content:
									'SvelteKit permite criar aplicações web com Svelte [1]. Confira a documentação oficial.'
							},
					finish_reason: callTool ? 'tool_calls' : 'stop'
				}
			],
			usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 }
		});
	}
});

let server: ReturnType<typeof Bun.spawn> | undefined;
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function start(enabled: boolean) {
	server = Bun.spawn(['bun', './build'], {
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '0',
			PROTOCOL_HEADER: 'x-forwarded-proto',
			SEARXNG_URL: `http://127.0.0.1:${upstream.port}/`,
			AI_ENABLED: String(enabled),
			AI_AGENT_ENABLED: 'true',
			AI_API_KEY: secret,
			AI_BASE_URL: `http://127.0.0.1:${upstream.port}/v1`,
			AI_MODEL: 'deepseek-v4.1-flash',
			AI_MAX_STEPS: '4',
			AI_MAX_OUTPUT_TOKENS: '1800'
		},
		stdout: 'pipe',
		stderr: 'inherit'
	});
	const output = server.stdout;
	assert(output && typeof output !== 'number');
	const reader = output.getReader();
	const timer = setTimeout(() => server?.kill(), 20000);
	try {
		let text = '';
		while (true) {
			const chunk = await reader.read();
			assert(!chunk.done, 'Production server exited before listening');
			text += new TextDecoder().decode(chunk.value);
			const match = text.match(/Listening on (http:\/\/[^\s]+)/);
			if (match) return new URL(match[1]).origin;
		}
	} finally {
		clearTimeout(timer);
		reader.releaseLock();
	}
}
async function stop() {
	if (server) {
		server.kill('SIGTERM');
		await server.exited;
		server = undefined;
	}
}

try {
	const origin = await start(true);
	browser = await chromium.launch();
	const context = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-proto': 'http' } });
	const page = await context.newPage();
	const clientErrors: string[] = [];
	page.on('pageerror', (error) => clientErrors.push(error.message));
	page.on('request', (request) =>
		assert(!request.url().includes(`:${upstream.port}/v1`), 'Browser must never contact the model')
	);
	await page.goto(`${origin}/?q=SvelteKit`);
	assert.equal(modelCalls, 0, 'GET/SSR must not spend inference budget');
	assert(!(await page.content()).includes(secret));
	await page.getByRole('button', { name: 'Resumir com IA' }).click();
	await page.getByRole('heading', { name: 'Resumo com IA' }).waitFor();
	assert.equal(modelCalls, 1);
	assert.equal(
		await page
			.getByRole('link', { name: 'Fonte 1: SvelteKit — documentação' })
			.getAttribute('href'),
		'https://svelte.dev/docs/kit'
	);
	await page.getByRole('button', { name: 'Pesquisar com agente' }).click();
	await page.getByRole('heading', { name: 'Pesquisa com agente' }).waitFor();
	await expect(page.locator('.ai-footnote')).toContainText('2 buscas realizadas');
	assert.equal(modelCalls, 4, 'Agent should execute two searches and a final model response');
	assert.equal(sessions.size, 1, 'Summary and agent must reuse a stable server-only session ID');
	const cookies = await context.cookies();
	assert(cookies.find((cookie) => cookie.name === 'nexus-ai-session')?.httpOnly);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 390, height: 844 });
	assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	await page.locator('.ai-response').scrollIntoViewIfNeeded();
	assert.deepEqual(
		(await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id),
		[]
	);
	await page.screenshot({
		path: 'test-results/ai-agent-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.screenshot({
		path: 'test-results/ai-agent-desktop.png',
		fullPage: true,
		animations: 'disabled'
	});
	await page.goto(origin);
	await page.getByRole('searchbox').fill('SvelteKit');
	await page.getByRole('button', { name: 'Pesquisar com agente' }).click();
	await page.getByRole('heading', { name: 'Pesquisa com agente' }).waitFor();
	await expect(page.locator('.ai-footnote')).toContainText('2 buscas realizadas');
	failProvider = true;
	await page.getByRole('button', { name: 'Resumir com IA' }).click();
	await page.getByRole('alert').waitFor();
	assert(!(await page.content()).includes(secret));
	assert(
		(await page.getByRole('alert').textContent())?.includes('A busca comum continua disponível')
	);
	assert.equal(await page.locator('.search-result').count(), 1);
	const forbidden = await fetch(`${origin}/api/ai`, {
		method: 'POST',
		headers: {
			Origin: 'https://other.example',
			'Content-Type': 'application/json',
			'x-forwarded-proto': 'http'
		},
		body: JSON.stringify({ mode: 'summary', search: 'q=test' })
	});
	assert.equal(forbidden.status, 403);
	const beforeDisabled = modelCalls;
	await stop();
	const disabledOrigin = await start(false);
	await page.goto(`${disabledOrigin}/?q=SvelteKit`);
	assert.equal(await page.getByRole('button', { name: 'Resumir com IA' }).count(), 0);
	const disabled = await fetch(`${disabledOrigin}/api/ai`, {
		method: 'POST',
		headers: {
			Origin: disabledOrigin,
			'Content-Type': 'application/json',
			'x-forwarded-proto': 'http'
		},
		body: JSON.stringify({ mode: 'summary', search: 'q=test' })
	});
	assert.equal(disabled.status, 503);
	assert.equal(modelCalls, beforeDisabled);
	for await (const file of new Bun.Glob('**/*.js').scan('build/client')) {
		const contents = await Bun.file(`build/client/${file}`).text();
		assert(!contents.includes(secret));
		assert(
			!contents.includes('opencode.ai/inference/go'),
			'Provider config must not be bundled for the browser'
		);
	}
	assert.deepEqual(clientErrors, []);
	console.log(
		JSON.stringify(
			{
				summary: 'passed',
				agentToolLoop: 'passed',
				homeAgentSearch: 'passed',
				privateConfig: 'server-only',
				disabled: disabled.status,
				crossOrigin: forbidden.status,
				providerErrorsRedacted: true,
				mobileAndAccessibility: 'passed',
				modelCalls,
				searchCalls
			},
			null,
			2
		)
	);
} finally {
	await browser?.close();
	await stop();
	upstream.stop(true);
}
