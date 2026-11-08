import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';

const mocks = vi.hoisted(() => ({
	enabled: 'true',
	agent: true,
	generate: vi.fn(),
	acquire: vi.fn(),
	release: vi.fn(),
	config: vi.fn()
}));
vi.mock('$app/env/private', () => ({
	get AI_ENABLED() {
		return mocks.enabled;
	},
	SEARXNG_URL: 'https://search.internal/',
	SEARXNG_EXTRA_ENGINES: 'bing,yahoo'
}));
vi.mock('#lib/server/ai-search.ts', () => ({ generateSearchAnswer: mocks.generate }));
vi.mock('#lib/server/ai-config.ts', () => ({ getAiConfig: mocks.config }));
vi.mock('#lib/server/ai-limit.ts', () => ({ aiLimiter: { acquire: mocks.acquire } }));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.enabled = 'true';
	mocks.agent = true;
	mocks.config.mockImplementation(() => ({ agent: mocks.agent, apiKey: 'private-test-key' }));
	mocks.acquire.mockReturnValue(mocks.release);
	mocks.generate.mockResolvedValue({
		text: 'Resposta [1].',
		sources: [{ id: 1, title: 'Source', url: 'https://example.com/', domain: 'example.com' }],
		searches: 1,
		partial: false
	});
});
async function run(
	body: unknown = { mode: 'summary', search: 'q=SvelteKit' },
	options: { origin?: string; type?: string; raw?: string; cookie?: string } = {}
) {
	const cookies = {
		get: vi.fn((name: string) => (name === 'nexus-ai-session' ? options.cookie : undefined)),
		set: vi.fn()
	};
	const request = new Request('https://nexus.example/api/ai', {
		method: 'POST',
		headers: {
			Origin: options.origin ?? 'https://nexus.example',
			'Content-Type': options.type ?? 'application/json'
		},
		body: options.raw ?? JSON.stringify(body)
	});
	const response = await POST({
		request,
		url: new URL(request.url),
		cookies,
		fetch: vi.fn(),
		getClientAddress: () => 'test-client'
	} as unknown as Parameters<typeof POST>[0]);
	return { response, cookies };
}

describe('private AI POST endpoint', () => {
	it('requires an explicit same-origin JSON request and never exposes server configuration', async () => {
		const { response, cookies } = await run();
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.text()).not.toContain('private-test-key');
		expect(cookies.set).toHaveBeenCalledWith(
			'nexus-ai-session',
			expect.any(String),
			expect.objectContaining({ httpOnly: true, sameSite: 'strict', secure: true })
		);
		expect(mocks.release).toHaveBeenCalledOnce();
	});
	it('reuses the provider conversation ID without putting it in prompts', async () => {
		await run(undefined, { cookie: '11111111-2222-3333-4444-555555555555' });
		expect(mocks.generate).toHaveBeenCalledWith(
			expect.objectContaining({ session: '11111111-2222-3333-4444-555555555555' })
		);
	});
	it('rejects cross-origin requests before spending any inference budget', async () => {
		const { response } = await run(undefined, { origin: 'https://attacker.example' });
		expect(response.status).toBe(403);
		expect(mocks.generate).not.toHaveBeenCalled();
		expect(mocks.acquire).not.toHaveBeenCalled();
	});
	it('disables AI completely when the server flag is off', async () => {
		mocks.enabled = 'false';
		expect((await run()).response.status).toBe(503);
		expect(mocks.generate).not.toHaveBeenCalled();
	});
	it('supports disabling only agent search', async () => {
		mocks.agent = false;
		expect((await run({ mode: 'agent', search: 'q=test' })).response.status).toBe(503);
		expect(mocks.generate).not.toHaveBeenCalled();
	});
	it.each([
		{ mode: 'unknown', search: 'q=test' },
		{ mode: 'summary', search: 'q=' },
		{ mode: 'summary', search: 'q=test&category=images' },
		{ mode: 'summary', search: `q=${'a'.repeat(501)}` },
		{ mode: 'summary', search: 'q=test', apiKey: 'client-supplied' }
	])('rejects invalid or client-controlled configuration', async (body) => {
		expect((await run(body)).response.status).toBe(400);
		expect(mocks.generate).not.toHaveBeenCalled();
	});
	it('bounds request bodies and rejects non-JSON requests', async () => {
		expect((await run(undefined, { raw: 'a'.repeat(8193) })).response.status).toBe(400);
		expect((await run(undefined, { type: 'text/plain' })).response.status).toBe(400);
	});
	it('returns a retry interval when rate-limited', async () => {
		mocks.acquire.mockReturnValue(undefined);
		const { response } = await run();
		expect(response.status).toBe(429);
		expect(response.headers.get('retry-after')).toBe('60');
		expect(mocks.generate).not.toHaveBeenCalled();
	});
	it('redacts SDK errors and releases concurrency on failure', async () => {
		mocks.generate.mockRejectedValue(
			new Error('Authorization: Bearer private-test-key at https://internal-provider/')
		);
		const { response } = await run();
		expect(response.status).toBe(502);
		const text = await response.text();
		expect(text).not.toContain('private-test-key');
		expect(text).not.toContain('internal-provider');
		expect(mocks.release).toHaveBeenCalledOnce();
	});
});
