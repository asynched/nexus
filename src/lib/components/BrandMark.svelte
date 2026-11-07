<script lang="ts">
	import symbol from '../../../static/favicon.svg?raw';
	let { size = 32 }: { size?: number } = $props();
</script>

<span class="brand-mark" style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true"
	>{@html symbol}</span
>
