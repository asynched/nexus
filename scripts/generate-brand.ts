import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { brand } from '../src/lib/brand.ts';

const root = new URL('../', import.meta.url);
const output = new URL('static/brand/', root);
await mkdir(output, { recursive: true });
const svg = await readFile(new URL('static/favicon.svg', root), 'utf8');
const symbol = svg
	.replace(/<rect[^>]*\/>/, '')
	.replace('viewBox="0 0 48 48"', 'viewBox="12 14 24 20"');
const browser = await chromium.launch();
try {
	const context = await browser.newContext({ deviceScaleFactor: 1 });
	const page = await context.newPage();
	for (const [name, size, maskable] of [
		['nexus-16', 16, false],
		['nexus-32', 32, false],
		['nexus-apple-touch', 180, true],
		['nexus-192', 192, false],
		['nexus-512', 512, false],
		['nexus-maskable-512', 512, true]
	] as const) {
		await page.setViewportSize({ width: size, height: size });
		await page.setContent(
			`<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${maskable ? svg.replace('rx="12"', 'rx="0"') : svg}`
		);
		await page.screenshot({
			path: fileURLToPath(new URL(`${name}.png`, output)),
			omitBackground: true
		});
		console.log(`${name}.png — ${size}×${size}`);
	}
	const font = await readFile(
		fileURLToPath(
			import.meta.resolve('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
		)
	);
	await page.setViewportSize({ width: 1200, height: 630 });
	await page.setContent(`<!doctype html><html lang="pt-BR"><head><style>
		@font-face{font-family:Geist;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900}
		*{box-sizing:border-box}body{margin:0;background:${brand.colors.forest};color:${brand.colors.ivory};font-family:Geist,sans-serif;height:630px;display:flex;align-items:center;justify-content:center;flex-direction:column}
		.logo{display:flex;align-items:center;gap:32px}.logo svg{width:116px;height:116px}.name{font-size:148px;letter-spacing:-9px;font-weight:620;line-height:1.1}
		.tagline{font-size:30px;letter-spacing:-.5px;margin:24px 0 0;color:${brand.colors.lime}}
		.caption{position:absolute;bottom:54px;font-size:17px;color:#b5c5ae;letter-spacing:.1px}
	</style></head><body><div class="logo">${symbol}<span class="name">${brand.name}</span></div><p class="tagline">${brand.tagline}</p><span class="caption">Pesquisa independente. Movida por SearXNG.</span></body></html>`);
	await page.evaluate(() => document.fonts.ready);
	await page.screenshot({ path: fileURLToPath(new URL('nexus-social.png', output)) });
	console.log('nexus-social.png — 1200×630');
} finally {
	await browser.close();
}
