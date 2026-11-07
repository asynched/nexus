<script lang="ts">
	let { domain }: { domain: string } = $props();
	let failedDomain = $state('');
	let loadedDomain = $state('');
</script>

<span class="site-avatar" aria-hidden="true">
	<span>{domain.charAt(0).toUpperCase()}</span>
	{#if failedDomain !== domain}<img
			class:is-loaded={loadedDomain === domain}
			src={`/favicon?domain=${encodeURIComponent(domain)}`}
			alt=""
			width="18"
			height="18"
			loading="lazy"
			decoding="async"
			onload={() => (loadedDomain = domain)}
			onerror={() => (failedDomain = domain)}
		/>{/if}
</span>
