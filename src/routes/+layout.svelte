<script lang="ts">
	import '@fontsource-variable/geist';
	import '@fontsource-variable/jetbrains-mono';
	import '@fontsource-variable/source-serif-4/standard.css';
	import './layout.css';
	import './appearance.css';
	import { onMount } from 'svelte';
	import { createAppearanceContext } from '#lib/appearance.svelte.ts';
	import { appearanceBootstrap } from '#lib/appearance.ts';
	import type { LayoutProps } from './$types';
	import { onNavigate } from '$app/navigation';
	import { brand } from '#lib/brand.ts';
	import { page } from '$app/state';

	let { children }: LayoutProps = $props();
	const appearance = createAppearanceContext();
	onMount(() => appearance.mount());
	onNavigate((navigation) => {
		if (
			!document.startViewTransition ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		)
			return;
		return new Promise<void>((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			void transition.finished.catch(() => {});
		});
	});
</script>

<svelte:head>
	<link rel="icon" href={brand.icon} type="image/svg+xml" />
	<link rel="alternate icon" href="/brand/nexus-32.png" type="image/png" sizes="32x32" />
	<link rel="apple-touch-icon" href="/brand/nexus-apple-touch.png" sizes="180x180" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta name="application-name" content={brand.name} />
	<meta name="apple-mobile-web-app-title" content={brand.name} />
	<meta name="theme-color" content={brand.colors.forest} />
	<meta property="og:site_name" content={brand.name} />
	<meta property="og:type" content="website" />
	<meta property="og:image" content={`${page.url.origin}/brand/nexus-social.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta
		property="og:image:alt"
		content="nexus — A web, sem distrações. Monograma N em verde-floresta e lima."
	/>
	<meta name="twitter:card" content="summary_large_image" />
	{@html `<${'script'}>${appearanceBootstrap}</${'script'}>`}
</svelte:head>

{@render children()}
