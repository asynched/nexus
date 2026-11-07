import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function open(page: Page) {
	await page.getByRole('button', { name: 'Personalizar aparência', exact: true }).click();
	await expect(page.getByRole('dialog', { name: 'Aparência', exact: true })).toBeVisible();
}
async function select(page: Page, label: string, value: string) {
	await page.getByRole('combobox', { name: label, exact: true }).click();
	await page.getByRole('option', { name: value, exact: true }).click();
}
async function audit(page: Page) {
	await page.evaluate(async () =>
		Promise.all(
			document
				.getAnimations()
				.filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
				.map((a) => a.finished.catch(() => {}))
		)
	);
	const { violations } = await new AxeBuilder({ page }).analyze();
	expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) }))).toEqual(
		[]
	);
}

test('appearance is live, persistent, applied before hydration and resettable', async ({
	page
}) => {
	await page.goto('/');
	await open(page);
	await page.getByRole('button', { name: 'Dracula', exact: true }).click();
	await page
		.getByRole('group', { name: 'Modo de cor' })
		.getByRole('button', { name: 'Escuro', exact: true })
		.click();
	await page.getByRole('button', { name: 'JetBrains Mono Monoespaçada', exact: true }).click();
	await select(page, 'Arredondamento dos cantos', 'Retas');
	await select(page, 'Estilo das bordas', 'Marcadas');
	await select(page, 'Estilo das sombras', 'Sem sombras');
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'dracula');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('html')).toHaveAttribute('data-font', 'mono');
	expect(
		await page.locator('.search-form').evaluate((el) => getComputedStyle(el).borderRadius)
	).toBe('0px');
	expect(
		await page.locator('.search-form').evaluate((el) => getComputedStyle(el).borderTopWidth)
	).toBe('2px');
	await expect(page.locator('.search-form')).toHaveCSS('box-shadow', 'none');
	await audit(page);
	await page.locator('.appearance-modal').evaluate((dialog) => {
		dialog.scrollTop = 0;
	});
	await page.screenshot({ path: 'test-results/appearance-dracula.png', animations: 'disabled' });
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	await page.addInitScript(() => {
		document.addEventListener(
			'DOMContentLoaded',
			() => {
				document.documentElement.dataset.initialPalette = document.documentElement.dataset.palette;
				document.documentElement.dataset.initialFont = document.documentElement.dataset.font;
			},
			{ once: true }
		);
	});
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-initial-palette', 'dracula');
	await expect(page.locator('html')).toHaveAttribute('data-initial-font', 'mono');
	await expect(page.locator('html')).toHaveAttribute('data-border', 'strong');
	await page.screenshot({ path: 'test-results/home-dracula-mono.png', animations: 'disabled' });
	await open(page);
	await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
	for (const [key, value] of Object.entries({
		palette: 'regular',
		font: 'sans',
		theme: 'light',
		radius: 'soft',
		border: 'subtle',
		shadow: 'soft'
	}))
		await expect(page.locator('html')).toHaveAttribute(`data-${key}`, value);
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'regular');
});

test('all palettes have light and dark modes with accessible controls', async ({ page }) => {
	test.setTimeout(120000);
	await page.goto('/');
	await open(page);
	for (const palette of ['Regular', 'GitHub', 'Ayu', 'Dracula', 'Gruvbox']) {
		await page.getByRole('button', { name: palette, exact: true }).click();
		for (const mode of ['Claro', 'Escuro']) {
			await page
				.getByRole('group', { name: 'Modo de cor' })
				.getByRole('button', { name: mode, exact: true })
				.click();
			await audit(page);
			const logoColors = await page.locator('html').evaluate((root) => {
				const styles = getComputedStyle(root);
				const color = document.createElement('span');
				color.style.color = styles.getPropertyValue('--action-bg').trim();
				return { rgb: color.style.color, hex: styles.getPropertyValue('--action-bg').trim() };
			});
			for (const selector of [
				'.site-header .brand-mark rect',
				'.home-brand-mark .brand-mark rect',
				'.about-modal .brand-mark rect'
			])
				await expect(page.locator(selector)).toHaveCSS('fill', logoColors.rgb);
			const icon = decodeURIComponent(
				(await page.locator('link[rel="icon"]').getAttribute('href'))!.split(',')[1]
			);
			expect(icon).toContain(`fill="${logoColors.hex}"`);
		}
	}
});

test('logo and favicon match the chosen palette immediately and after reload', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.home-brand-mark .brand-mark rect')).toHaveCSS(
		'fill',
		'rgb(23, 62, 53)'
	);
	await open(page);
	await page.getByRole('button', { name: 'Dracula', exact: true }).click();
	await page
		.getByRole('group', { name: 'Modo de cor' })
		.getByRole('button', { name: 'Escuro', exact: true })
		.click();
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	await expect(page.locator('.home-brand-mark .brand-mark rect')).toHaveCSS(
		'fill',
		'rgb(189, 147, 249)'
	);
	await expect(page.locator('.home-brand-mark .brand-mark path').first()).toHaveCSS(
		'fill',
		'rgb(40, 42, 54)'
	);
	await page.screenshot({
		path: 'test-results/home-dynamic-logo-dracula.png',
		animations: 'disabled'
	});
	const icon = await page.locator('link[rel="icon"]').getAttribute('href');
	await page.reload();
	await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', icon!);
	await expect(page.locator('.site-header .brand-mark rect')).toHaveCSS(
		'fill',
		'rgb(189, 147, 249)'
	);
});

test('all four fonts load locally and are applied to controls and results text', async ({
	page
}) => {
	await page.goto('/');
	await open(page);
	for (const [name, id, family] of [
		['Sistema A fonte do seu dispositivo', 'system', 'system-ui'],
		['Geist Sans-serif', 'sans', 'Geist Variable'],
		['Source Serif 4 Serifada', 'serif', 'Source Serif 4 Variable'],
		['JetBrains Mono Monoespaçada', 'mono', 'JetBrains Mono Variable']
	]) {
		await page.getByRole('button', { name, exact: true }).click();
		await expect(page.locator('html')).toHaveAttribute('data-font', id);
		expect(
			await page.locator('.appearance-preview p').evaluate((el) => getComputedStyle(el).fontFamily)
		).toContain(family);
		expect(
			await page.getByRole('searchbox').evaluate((el) => getComputedStyle(el).fontFamily)
		).toContain(family);
		await page.evaluate(() => document.fonts.ready);
		if (id !== 'system') {
			expect(
				await page.evaluate(
					(font) =>
						Array.from(document.fonts).some(
							(face) => face.family.replace(/^['"]|['"]$/g, '') === font && face.status === 'loaded'
						),
					family
				)
			).toBe(true);
		}
	}
	await page.locator('.appearance-modal').evaluate((dialog) => {
		dialog.scrollTop = 0;
	});
	await page.screenshot({ path: 'test-results/appearance-new-fonts.png', animations: 'disabled' });
	await page.setViewportSize({ width: 390, height: 844 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	await page.screenshot({
		path: 'test-results/home-jetbrains-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
});

test('system mode reacts to device changes, and appearance syncs between tabs', async ({
	page,
	context
}) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await open(page);
	await page
		.getByRole('group', { name: 'Modo de cor' })
		.getByRole('button', { name: 'Sistema', exact: true })
		.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	const other = await context.newPage();
	await other.goto('/');
	await page.getByRole('button', { name: 'Ayu', exact: true }).click();
	await expect(other.locator('html')).toHaveAttribute('data-palette', 'ayu');
	await other.close();
});

test('mobile customization, keyboard selects and borderless appearance remain usable', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await open(page);
	await page.getByRole('button', { name: 'Gruvbox', exact: true }).click();
	await page.getByRole('button', { name: 'Source Serif 4 Serifada', exact: true }).click();
	await select(page, 'Arredondamento dos cantos', 'Arredondadas');
	const border = page.getByRole('combobox', { name: 'Estilo das bordas', exact: true });
	await border.focus();
	await page.keyboard.press('Enter');
	await page.keyboard.press('Home');
	await page.keyboard.press('Enter');
	await expect(page.locator('html')).toHaveAttribute('data-border', 'none');
	await audit(page);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
		true
	);
	await page.screenshot({ path: 'test-results/appearance-mobile.png', animations: 'disabled' });
	await page.locator('.appearance-modal').evaluate((dialog) => {
		dialog.scrollTop = 0;
	});
	await page.screenshot({
		path: 'test-results/appearance-mobile-palettes.png',
		animations: 'disabled'
	});
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	await expect(page.getByRole('searchbox')).toBeVisible();
	await page.screenshot({
		path: 'test-results/home-gruvbox-serif-mobile.png',
		fullPage: true,
		animations: 'disabled'
	});
});

test('blocked storage does not break customization', async ({ page }) => {
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new DOMException('Blocked', 'SecurityError');
		};
		Storage.prototype.setItem = () => {
			throw new DOMException('Blocked', 'SecurityError');
		};
	});
	await page.goto('/');
	await open(page);
	await page.getByRole('button', { name: 'GitHub', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'github');
	await expect(page.getByRole('status')).toContainText('armazenamento está bloqueado');
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	await expect(page.getByRole('searchbox')).toBeVisible();
});

test('custom appearance applies to real search results and survives navigation and the quick mode toggle', async ({
	page
}) => {
	test.setTimeout(60000);
	await page.goto('/?q=sveltekit');
	await expect(page.locator('.search-result').first()).toBeVisible({ timeout: 30000 });
	await open(page);
	await page.getByRole('button', { name: 'GitHub', exact: true }).click();
	await page.getByRole('button', { name: 'Source Serif 4 Serifada', exact: true }).click();
	await page.getByRole('button', { name: 'Concluir', exact: true }).click();
	expect(
		await page
			.locator('.search-result p')
			.first()
			.evaluate((el) => getComputedStyle(el).fontFamily)
	).toContain('Source Serif 4 Variable');
	expect(
		await page
			.locator('.search-result h2')
			.first()
			.evaluate((el) => getComputedStyle(el).fontFamily)
	).toContain('Source Serif 4 Variable');
	expect(
		await page.locator('.site-header .brand').evaluate((el) => getComputedStyle(el).fontFamily)
	).toContain('Geist Variable');
	await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'github');
	await audit(page);
	await page.screenshot({ path: 'test-results/results-github-serif.png', animations: 'disabled' });
	await page.getByRole('link', { name: 'nexus — início' }).click();
	await expect(page.getByRole('heading', { name: 'nexus', exact: true })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('data-palette', 'github');
	await expect(page.locator('html')).toHaveAttribute('data-font', 'serif');
});
