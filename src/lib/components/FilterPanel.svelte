<script lang="ts">
	import { untrack } from 'svelte';
	import { ArrowRight, RotateCcw, SlidersHorizontal } from '@lucide/svelte';
	import Select from './Select.svelte';
	import {
		timeOptions,
		languageOptions,
		safeOptions,
		engineOptions,
		fileOptions,
		defaultFilters,
		normalizeDomain,
		type SearchFilters,
		type Preferences
	} from '#lib/filters.ts';
	import type { Category } from '#lib/search.ts';
	let {
		filters,
		preferences,
		category,
		onapply,
		busy = false
	}: {
		filters: SearchFilters;
		preferences: Preferences;
		category: Category;
		onapply: (filters: SearchFilters) => void;
		busy?: boolean;
	} = $props();
	let draft = $state(untrack(() => ({ ...filters })));
	$effect(() => {
		draft = { ...filters };
	});
	function submit(event: SubmitEvent) {
		event.preventDefault();
		const input = (event.currentTarget as HTMLFormElement).elements.namedItem(
			'site'
		) as HTMLInputElement;
		const site = normalizeDomain(draft.site);
		input.setCustomValidity(
			draft.site.trim() && !site
				? 'Digite um domínio válido, como svelte.dev, sem caminhos ou portas.'
				: ''
		);
		if (!input.reportValidity()) return;
		onapply({ ...draft, site, filetype: category === 'general' ? draft.filetype : '' });
	}
</script>

<form class="filter-panel" onsubmit={submit} aria-label="Filtros da pesquisa">
	<div class="filter-panel-heading">
		<span><SlidersHorizontal size={15} />Refine sua pesquisa</span><span
			>Vale só para esta pesquisa.</span
		>
	</div>
	<div class="filter-grid">
		<div class="filter-field">
			<span id="period-label">Período</span><Select
				label="Período"
				options={timeOptions}
				bind:value={draft.time}
			/>
		</div>
		<div class="filter-field">
			<span>Idioma</span><Select
				label="Idioma da pesquisa"
				options={languageOptions}
				bind:value={draft.language}
			/>
		</div>
		<div class="filter-field">
			<span>Pesquisa segura</span><Select
				label="Pesquisa segura"
				options={safeOptions}
				bind:value={draft.safe}
			/>
		</div>
		<div class="filter-field">
			<span>Buscador</span><Select
				label="Buscador"
				options={engineOptions}
				bind:value={draft.engine}
			/>
		</div>
		<label class="filter-field"
			><span>Site ou domínio</span><input
				name="site"
				type="text"
				placeholder="Ex.: wikipedia.org"
				bind:value={draft.site}
				maxlength="253"
				spellcheck="false"
				autocapitalize="none"
				oninput={(event) => event.currentTarget.setCustomValidity('')}
			/></label
		>
		<div class="filter-field">
			<span>Formato de arquivo</span><Select
				label="Formato de arquivo"
				options={fileOptions}
				bind:value={draft.filetype}
				disabled={category !== 'general'}
			/>{#if category !== 'general'}<small>Disponível na categoria Tudo.</small>{/if}
		</div>
	</div>
	<div class="filter-panel-bottom">
		<p>Site e formato usam operadores de pesquisa. O suporte varia por buscador.</p>
		<div>
			<button
				type="button"
				class="reset-filters"
				onclick={() => (draft = defaultFilters(preferences))}
				><RotateCcw size={13} />Restaurar</button
			><button type="submit" class="primary-button" disabled={busy}
				>Aplicar filtros<ArrowRight size={15} /></button
			>
		</div>
	</div>
</form>
