import { cp, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

// Reproduce the runtime image's file/dependency layout without requiring a Docker daemon.
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = await mkdtemp(
	join(process.env.NEXUS_TEST_TMP_DIR || tmpdir(), 'nexus-production-')
);
const received: URL[] = [];
const upstream = Bun.serve({
	port: 0,
	hostname: '127.0.0.1',
	fetch(request) {
		const url = new URL(request.url);
		received.push(url);
		return Response.json({
			results: [
				{
					title: 'Nexus production smoke test',
					url: 'https://example.com/nexus',
					content: 'Test response from the configured upstream.'
				}
			]
		});
	}
});
let server: ReturnType<typeof Bun.spawn> | undefined;
try {
	await Promise.all([
		copyFile(join(root, 'package.json'), join(directory, 'package.json')),
		copyFile(join(root, 'bun.lock'), join(directory, 'bun.lock')),
		cp(join(root, 'build'), join(directory, 'build'), { recursive: true })
	]);
	const install = Bun.spawn(
		['bun', 'install', '--production', '--frozen-lockfile', '--ignore-scripts'],
		{
			cwd: directory,
			env: { ...process.env, BUN_INSTALL_GLOBAL_STORE: '0' },
			stdout: 'inherit',
			stderr: 'inherit'
		}
	);
	assert.equal(await install.exited, 0, 'Production dependency installation failed');
	server = Bun.spawn(['bun', './build'], {
		cwd: directory,
		env: {
			...process.env,
			NODE_ENV: 'production',
			HOST: '127.0.0.1',
			PORT: '0',
			PROTOCOL_HEADER: 'x-forwarded-proto',
			SEARXNG_URL: `http://127.0.0.1:${upstream.port}/searxng/`
		},
		stdout: 'pipe',
		stderr: 'inherit'
	});
	const output = server.stdout;
	assert(output && typeof output !== 'number', 'Server stdout must be piped');
	const reader = output.getReader();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let origin: string;
	try {
		origin = await Promise.race([
			(async () => {
				let text = '';
				while (true) {
					const chunk = await reader.read();
					assert(!chunk.done, 'Server closed before listening');
					text += new TextDecoder().decode(chunk.value);
					const match = text.match(/Listening on (http:\/\/[^\s]+)/);
					if (match) return new URL(match[1]).origin;
				}
			})(),
			server.exited.then((code) => {
				throw new Error(`Server exited before startup (${code})`);
			}),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error('Production server startup timed out')), 20000);
			})
		]);
	} finally {
		clearTimeout(timer);
		reader.releaseLock();
	}
	const request = (path: string) =>
		fetch(new URL(path, origin), {
			headers: { 'x-forwarded-proto': 'http' },
			signal: AbortSignal.timeout(10000)
		});
	const health = await request('/healthz');
	assert.equal(health.status, 200);
	assert.equal(health.headers.get('cache-control'), 'no-store');
	assert.deepEqual(await health.json(), { status: 'ok' });
	assert.equal(received.length, 0, 'Health checks must not query the upstream');
	const home = await request('/');
	assert.equal(home.status, 200);
	const html = await home.text();
	assert(html.includes('nexus — A web, sem distrações.'));
	const image = await request('/brand/nexus-32.png');
	assert.equal(image.status, 200);
	assert(image.headers.get('content-type')?.includes('image/png'));
	const script = html.match(/(?:src|href)="([^"\s]*\/_app\/immutable\/[^"\s]+\.js)"/);
	assert(script, 'Rendered HTML must reference a built JavaScript asset');
	const asset = await request(script[1]);
	assert.equal(asset.status, 200);
	assert(asset.headers.get('cache-control')?.includes('immutable'));
	const search = await request('/?q=production-probe');
	assert.equal(search.status, 200);
	const results = await search.text();
	assert(results.includes('Nexus production smoke test'));
	assert.equal(received[0]?.pathname, '/searxng/search');
	assert.equal(received[0]?.searchParams.get('q'), 'production-probe');
	assert.equal(received[0]?.searchParams.get('format'), 'json');
	assert(!results.includes(`127.0.0.1:${upstream.port}`), 'The private upstream URL must not leak');
	console.log(
		JSON.stringify(
			{
				productionDependenciesOnly: true,
				health: health.status,
				ssr: home.status,
				staticAsset: image.status,
				immutableAsset: asset.status,
				search: search.status,
				configuredUpstream: received[0]?.pathname,
				privateUrlExposed: false
			},
			null,
			2
		)
	);
} finally {
	if (server) {
		server.kill('SIGTERM');
		await server.exited;
	}
	upstream.stop(true);
	await rm(directory, { recursive: true, force: true });
}
