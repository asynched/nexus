import symbol from '../../static/favicon.svg?raw';
import { brand } from './brand.ts';

export type Colors = {
	bg: string;
	surface: string;
	subtle: string;
	text: string;
	muted: string;
	border: string;
	accent: string;
	actionBg: string;
	actionText: string;
	link: string;
};
export type Palette = { id: string; name: string; light: Colors; dark: Colors };
export const palettes: Palette[] = [
	{
		id: 'regular',
		name: 'Regular',
		light: {
			bg: '#fafbf7',
			surface: '#ffffff',
			subtle: '#f0f3e9',
			text: '#18251b',
			muted: '#65705f',
			border: '#e1e7d8',
			accent: '#245b46',
			actionBg: '#173e35',
			actionText: '#f4f7ec',
			link: '#2154a0'
		},
		dark: {
			bg: '#101610',
			surface: '#172018',
			subtle: '#222e21',
			text: '#edf2e7',
			muted: '#a1af98',
			border: '#30402d',
			accent: '#c9e88e',
			actionBg: '#c9e88e',
			actionText: '#173e35',
			link: '#93b9f7'
		}
	},
	{
		id: 'github',
		name: 'GitHub',
		light: {
			bg: '#f6f8fa',
			surface: '#ffffff',
			subtle: '#eaeef2',
			text: '#1f2328',
			muted: '#59636e',
			border: '#d1d9e0',
			accent: '#0864cf',
			actionBg: '#1f883d',
			actionText: '#ffffff',
			link: '#0864cf'
		},
		dark: {
			bg: '#0d1117',
			surface: '#161b22',
			subtle: '#21262d',
			text: '#e6edf3',
			muted: '#9da7b1',
			border: '#30363d',
			accent: '#58a6ff',
			actionBg: '#238636',
			actionText: '#ffffff',
			link: '#58a6ff'
		}
	},
	{
		id: 'ayu',
		name: 'Ayu',
		light: {
			bg: '#fafafa',
			surface: '#ffffff',
			subtle: '#eef1f4',
			text: '#3e4751',
			muted: '#626b75',
			border: '#d9dfe5',
			accent: '#8b5800',
			actionBg: '#ffb454',
			actionText: '#252b32',
			link: '#176583'
		},
		dark: {
			bg: '#0b0e14',
			surface: '#11151c',
			subtle: '#1b222d',
			text: '#e6e1cf',
			muted: '#a8adba',
			border: '#313b49',
			accent: '#ffb454',
			actionBg: '#ffb454',
			actionText: '#0b0e14',
			link: '#73d0ff'
		}
	},
	{
		id: 'dracula',
		name: 'Dracula',
		light: {
			bg: '#f5f3fa',
			surface: '#ffffff',
			subtle: '#ebe8f3',
			text: '#282a36',
			muted: '#62627b',
			border: '#d8d2e5',
			accent: '#7041a5',
			actionBg: '#694099',
			actionText: '#ffffff',
			link: '#6132a0'
		},
		dark: {
			bg: '#282a36',
			surface: '#303241',
			subtle: '#383b4e',
			text: '#f8f8f2',
			muted: '#b7b6cf',
			border: '#4a4d64',
			accent: '#bd93f9',
			actionBg: '#bd93f9',
			actionText: '#282a36',
			link: '#8be9fd'
		}
	},
	{
		id: 'gruvbox',
		name: 'Gruvbox',
		light: {
			bg: '#fbf1c7',
			surface: '#fff8de',
			subtle: '#f2e5bc',
			text: '#3c3836',
			muted: '#655c54',
			border: '#d5c4a1',
			accent: '#8f3f16',
			actionBg: '#9d3b25',
			actionText: '#fff8de',
			link: '#225d63'
		},
		dark: {
			bg: '#282828',
			surface: '#32302f',
			subtle: '#3c3836',
			text: '#ebdbb2',
			muted: '#bdae93',
			border: '#5a524c',
			accent: '#fe8019',
			actionBg: '#fe8019',
			actionText: '#282828',
			link: '#8ec07c'
		}
	}
];
export const fontOptions = [
	{
		value: 'system',
		label: 'Sistema',
		description: 'A fonte do seu dispositivo',
		family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
	},
	{
		value: 'sans',
		label: 'Geist',
		description: 'Sans-serif',
		family: '"Geist Variable", sans-serif'
	},
	{
		value: 'serif',
		label: 'Source Serif 4',
		description: 'Serifada',
		family: '"Source Serif 4 Variable", Georgia, serif'
	},
	{
		value: 'mono',
		label: 'JetBrains Mono',
		description: 'Monoespaçada',
		family: '"JetBrains Mono Variable", ui-monospace, monospace'
	}
];
export type Appearance = {
	palette: 'regular' | 'github' | 'ayu' | 'dracula' | 'gruvbox';
	font: 'system' | 'sans' | 'serif' | 'mono';
	mode: 'light' | 'dark' | 'system';
	radius: 'square' | 'soft' | 'rounded';
	border: 'none' | 'subtle' | 'strong';
	shadow: 'none' | 'soft';
};
export const defaultAppearance: Appearance = {
	palette: 'regular',
	font: 'sans',
	mode: 'light',
	radius: 'soft',
	border: 'subtle',
	shadow: 'soft'
};
export const appearanceConfig = {
	storageKey: 'nexus-appearance',
	defaults: defaultAppearance,
	choices: {
		palette: palettes.map((p) => p.id),
		font: fontOptions.map((f) => f.value),
		mode: ['light', 'dark', 'system'],
		radius: ['square', 'soft', 'rounded'],
		border: ['none', 'subtle', 'strong'],
		shadow: ['none', 'soft']
	},
	palettes,
	fonts: fontOptions,
	logo: { svg: symbol, colors: brand.colors },
	tokens: {
		bg: '--bg',
		surface: '--surface',
		subtle: '--subtle',
		text: '--text',
		muted: '--muted',
		border: '--border',
		accent: '--accent',
		actionBg: '--action-bg',
		actionText: '--action-text',
		link: '--link'
	}
};
export type AppearanceConfig = typeof appearanceConfig;

// These two functions are deliberately self-contained: the exact same code is used before paint.
export function normalizeAppearance(
	value: unknown,
	config: AppearanceConfig = appearanceConfig
): Appearance {
	const input =
		value && typeof value === 'object' && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: {};
	const result = { ...config.defaults };
	for (const key of Object.keys(config.defaults) as (keyof Appearance)[]) {
		if (typeof input[key] === 'string' && config.choices[key].includes(input[key] as string))
			(result as Record<string, string>)[key] = input[key] as string;
	}
	return result;
}
export function paintAppearance(
	root: HTMLElement,
	appearance: Appearance,
	systemDark: boolean,
	config: AppearanceConfig
): void {
	const dark = appearance.mode === 'dark' || (appearance.mode === 'system' && systemDark);
	const colors = config.palettes.find((p) => p.id === appearance.palette)![dark ? 'dark' : 'light'];
	for (const [key, value] of Object.entries(appearance)) root.dataset[key] = value;
	root.dataset.theme = dark ? 'dark' : 'light';
	root.style.colorScheme = dark ? 'dark' : 'light';
	for (const key of Object.keys(config.tokens) as (keyof Colors)[])
		root.style.setProperty(config.tokens[key], colors[key]);
	const logoBackground = colors.actionBg;
	const logoForeground = colors.actionText;
	const logoAccent =
		appearance.palette === 'regular' && !dark
			? config.logo.colors.lime
			: '#' +
				[1, 3, 5]
					.map((offset) =>
						Math.round(
							parseInt(logoForeground.slice(offset, offset + 2), 16) * 0.8 +
								parseInt(logoBackground.slice(offset, offset + 2), 16) * 0.2
						)
							.toString(16)
							.padStart(2, '0')
					)
					.join('');
	root.style.setProperty('--logo-bg', logoBackground);
	root.style.setProperty('--logo-fg', logoForeground);
	root.style.setProperty('--logo-accent', logoAccent);
	const logoColors: Record<string, string> = {
		[config.logo.colors.forest]: logoBackground,
		[config.logo.colors.ivory]: logoForeground,
		[config.logo.colors.lime]: logoAccent
	};
	// A single replacement pass prevents one new color from replacing another.
	const favicon = config.logo.svg.replace(
		/#[0-9a-f]{6}/gi,
		(color) => logoColors[color.toLowerCase()] || color
	);
	root.ownerDocument
		.querySelector('link[rel="icon"]')
		?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(favicon)}`);
	root.style.setProperty(
		'--border',
		appearance.border === 'none'
			? 'transparent'
			: appearance.border === 'strong'
				? colors.muted
				: colors.border
	);
	root.style.setProperty(
		'--app-font',
		config.fonts.find((font) => font.value === appearance.font)!.family
	);
	root.ownerDocument.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.bg);
}
function bootstrapAppearance(
	config: AppearanceConfig,
	normalize: typeof normalizeAppearance,
	paint: typeof paintAppearance
) {
	let value: unknown = {};
	try {
		const saved = localStorage.getItem(config.storageKey);
		if (saved) {
			try {
				value = JSON.parse(saved);
			} catch {
				/* Invalid data uses defaults. */
			}
		} else value = { mode: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light' };
	} catch {
		/* Storage may be disabled. */
	}
	paint(
		document.documentElement,
		normalize(value, config),
		window.matchMedia('(prefers-color-scheme: dark)').matches,
		config
	);
}
// Only static, application-owned code/configuration is serialized, never user input.
export const appearanceBootstrap = `(${bootstrapAppearance.toString()})(${JSON.stringify(appearanceConfig)},${normalizeAppearance.toString()},${paintAppearance.toString()});`;
