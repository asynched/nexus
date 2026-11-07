import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

async function select(page: Page, label: string, option: string) {
	await page.getByRole('combobox', { name: label, exact: true }).click();
	await page.getByRole('option', { name: option, exact: false }).click();
}

async function audit(page: Page) {
	const focused = await page.evaluateHandle(() => document.activeElement);
	await page.evaluate(async () => {
		await Promise.all(
			document
				.getAnimations()
				.filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
				.map((animation) => animation.finished.catch(() => {}))
		);
	});
	const { violations } = await new AxeBuilder({ page }).analyze();
	await page.evaluate(() => {
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	});
	await focused.evaluate((element) => {
		if (element instanceof HTMLElement) element.focus({ preventScroll: true });
	});
	await focused.dispose();
	expect(
		violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))
	).toEqual([]);
}

test('nexus branding is consistent across the interface and metadata', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('nexus — A web, sem distrações.');
	await expect(page.getByRole('heading', { name: 'nexus', exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'nexus — início' })).toBeVisible();
	await expect(page.locator('.home-brand-mark .brand-mark')).toHaveCSS('height', '52px');
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^data:image\/svg\+xml,/);
	const favicon = decodeURIComponent(
		(await page.locator('link[rel="icon"]').getAttribute('href'))!.split(',')[1]
	);
	expect(favicon).toContain('<title>nexus</title>');
	expect(favicon).toContain('#173e35');
	await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'nexus');
	await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'nexus');
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
		'content',
		'nexus — A web, sem distrações.'
	);
	await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
		'content',
		/^http:\/\/localhost:4173\/brand\/nexus-social.png$/
	);
	await page.getByRole('button', { name: 'Sobre o projeto' }).click();
	await expect(page.getByRole('dialog').locator('.brand-name')).toHaveText('nexus');
	await expect(
		page.getByRole('dialog').getByText('nexus é uma interface independente', { exact: false })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Documentação do SearXNG' })).toHaveAttribute(
		'href',
		'https://docs.searxng.org/'
	);
});

test('app icons, social image and manifest are valid at every declared size', async ({ page }) => {
	await page.goto('/');
	const response = await page.request.get(new URL('/site.webmanifest', page.url()).href);
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest).toMatchObject({
		name: 'nexus',
		short_name: 'nexus',
		start_url: '/',
		theme_color: '#173e35'
	});
	expect(manifest.icons).toHaveLength(3);
	const assets = [
		{ src: '/brand/nexus-16.png', size: 16 },
		{ src: '/brand/nexus-32.png', size: 32 },
		{ src: '/brand/nexus-apple-touch.png', size: 180 },
		{ src: '/brand/nexus-192.png', size: 192 },
		{ src: '/brand/nexus-512.png', size: 512 },
		{ src: '/brand/nexus-maskable-512.png', size: 512 },
		{ src: '/brand/nexus-social.png', size: 1200, height: 630 }
	];
	for (const asset of assets) {
		const result = await page.evaluate(async (src) => {
			const image = new Image();
			image.src = src;
			await image.decode();
			const canvas = document.createElement('canvas');
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext('2d')!;
			context.drawImage(image, 0, 0);
			return {
				width: image.naturalWidth,
				height: image.naturalHeight,
				corner: Array.from(context.getImageData(0, 0, 1, 1).data)
			};
		}, asset.src);
		expect(result.width).toBe(asset.size);
		expect(result.height).toBe(asset.height || asset.size);
		if (asset.src.includes('maskable') || asset.src.includes('apple'))
			expect(result.corner).toEqual([23, 62, 53, 255]);
	}
});

test('home, keyboard shortcuts, category selection and theme persistence', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'nexus', exact: true })).toBeVisible();
	await expect(page).toHaveTitle('nexus — A web, sem distrações.');
	await page.keyboard.press('/');
	await expect(page.getByRole('searchbox')).toBeFocused();
	await page.getByRole('button', { name: 'Imagens', exact: true }).click();
	await expect(page.locator('input[name="category"]')).toHaveValue('images');
	await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await audit(page);
	await page.screenshot({
		path: 'test-results/home-dark.png',
		fullPage: true,
		animations: 'disabled'
	});
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('button', { name: 'Ativar tema claro' }).click();
	await audit(page);
	await page.screenshot({
		path: 'test-results/home-desktop.png',
		fullPage: true,
		animations: 'disabled'
	});
});

test('preferences are saved, cancellable and keyboard accessible', async ({ page, context }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Preferências', exact: true }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await audit(page);
	await page.screenshot({ path: 'test-results/preferences.png', animations: 'disabled' });
	await select(page, 'Idioma dos resultados', 'Português (Brasil)');
	await select(page, 'Pesquisa segura', 'Restrita');
	await page.getByRole('checkbox').check();
	await page.getByRole('button', { name: 'Salvar preferências' }).click();
	await expect(page.getByRole('dialog')).not.toBeVisible();
	const cookies = await context.cookies();
	expect(cookies.find((c) => c.name === 'language')?.value).toBe('pt-BR');
	expect(cookies.find((c) => c.name === 'safesearch')?.value).toBe('2');
	expect(cookies.find((c) => c.name === 'newtab')?.value).toBe('1');
	await page.getByRole('button', { name: 'Preferências', exact: true }).click();
	await page.getByRole('checkbox').uncheck();
	await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
	await page.getByRole('button', { name: 'Preferências', exact: true }).click();
	await expect(page.getByRole('checkbox')).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('mobile layout has no horizontal overflow and shows the privacy explanation', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await expect(page.getByRole('searchbox')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.screenshot({
		path: 'test-results/home-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
	await page.getByRole('button', { name: 'Privacidade', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Sobre seus dados' })).toBeVisible();
	await page.getByRole('button', { name: 'Fechar sobre o projeto' }).click();
	await page.getByRole('button', { name: 'Preferências', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Salvar preferências' })).toBeVisible();
});

test('searches the live API and renders accessible results and filters', async ({ page }) => {
	test.setTimeout(60000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/');
	await page.getByRole('searchbox').fill('sveltekit');
	await page.getByRole('button', { name: 'Pesquisar', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Resultados para sveltekit' })).toBeAttached({
		timeout: 30000
	});
	await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 30000 });
	await expect(page.locator('.search-result h2 a').first()).toHaveAttribute('href', /^https?:\/\//);
	await expect(page.locator('.result-source .site-avatar img').first()).toHaveAttribute(
		'src',
		/^\/favicon\?domain=/
	);
	await expect
		.poll(async () =>
			page
				.locator('.result-source .site-avatar img')
				.first()
				.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)
		)
		.toBe(true);
	await expect(page.getByRole('searchbox')).toHaveValue('sveltekit');
	await expect(page).toHaveTitle('sveltekit — nexus');
	await expect(page.getByRole('link', { name: 'Tudo', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.getByRole('button', { name: 'Filtros', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Período' })).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Buscador', exact: true })).toBeVisible();
	await expect(page.getByLabel('Site ou domínio')).toBeVisible();
	await audit(page);
	await page.screenshot({ path: 'test-results/results-desktop.png', animations: 'disabled' });
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.screenshot({ path: 'test-results/results-mobile.png', animations: 'disabled' });
	expect(errors).toEqual([]);
});

test('custom selects support keyboard, typeahead, Escape and mobile top-layer menus', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Preferências', exact: true }).click();
	const language = page.getByRole('combobox', { name: 'Idioma dos resultados' });
	await language.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('listbox')).toBeVisible();
	await audit(page);
	await page.keyboard.press('End');
	await page.keyboard.press('Enter');
	await expect(language).toContainText('Deutsch');
	await page.keyboard.press('Enter');
	await page.keyboard.type('English');
	await page.keyboard.press('Enter');
	await expect(language).toContainText('English (US)');
	await language.click();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('listbox')).not.toBeVisible();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	await language.click();
	const box = await page.getByRole('listbox').boundingBox();
	expect(
		box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844
	).toBeTruthy();
	await page.screenshot({ path: 'test-results/select-mobile.png', animations: 'disabled' });
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('filters can be prepared before searching, reset and submitted as URL parameters', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: /^Refinar/ }).click();
	await select(page, 'Período', 'Último mês');
	await select(page, 'Idioma da pesquisa', 'Português (Brasil)');
	await select(page, 'Pesquisa segura', 'Restrita');
	await select(page, 'Buscador', 'Brave');
	await select(page, 'Formato de arquivo', 'PDF');
	await page.getByLabel('Site ou domínio').fill('https://svelte.dev/');
	await page.getByRole('button', { name: 'Aplicar filtros' }).click();
	await expect(page.locator('input[name="time_range"]')).toHaveValue('month');
	await expect(page.locator('input[name="site"]')).toHaveValue('svelte.dev');
	await expect(page.locator('input[name="engine"]')).toHaveValue('brave');
	await expect(page.locator('input[name="filetype"]')).toHaveValue('pdf');
	await expect(page.getByText('6 filtros aplicados')).toBeVisible();
	await page.getByRole('button', { name: /^Refinar/ }).click();
	await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Período' })).toContainText('Qualquer data');
	await expect(page.getByLabel('Site ou domínio')).toHaveValue('');
	await audit(page);
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.screenshot({
		path: 'test-results/filters-home.png',
		fullPage: true,
		animations: 'disabled'
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await page.evaluate(() => window.scrollTo(0, 0));
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.screenshot({
		path: 'test-results/filters-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
});

test('reduced motion disables entrance effects and page transition animations', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	expect(
		await page.locator('.home-intro').evaluate((el) => getComputedStyle(el).animationName)
	).toBe('none');
	await page.getByRole('button', { name: 'Refinar pesquisa' }).click();
	expect(
		await page.locator('.filter-panel').evaluate((el) => getComputedStyle(el).animationName)
	).toBe('none');
});

test('applied filters survive navigation, can be removed individually and use page transitions', async ({
	page
}) => {
	test.setTimeout(90000);
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/?q=sveltekit');
	await page.evaluate(() => {
		if (!document.startViewTransition) return;
		const original = document.startViewTransition.bind(document);
		document.startViewTransition = (...args) => {
			document.documentElement.dataset.transitionCount = String(
				Number(document.documentElement.dataset.transitionCount || 0) + 1
			);
			return original(...args);
		};
	});
	await page.getByRole('button', { name: 'Filtros', exact: true }).click();
	await select(page, 'Idioma da pesquisa', 'English (US)');
	await select(page, 'Buscador', 'Brave');
	await page.getByLabel('Site ou domínio').fill('svelte.dev');
	await page.getByRole('button', { name: 'Aplicar filtros' }).click();
	await expect(page).toHaveURL(/engine=brave/, { timeout: 30000 });
	await expect(page.locator('.active-filter-bar a').first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Remover filtro: svelte.dev' })).toBeVisible();
	await expect(page.getByRole('searchbox')).toHaveValue('sveltekit');
	const imageLink = new URL(
		(await page.getByRole('link', { name: 'Imagens', exact: true }).getAttribute('href'))!,
		'http://localhost'
	);
	await expect(page.locator('.search-result').first()).toBeVisible();
	for (const engines of await page.locator('.engine-names').allTextContents())
		expect(engines.trim()).toBe('brave');
	expect(imageLink.searchParams.get('site')).toBe('svelte.dev');
	expect(imageLink.searchParams.get('language')).toBe('en-US');
	await audit(page);
	await page.screenshot({ path: 'test-results/filters-applied.png', animations: 'disabled' });
	await expect(page.locator('html')).toHaveAttribute('data-transition-count', '1');
	await page.reload();
	await expect(page.getByRole('link', { name: 'Remover filtro: Brave' })).toBeVisible();
	await page.getByRole('link', { name: 'Remover filtro: Brave' }).click();
	await expect(page).not.toHaveURL(/engine=/, { timeout: 30000 });
	expect(new URL(page.url()).searchParams.get('site')).toBe('svelte.dev');
	await page.getByRole('link', { name: 'Limpar todos', exact: true }).click();
	await expect(page.locator('.active-filter-bar')).not.toBeAttached({ timeout: 30000 });
	expect(new URL(page.url()).searchParams.has('site')).toBe(false);
	expect(errors).toEqual([]);
});

test('failed favicon requests fall back to the site initial without broken images', async ({
	page
}) => {
	test.setTimeout(60000);
	await page.route('**/favicon?domain=**', (route) => route.fulfill({ status: 404, body: '' }));
	await page.goto('/?q=sveltekit');
	const avatar = page.locator('.result-source .site-avatar').first();
	await expect(avatar).toBeVisible();
	await expect(avatar.locator('img')).not.toBeAttached();
	await expect(avatar.locator('span')).toHaveText(/^[A-Z0-9]$/);
});

test('live image search displays a responsive image grid', async ({ page }) => {
	test.setTimeout(60000);
	await page.goto('/?q=arquitetura&category=images');
	await expect(page.locator('.image-result').first()).toBeVisible({ timeout: 30000 });
	await expect(page.getByRole('link', { name: 'Imagens', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.screenshot({ path: 'test-results/images-desktop.png', animations: 'disabled' });
	await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
	await page.screenshot({ path: 'test-results/images-dark.png', animations: 'disabled' });
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.screenshot({ path: 'test-results/images-mobile.png', animations: 'disabled' });
});
