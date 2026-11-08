<script lang="ts">
	import { untrack } from 'svelte';
	import { LoaderCircle, X, ArrowUpRight } from '@lucide/svelte';
	import { citationParts, type AiAnswer, type AiMode } from '#lib/ai.ts';

	let { search, agentEnabled }: { search: string; agentEnabled: boolean } = $props();
	let answer = $state<AiAnswer | null>(null);
	let pending = $state(false);
	let error = $state('');
	let mode = $state<AiMode>('summary');
	let controller: AbortController | undefined;
	let generation = 0;

	function reset() {
		generation++;
		controller?.abort();
		pending = false;
		answer = null;
		error = '';
	}
	$effect(() => {
		search;
		untrack(reset);
		return () => controller?.abort();
	});

	export async function run(nextMode: AiMode) {
		if (nextMode === 'agent' && !agentEnabled) return;
		reset();
		mode = nextMode;
		pending = true;
		controller = new AbortController();
		const request = generation;
		try {
			const response = await fetch('/api/ai', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode, search }),
				signal: controller.signal
			});
			const body = await response.json();
			if (request !== generation) return;
			if (!response.ok) {
				error =
					typeof body.error === 'string' ? body.error : 'A IA não respondeu. Tente novamente.';
				return;
			}
			answer = body;
		} catch {
			if (request === generation && !controller?.signal.aborted)
				error = 'A IA não respondeu. A busca comum continua disponível.';
		} finally {
			if (request === generation) pending = false;
		}
	}
</script>

<section class="ai-panel" aria-label="Assistente de pesquisa">
	<div class="ai-actions">
		<button class="ai-action" onclick={() => run('summary')} disabled={pending}
			>Resumir com IA</button
		>
		{#if agentEnabled}<button class="ai-action" onclick={() => run('agent')} disabled={pending}
				>Pesquisar com agente</button
			>{/if}
		{#if pending || answer || error}<button
				class="ai-close"
				onclick={reset}
				aria-label={pending ? 'Cancelar IA' : 'Fechar resposta da IA'}><X size={16} /></button
			>{/if}
	</div>
	<p class="ai-disclosure">
		Opcional: envia sua consulta e trechos dos resultados ao provedor de IA.
	</p>
	{#if pending}
		<p class="ai-progress" role="status">
			<LoaderCircle size={16} class="spin" />{mode === 'agent'
				? 'O agente está consultando fontes e comparando resultados…'
				: 'Preparando um resumo dos resultados…'}
		</p>
	{:else if error}
		<p class="ai-error" role="alert">{error}</p>
	{:else if answer}
		<div class="ai-response">
			<h2>{mode === 'agent' ? 'Pesquisa com agente' : 'Resumo com IA'}</h2>
			<div class="ai-text">
				{#each citationParts(answer.text, answer.sources) as part}{#if part.source}<a
							class="ai-citation"
							href={part.source.url}
							target="_blank"
							rel="noreferrer"
							aria-label={`Fonte ${part.source.id}: ${part.source.title}`}>{part.text}</a
						>{:else}{part.text}{/if}{/each}
			</div>
			<ol class="ai-sources" aria-label="Fontes da resposta">
				{#each answer.sources as source}<li value={source.id}>
						<a href={source.url} target="_blank" rel="noreferrer"
							>{source.title}<ArrowUpRight size={12} /><span>{source.domain}</span></a
						>
					</li>{/each}
			</ol>
			<p class="ai-footnote">
				Gerado por IA a partir de trechos, não de páginas completas. Confira as fontes.{#if mode === 'agent'}
					{' '}{answer.searches}
					{answer.searches === 1
						? 'busca realizada'
						: 'buscas realizadas'}.{/if}{#if answer.partial}
					{' '}Algumas fontes não responderam.{/if}
			</p>
		</div>
	{/if}
</section>

<style>
	.ai-panel {
		border-block: 1px solid var(--border);
		padding: 16px 0;
		margin: 12px 0 24px;
	}
	.ai-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.ai-action {
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 12px;
		background: var(--surface);
	}
	.ai-action:hover {
		background: var(--subtle);
	}
	.ai-close {
		display: grid;
		place-items: center;
		margin-left: auto;
		padding: 8px;
	}
	.ai-disclosure,
	.ai-footnote {
		color: var(--muted);
		font-size: 11px;
		line-height: 1.6;
		margin: 9px 0 0;
	}
	.ai-progress {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: 13px;
		line-height: 1.6;
		margin: 18px 0 4px;
	}
	.ai-error {
		font-size: 13px;
		color: var(--muted);
		line-height: 1.6;
		margin: 16px 0 0;
	}
	.ai-response h2 {
		font-size: 16px;
		font-weight: 600;
		margin: 22px 0 12px;
	}
	.ai-text {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-size: 14px;
		line-height: 1.8;
	}
	.ai-citation {
		color: var(--link);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.ai-sources {
		list-style: decimal;
		padding-left: 20px;
		font-size: 12px;
		line-height: 1.6;
		margin: 16px 0;
	}
	.ai-sources li {
		margin: 7px 0;
		padding-left: 3px;
	}
	.ai-sources a {
		color: var(--link);
		overflow-wrap: anywhere;
	}
	.ai-sources :global(svg) {
		display: inline;
		margin-left: 4px;
	}
	.ai-sources span {
		display: block;
		color: var(--muted);
		font-size: 11px;
	}
</style>
