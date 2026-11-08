<script lang="ts">
	import { onMount, untrack, tick } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { navigating } from '$app/state';
	import {
		Search,
		ArrowUpRight,
		ArrowRight,
		Globe2,
		Image,
		Play,
		Newspaper,
		SlidersHorizontal,
		Moon,
		Sun,
		X,
		ChevronLeft,
		ChevronRight,
		ShieldCheck,
		Command,
		CornerDownLeft,
		ExternalLink,
		LoaderCircle,
		Code2,
		Check,
		Palette
	} from '@lucide/svelte';
	import type { PageProps } from './$types';
	import type { Category } from '#lib/search.ts';
	import Select from '#lib/components/Select.svelte';
	import FilterPanel from '#lib/components/FilterPanel.svelte';
	import Favicon from '#lib/components/Favicon.svelte';
	import BrandMark from '#lib/components/BrandMark.svelte';
	import AppearancePanel from '#lib/components/AppearancePanel.svelte';
	import AiAnswer from '#lib/components/AiAnswer.svelte';
	import { useAppearance } from '#lib/appearance.svelte.ts';
	import { brand } from '#lib/brand.ts';
	import {
		languageOptions,
		safeOptions,
		defaultFilters,
		filterParams,
		filterChips,
		type SearchFilters
	} from '#lib/filters.ts';

	let { data }: PageProps = $props();
	let query = $derived(data.q);
	let category: Category = $derived(data.category);
	let input: HTMLInputElement;
	let settings: HTMLDialogElement;
	let about: HTMLDialogElement;
	let appearanceDialog: HTMLDialogElement;
	let aiAnswer = $state<AiAnswer>();
	const appearance = useAppearance();
	const dark = $derived(appearance.dark);
	let tools = $state(false);
	let language = $derived(data.preferences.language);
	let safe = $derived(data.preferences.safe);
	let homeFilters = $state(untrack(() => ({ ...data.filters })));
	const currentFilters = $derived(data.q ? data.filters : homeFilters);
	const activeFilters = $derived(filterChips(currentFilters, data.preferences));
	$effect(() => {
		if (!data.q) homeFilters = { ...data.filters };
	});
	let newTab = $state(false);
	let newTabDraft = $state(false);
	let saving = $state(false);
	let preferenceError = $state('');
	const tabs = [
		{ id: 'general', label: 'Tudo', icon: Globe2 },
		{ id: 'images', label: 'Imagens', icon: Image },
		{ id: 'videos', label: 'Vídeos', icon: Play },
		{ id: 'news', label: 'Notícias', icon: Newspaper }
	] as const;
	const ideas = ['Arquitetura brasileira', 'O que ver no céu hoje', 'Receitas com café'];
	const busy = $derived(!!navigating.to?.url.searchParams.get('q'));

	onMount(() => {
		newTab = document.cookie.split('; ').includes('newtab=1');
	});

	function toggleTheme() {
		appearance.update({ mode: dark ? 'light' : 'dark' });
	}
	function openAppearance() {
		settings?.close();
		appearanceDialog.showModal();
	}

	function searchUrl(
		q: string,
		tab: Category = category,
		page = 1,
		filters: SearchFilters = currentFilters
	) {
		const params = filterParams(
			{ ...filters, filetype: tab === 'general' ? filters.filetype : '' },
			data.preferences
		);
		params.set('q', q);
		params.set('category', tab);
		if (page > 1) params.set('pageno', String(page));
		return `/?${params}`;
	}
	async function applyFilters(filters: SearchFilters) {
		if (data.q) await goto(searchUrl(data.q, category, 1, filters));
		else homeFilters = filters;
		tools = false;
	}
	function removeFilter(key: keyof SearchFilters) {
		return { ...currentFilters, [key]: defaultFilters(data.preferences)[key] };
	}
	async function startAgentSearch() {
		if (!query.trim()) {
			input.focus();
			return;
		}
		await goto(searchUrl(query.trim()));
		await tick();
		await aiAnswer?.run('agent');
	}

	function keyboard(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const typing =
			['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
			target.isContentEditable ||
			target.getAttribute('role') === 'combobox';
		if ((event.key === '/' && !typing) || ((event.metaKey || event.ctrlKey) && event.key === 'k')) {
			if (settings?.open || about?.open || appearanceDialog?.open) return;
			event.preventDefault();
			input?.focus();
			input?.select();
		}
	}

	async function savePreferences(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		preferenceError = '';
		try {
			for (const [key, value] of [
				['language', language],
				['safesearch', safe],
				['newtab', newTabDraft ? '1' : '0']
			]) {
				document.cookie = `${key}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
			}
			newTab = newTabDraft;
			await invalidateAll();
			settings.close();
		} catch {
			preferenceError = 'Não foi possível atualizar os resultados. Tente novamente.';
		} finally {
			saving = false;
		}
	}

	function openSettings() {
		language = data.preferences.language;
		safe = data.preferences.safe;
		newTabDraft = newTab;
		preferenceError = '';
		settings.showModal();
	}
</script>

<svelte:head>
	<title>{data.q ? `${data.q} — ${brand.name}` : `${brand.name} — ${brand.tagline}`}</title>
	<meta name="description" content={brand.description} />
	<meta property="og:title" content={`${brand.name} — ${brand.tagline}`} />
	<meta property="og:description" content={brand.description} />
	<meta name="referrer" content="no-referrer" />
	{#if data.q}<meta name="robots" content="noindex, nofollow" />{/if}
</svelte:head>

<svelte:window onkeydown={keyboard} />

<div class:results-page={!!data.q} class="app-shell">
	{#if busy}<div class="navigation-progress" aria-hidden="true"></div>
		<span class="sr-only" role="status">Pesquisando na web…</span>{/if}
	<a class="skip-link" href="#main">Pular para o conteúdo</a>
	<header class="site-header">
		<a href="/" class="brand" aria-label="nexus — início">
			<BrandMark />
			<span class="brand-name">{brand.name}</span>
		</a>
		{#if data.q}<div class="header-search">{@render searchForm()}</div>{/if}
		<nav class="header-actions" aria-label="Navegação principal">
			<button class="about-button" onclick={() => about.showModal()}
				>Sobre o projeto <ArrowUpRight size={13} /></button
			>
			<span class="nav-divider"></span>
			<button
				class="icon-button"
				onclick={toggleTheme}
				aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'}
				title={dark ? 'Tema claro' : 'Tema escuro'}
				>{#if dark}<Sun size={18} />{:else}<Moon size={18} />{/if}</button
			>
			<button
				class="icon-button"
				onclick={openAppearance}
				aria-label="Personalizar aparência"
				title="Aparência"><Palette size={18} /></button
			>
			<button
				class="icon-button"
				onclick={openSettings}
				aria-label="Preferências"
				title="Preferências"><SlidersHorizontal size={18} /></button
			>
		</nav>
	</header>

	{#snippet searchForm()}
		<form
			action="/"
			method="GET"
			class="search-form"
			role="search"
			data-sveltekit-keepfocus
			onsubmit={(event) => {
				if (!query.trim()) {
					event.preventDefault();
					input.focus();
				}
			}}
		>
			<Search class="search-leading" size={21} strokeWidth={1.7} aria-hidden="true" />
			<input
				bind:this={input}
				bind:value={query}
				name="q"
				type="search"
				placeholder="O que você quer descobrir?"
				aria-label="Pesquisar na web"
				autocomplete="off"
				required
				maxlength="500"
			/>
			<input type="hidden" name="category" value={category} />
			{#each Array.from(filterParams({ ...currentFilters, filetype: category === 'general' ? currentFilters.filetype : '' }, data.preferences)) as [name, value]}<input
					type="hidden"
					{name}
					{value}
				/>{/each}
			{#if query}<button
					type="button"
					class="clear-button icon-button"
					aria-label="Limpar pesquisa"
					onclick={() => {
						query = '';
						input.focus();
					}}><X size={17} /></button
				>{:else}<kbd class="search-shortcut">/</kbd>{/if}
			<button type="submit" class="search-submit" aria-label="Pesquisar" disabled={busy}
				>{#if busy}<LoaderCircle size={19} class="spin" />{:else}<ArrowRight
						size={20}
					/>{/if}</button
			>
		</form>
	{/snippet}

	<main id="main" class:home-main={!data.q} class:search-main={!!data.q}>
		{#if !data.q}
			<section class="home-search" aria-label="Busca">
				<div class="home-intro">
					<div class="home-brand-mark"><BrandMark size={52} /></div>
					<h1>{brand.name}</h1>
					<p>{brand.tagline}</p>
				</div>
				<div class="home-tabs-row">
					<div class="home-tabs" role="group" aria-label="Tipo de pesquisa">
						{#each tabs as tab}<button
								class:active={category === tab.id}
								aria-pressed={category === tab.id}
								onclick={() => {
									category = tab.id;
									if (tab.id !== 'general') homeFilters.filetype = '';
								}}><tab.icon size={15} strokeWidth={1.7} />{tab.label}</button
							>{/each}
					</div>
					<button
						class="home-filter-button"
						aria-label={activeFilters.length
							? `Refinar ${activeFilters.length} filtros da pesquisa`
							: 'Refinar pesquisa'}
						class:active={tools || activeFilters.length > 0}
						aria-expanded={tools}
						aria-controls="home-filters"
						onclick={() => (tools = !tools)}
						><SlidersHorizontal size={14} /><span>Refinar</span>{#if activeFilters.length}{' '}<span
								class="filter-count">{activeFilters.length}</span
							>{/if}</button
					>
				</div>
				{@render searchForm()}
				<div class="search-hint">
					<span>Uma pergunta. Vários buscadores.</span><span class="enter-hint"
						><CornerDownLeft size={12} /> Enter para pesquisar</span
					>
				</div>
				{#if data.ai.agent && (category === 'general' || category === 'news')}
					<button class="home-agent-button" onclick={startAgentSearch} disabled={busy}
						>Pesquisar com agente <ArrowUpRight size={13} /></button
					>
					<small class="home-agent-note">Envia a consulta e trechos ao provedor de IA.</small>
				{/if}
				{#if tools}<div id="home-filters" class="home-filter-panel">
						<FilterPanel
							filters={currentFilters}
							preferences={data.preferences}
							{category}
							onapply={applyFilters}
						/>
					</div>{/if}
				{#if !tools && activeFilters.length}<div class="home-active-filters">
						<span
							>{activeFilters.length}
							{activeFilters.length === 1 ? 'filtro aplicado' : 'filtros aplicados'}</span
						><button onclick={() => (homeFilters = defaultFilters(data.preferences))}
							>Limpar filtros <X size={12} /></button
						>
					</div>{/if}
				<div class="ideas">
					<span class="ideas-label">Comece por uma ideia</span>
					<div>
						{#each ideas as idea}<a href={searchUrl(idea)}>{idea}<ArrowUpRight size={13} /></a
							>{/each}
					</div>
				</div>
			</section>
			<div class="home-note">
				<ShieldCheck size={16} strokeWidth={1.6} /><span
					>Sem histórico de buscas nesta interface.<br /><span class="note-detail"
						>Só suas preferências são salvas localmente.</span
					></span
				>
			</div>
		{:else}
			<div class="results-toolbar">
				<nav class="result-tabs" aria-label="Tipo de resultado">
					{#each tabs as tab}<a
							href={searchUrl(data.q, tab.id)}
							class:active={data.category === tab.id}
							aria-current={data.category === tab.id ? 'page' : undefined}
							><tab.icon size={16} strokeWidth={1.7} />{tab.label}</a
						>{/each}
				</nav>
				<button
					class="tools-button"
					class:active={tools || activeFilters.length > 0}
					aria-expanded={tools}
					aria-controls="search-filters"
					aria-label={activeFilters.length
						? `Filtros ${activeFilters.length} aplicados`
						: 'Filtros'}
					onclick={() => (tools = !tools)}
					><SlidersHorizontal size={14} />Filtros{#if activeFilters.length}{' '}<span
							class="filter-count">{activeFilters.length}</span
						>{/if}</button
				>
			</div>
			{#if tools}<div id="search-filters" class="results-filter-panel">
					<FilterPanel
						filters={currentFilters}
						preferences={data.preferences}
						{category}
						onapply={applyFilters}
						{busy}
					/>
				</div>{/if}
			{#if activeFilters.length}<div class="active-filter-bar" aria-label="Filtros aplicados">
					{#each activeFilters as filter}<a
							href={searchUrl(data.q, category, 1, removeFilter(filter.key))}
							aria-label={`Remover filtro: ${filter.label}`}>{filter.label}<X size={12} /></a
						>{/each}<a
						class="clear-all-filters"
						href={searchUrl(data.q, category, 1, defaultFilters(data.preferences))}>Limpar todos</a
					>
				</div>{/if}
			<div class="results-body" class:is-searching={busy} aria-busy={busy}>
				<h1 class="sr-only">Resultados para {data.q}</h1>
				{#if data.ai.summary && (category === 'general' || category === 'news')}
					<AiAnswer
						bind:this={aiAnswer}
						search={searchUrl(data.q, category, data.page).split('?')[1]}
						agentEnabled={data.ai.agent}
					/>
				{/if}
				{#if data.error}
					<div class="empty-state" role="alert">
						<div class="state-icon"><Globe2 size={26} /></div>
						<h2>Não conseguimos chegar aos resultados.</h2>
						<p>{data.error}</p>
						<button class="primary-button" onclick={() => invalidateAll()}
							>Tentar novamente <ArrowRight size={15} /></button
						>
					</div>
				{:else}
					<div class="result-meta">
						<span
							>{data.results.length} resultados nesta página <span class="meta-dot">·</span>
							{data.elapsed.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s</span
						>{#if data.page > 1}<span>Página {data.page}</span>{/if}
					</div>
					{#if data.partial}<p class="partial-note" role="status">
							Fontes indisponíveis:
							{data.engineFailures
								.map(({ engine, reason }) => `${engine} (${reason})`)
								.join(' · ')}.
							{#if data.results.length}Exibindo os resultados das fontes que responderam.{/if}
						</p>{/if}
					{#if data.corrections.length}<p class="corrections">
							Você quis dizer: {#each data.corrections as correction}<a href={searchUrl(correction)}
									>{correction}</a
								>
							{/each}
						</p>{/if}
					{#if !data.results.length}
						<div class="empty-state">
							<div class="state-icon"><Search size={26} /></div>
							<h2>{data.partial ? 'Nenhum resultado recebido.' : 'Nenhum resultado por aqui.'}</h2>
							<p>
								{#if data.partial}
									Há buscadores indisponíveis nesta pesquisa. Tente novamente mais tarde ou
									selecione outra fonte.
								{:else}
									Tente outras palavras ou uma pesquisa mais curta.{#if activeFilters.length}
										Você também pode remover os filtros aplicados.{/if}
								{/if}
							</p>
							{#if activeFilters.length}<a
									class="primary-button"
									href={searchUrl(data.q, category, 1, defaultFilters(data.preferences))}
									>Pesquisar sem filtro <ArrowRight size={15} /></a
								>{:else}<button
									class="primary-button"
									onclick={() => {
										input.focus();
										input.select();
									}}>Editar pesquisa <ArrowRight size={15} /></button
								>{/if}
						</div>
					{:else if data.category === 'images'}
						<div class="image-grid">
							{#each data.results as result, index (result.id)}<a
									class="image-result"
									style={`--item-index:${Math.min(index, 7)}`}
									href={result.url}
									target={newTab ? '_blank' : undefined}
									rel="noreferrer"
									><div class="image-preview">
										<Image size={28} aria-hidden="true" />
										{#if result.image}<img
												src={result.image}
												alt={result.title}
												loading="lazy"
												referrerpolicy="no-referrer"
												onerror={(event) => {
													(event.currentTarget as HTMLImageElement).style.display = 'none';
												}}
											/>{/if}<ArrowUpRight size={16} class="image-link-icon" />
									</div>
									<h2>{result.title}</h2>
									<span class="image-source"><Favicon domain={result.domain} />{result.domain}</span
									></a
								>{/each}
						</div>
					{:else}
						<div class="result-list">
							{#each data.results as result, index (result.id)}<article
									class="search-result"
									style={`--item-index:${Math.min(index, 5)}`}
								>
									<div class="result-source">
										<Favicon domain={result.domain} /><span
											><span class="source-domain">{result.domain}</span><span class="source-path"
												>{result.path ? `› ${result.path}` : result.url}</span
											></span
										>
									</div>
									<div class="result-content">
										{#if data.category === 'videos' && result.image}<a
												class="video-thumbnail"
												href={result.url}
												target={newTab ? '_blank' : undefined}
												rel="noreferrer"
												aria-label={`Assistir: ${result.title}`}
												><img
													src={result.image}
													alt=""
													loading="lazy"
													referrerpolicy="no-referrer"
													onerror={(event) => {
														(event.currentTarget as HTMLImageElement).style.display = 'none';
													}}
												/><span><Play size={18} fill="currentColor" /></span></a
											>{/if}
										<div>
											<h2>
												<a href={result.url} target={newTab ? '_blank' : undefined} rel="noreferrer"
													>{result.title}</a
												>
											</h2>
											{#if result.content}<p>
													{result.content}
												</p>{/if}{#if result.engines.length || result.published}<div
													class="result-engines"
												>
													{#if result.published && !Number.isNaN(Date.parse(result.published))}<time
															datetime={result.published}
															>{new Date(result.published).toLocaleDateString('pt-BR')}</time
														><span>·</span>{/if}<span class="engine-names"
														>{result.engines.join(' · ')}</span
													>
												</div>{/if}
										</div>
									</div>
								</article>{/each}
						</div>
					{/if}
					{#if data.suggestions.length}<section class="related-searches">
							<h2>Continue explorando</h2>
							<div>
								{#each data.suggestions as suggestion}<a href={searchUrl(suggestion)}
										><Search size={15} /><span>{suggestion}</span><ArrowUpRight size={14} /></a
									>{/each}
							</div>
						</section>{/if}
					{#if data.results.length || data.page > 1}<nav class="pagination" aria-label="Paginação">
							{#if data.page > 1}<a href={searchUrl(data.q, category, data.page - 1)}
									><ChevronLeft size={16} />Anterior</a
								>{/if}<span>Página {data.page}</span>{#if data.results.length && data.page < 100}<a
									href={searchUrl(data.q, category, data.page + 1)}
									>Próxima<ChevronRight size={16} /></a
								>{/if}
						</nav>{/if}
				{/if}
			</div>
		{/if}
	</main>

	<footer class="site-footer">
		<div>
			<span class="footer-dot"></span><span class="footer-brand">nexus</span><span
				class="footer-separator">/</span
			><a href="https://docs.searxng.org/" target="_blank" rel="noreferrer"
				>Movido por SearXNG <ArrowUpRight size={12} /></a
			>
		</div>
		<div>
			<button onclick={() => about.showModal()}>Privacidade</button><a
				href="https://github.com/searxng/searxng"
				target="_blank"
				rel="noreferrer">Código aberto <ArrowUpRight size={12} /></a
			><button class="footer-shortcut" onclick={() => input.focus()} aria-label="Focar pesquisa"
				><Command size={12} /><span>K</span></button
			>
		</div>
	</footer>
</div>

<dialog
	bind:this={settings}
	class="modal"
	aria-labelledby="preferences-title"
	onclick={(event) => {
		if (event.target === settings) settings.close();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') settings.close();
	}}
>
	<form onsubmit={savePreferences}>
		<div class="modal-header">
			<div>
				<span class="modal-eyebrow">DO SEU JEITO</span>
				<h2 id="preferences-title">Preferências</h2>
			</div>
			<button
				type="button"
				class="icon-button"
				aria-label="Fechar preferências"
				onclick={() => settings.close()}><X size={19} /></button
			>
		</div>
		<p class="modal-description">Idioma, conteúdo e comportamento dos resultados.</p>
		<div class="setting-row">
			<span
				><strong>Idioma dos resultados</strong><small>Priorize resultados neste idioma.</small
				></span
			><Select label="Idioma dos resultados" options={languageOptions} bind:value={language} />
		</div>
		<div class="setting-row">
			<span><strong>Pesquisa segura</strong><small>Filtre conteúdo explícito.</small></span><Select
				label="Pesquisa segura"
				options={safeOptions}
				bind:value={safe}
			/>
		</div>
		<label class="setting-row"
			><span><strong>Abrir em nova aba</strong><small>Mantenha sua pesquisa por perto.</small></span
			><input type="checkbox" class="toggle" bind:checked={newTabDraft} /></label
		>
		<div class="setting-row">
			<span><strong>Aparência</strong><small>Fontes, paletas e acabamento.</small></span><button
				type="button"
				class="theme-control"
				onclick={openAppearance}><Palette size={15} />Personalizar</button
			>
		</div>
		<p class="storage-note">
			<ShieldCheck size={14} />Salvamos suas preferências, não um histórico de buscas.
		</p>
		{#if preferenceError}<p class="preference-error" role="alert">{preferenceError}</p>{/if}
		<div class="modal-footer">
			<button type="button" class="secondary-button" onclick={() => settings.close()}
				>Cancelar</button
			><button class="primary-button" type="submit" disabled={saving}
				>{#if saving}<LoaderCircle class="spin" size={15} />Salvando…{:else}Salvar preferências<Check
						size={15}
					/>{/if}</button
			>
		</div>
	</form>
</dialog>

<dialog
	bind:this={appearanceDialog}
	class="modal appearance-modal"
	aria-labelledby="appearance-title"
	onclick={(event) => {
		if (event.target === appearanceDialog) appearanceDialog.close();
	}}
>
	<AppearancePanel onclose={() => appearanceDialog.close()} />
</dialog>

<dialog
	bind:this={about}
	class="modal about-modal"
	aria-labelledby="about-title"
	onclick={(event) => {
		if (event.target === about) about.close();
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') about.close();
	}}
>
	<div class="modal-header">
		<span class="brand"><BrandMark /><span class="brand-name">{brand.name}</span></span><button
			class="icon-button"
			aria-label="Fechar sobre o projeto"
			onclick={() => about.close()}><X size={19} /></button
		>
	</div>
	<h2 id="about-title">Uma janela mais simples para a web.</h2>
	<p>
		nexus é uma interface independente para o SearXNG, um metabuscador de código aberto que reúne
		resultados de diferentes serviços de pesquisa.
	</p>
	<div class="about-detail">
		<ShieldCheck size={19} />
		<div>
			<h3>Sobre seus dados</h3>
			<p>
				Esta interface não usa analytics nem salva seu histórico de pesquisa. Tema e preferências
				são armazenados localmente. As consultas são enviadas pelo servidor para a instância SearXNG
				configurada, que consulta os buscadores disponíveis. O processamento e os logs desse serviço
				seguem as políticas de seu operador. Imagens de resultados são carregadas de fontes
				externas. Os favicons são obtidos pelo servidor a partir do serviço de ícones do Google,
				enviando apenas o domínio do resultado, sem a consulta ou o IP do seu navegador. Como a
				consulta faz parte da URL, ela pode aparecer no histórico normal do navegador.
			</p>
			{#if data.ai.summary}<p>
					Ao acionar um resumo ou a pesquisa com agente, sua consulta e trechos dos resultados são
					enviados ao provedor de IA configurado. O agente pode reformular a consulta e realizar
					buscas adicionais. A retenção desses dados segue as políticas do provedor. Uma sessão de
					IA usa um identificador aleatório temporário em cookie HttpOnly, sem salvar a conversa.
				</p>{/if}
		</div>
	</div>
	<div class="about-detail">
		<Code2 size={19} />
		<div>
			<h3>Aberto por natureza</h3>
			<p>SearXNG é software livre. Conheça o projeto, os buscadores e como ele funciona.</p>
			<a href="https://docs.searxng.org/" target="_blank" rel="noreferrer"
				>Documentação do SearXNG <ExternalLink size={13} /></a
			>
		</div>
	</div>
	<div class="about-bottom">Menos interface entre você e a sua próxima descoberta.</div>
</dialog>
