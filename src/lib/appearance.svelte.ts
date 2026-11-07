import { getContext, setContext } from 'svelte';
import {
	appearanceConfig,
	defaultAppearance,
	normalizeAppearance,
	paintAppearance,
	type Appearance
} from './appearance.ts';

const key = Symbol('nexus-appearance');
export function createAppearanceContext() {
	let current = $state<Appearance>({ ...defaultAppearance });
	let systemDark = $state(false);
	let storageAvailable = $state(true);
	function paint() {
		paintAppearance(document.documentElement, current, systemDark, appearanceConfig);
	}
	function read() {
		try {
			const saved = localStorage.getItem(appearanceConfig.storageKey);
			let parsed: unknown;
			try {
				parsed = saved
					? JSON.parse(saved)
					: { mode: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light' };
			} catch {
				parsed = {};
			}
			current = normalizeAppearance(parsed);
			storageAvailable = true;
		} catch {
			current = { ...defaultAppearance };
			storageAvailable = false;
		}
		paint();
	}
	const context = {
		get current() {
			return current;
		},
		get dark() {
			return current.mode === 'dark' || (current.mode === 'system' && systemDark);
		},
		get storageAvailable() {
			return storageAvailable;
		},
		update(patch: Partial<Appearance>) {
			current = normalizeAppearance({ ...current, ...patch });
			paint();
			try {
				localStorage.setItem(appearanceConfig.storageKey, JSON.stringify(current));
				storageAvailable = true;
			} catch {
				storageAvailable = false;
			}
		},
		reset() {
			context.update({ ...defaultAppearance });
		},
		mount() {
			const media = window.matchMedia('(prefers-color-scheme: dark)');
			systemDark = media.matches;
			read();
			const changed = () => {
				systemDark = media.matches;
				paint();
			};
			const synced = (event: StorageEvent) => {
				if (event.key === appearanceConfig.storageKey || event.key === null) read();
			};
			media.addEventListener('change', changed);
			window.addEventListener('storage', synced);
			return () => {
				media.removeEventListener('change', changed);
				window.removeEventListener('storage', synced);
			};
		}
	};
	setContext(key, context);
	return context;
}
export function useAppearance() {
	return getContext<ReturnType<typeof createAppearanceContext>>(key);
}
