import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import {
	appearanceBootstrap,
	defaultAppearance,
	normalizeAppearance,
	palettes
} from './appearance.ts';

describe('appearance validation', () => {
	it('accepts every declared personalization field', () => {
		expect(
			normalizeAppearance({
				palette: 'dracula',
				font: 'mono',
				mode: 'system',
				radius: 'square',
				border: 'strong',
				shadow: 'none'
			})
		).toEqual({
			palette: 'dracula',
			font: 'mono',
			mode: 'system',
			radius: 'square',
			border: 'strong',
			shadow: 'none'
		});
	});
	it.each([
		null,
		undefined,
		false,
		123,
		'dark',
		[],
		{
			palette: '<script>',
			font: 'Comic Sans',
			mode: 'invalid',
			radius: -100,
			border: 'red',
			shadow: true
		}
	])('rejects invalid input %j without injecting arbitrary values', (input) => {
		expect(normalizeAppearance(input)).toEqual(defaultAppearance);
	});
	it('keeps valid fields when one field is invalid', () => {
		expect(normalizeAppearance({ palette: 'ayu', font: 'bad' })).toEqual({
			...defaultAppearance,
			palette: 'ayu'
		});
	});
});

function initialize(
	saved: string | null,
	systemDark = false,
	legacy: string | null = null,
	blocked = false
) {
	const properties: Record<string, string> = {};
	const dataset: Record<string, string> = {};
	const meta: string[] = [];
	const icons: string[] = [];
	const root = {
		dataset,
		style: { setProperty: (name: string, value: string) => (properties[name] = value) },
		ownerDocument: {
			querySelector: (selector: string) => ({
				setAttribute: (_name: string, value: string) =>
					(selector === 'link[rel="icon"]' ? icons : meta).push(value)
			})
		}
	};
	runInNewContext(appearanceBootstrap, {
		document: { documentElement: root },
		localStorage: {
			getItem: (key: string) => {
				if (blocked) throw new Error('blocked');
				return key === 'nexus-appearance' ? saved : legacy;
			}
		},
		window: { matchMedia: () => ({ matches: systemDark }) }
	});
	return { properties, dataset, meta, icons };
}

describe('the actual pre-paint bootstrap', () => {
	it('applies stored fonts, palette, edges and resolved system mode before hydration', () => {
		const result = initialize(
			JSON.stringify({
				palette: 'dracula',
				font: 'serif',
				mode: 'system',
				radius: 'square',
				border: 'strong',
				shadow: 'none'
			}),
			true
		);
		expect(result.dataset).toMatchObject({
			palette: 'dracula',
			font: 'serif',
			theme: 'dark',
			radius: 'square',
			border: 'strong',
			shadow: 'none'
		});
		expect(result.properties['--bg']).toBe('#282a36');
		expect(result.properties['--app-font']).toContain('Source Serif 4 Variable');
		expect(result.properties['--border']).toBe(palettes[3].dark.muted);
		expect(result.meta).toEqual(['#282a36']);
	});
	it('migrates the existing light/dark preference', () => {
		expect(initialize(null, false, 'dark').dataset.theme).toBe('dark');
	});
	it.each([
		['serif', 'Source Serif 4 Variable'],
		['mono', 'JetBrains Mono Variable']
	])('keeps a saved %s preference while using its new font family', (font, family) => {
		const result = initialize(JSON.stringify({ ...defaultAppearance, font }));
		expect(result.dataset.font).toBe(font);
		expect(result.properties['--app-font']).toContain(family);
	});
	it.each(['{broken', 'null', '[]', '{"palette":"unknown","font":"bad"}'])(
		'handles corrupt storage: %s',
		(saved) => {
			expect(initialize(saved).dataset).toMatchObject({ ...defaultAppearance, theme: 'light' });
		}
	);
	it('still paints a working default when storage is blocked', () => {
		expect(initialize(null, true, null, true).dataset).toMatchObject({
			...defaultAppearance,
			theme: 'light'
		});
	});
});

function luminance(hex: string) {
	const rgb = hex
		.slice(1)
		.match(/../g)!
		.map((channel) => parseInt(channel, 16) / 255)
		.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
	return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
	const first = luminance(a),
		second = luminance(b);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
describe('palette legibility', () => {
	for (const palette of palettes)
		for (const mode of ['light', 'dark'] as const)
			it(`${palette.name} / ${mode} meets WCAG AA for text, secondary text, links and actions`, () => {
				const c = palette[mode];
				for (const bg of [c.bg, c.surface, c.subtle]) {
					for (const fg of [c.text, c.muted, c.link, c.accent])
						expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
				}
				expect(contrast(c.actionText, c.actionBg)).toBeGreaterThanOrEqual(4.5);
				const { properties, icons } = initialize(JSON.stringify({ palette: palette.id, mode }));
				expect(properties['--logo-bg']).toBe(c.actionBg);
				expect(properties['--logo-fg']).toBe(c.actionText);
				expect(contrast(properties['--logo-fg'], properties['--logo-bg'])).toBeGreaterThanOrEqual(
					3
				);
				expect(
					contrast(properties['--logo-accent'], properties['--logo-bg'])
				).toBeGreaterThanOrEqual(3);
				const icon = decodeURIComponent(icons[0].split(',')[1]);
				for (const token of ['--logo-bg', '--logo-fg', '--logo-accent'])
					expect(icon).toContain(`fill="${properties[token]}"`);
			});
});
