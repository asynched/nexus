<script lang="ts">
	import { Check, X, Sun, Moon, Monitor, RotateCcw } from '@lucide/svelte';
	import { palettes, fontOptions, type Appearance } from '#lib/appearance.ts';
	import { useAppearance } from '#lib/appearance.svelte.ts';
	import Select from './Select.svelte';
	let { onclose }: { onclose: () => void } = $props();
	const appearance = useAppearance();
	const radiusOptions = [
		{ value: 'square', label: 'Retas' },
		{ value: 'soft', label: 'Suaves' },
		{ value: 'rounded', label: 'Arredondadas' }
	];
	const borderOptions = [
		{ value: 'none', label: 'Sem bordas' },
		{ value: 'subtle', label: 'Discretas' },
		{ value: 'strong', label: 'Marcadas' }
	];
	const shadowOptions = [
		{ value: 'none', label: 'Sem sombras' },
		{ value: 'soft', label: 'Suaves' }
	];
	const modes = [
		{ value: 'light', label: 'Claro', icon: Sun },
		{ value: 'dark', label: 'Escuro', icon: Moon },
		{ value: 'system', label: 'Sistema', icon: Monitor }
	] as const;
</script>

<div class="appearance-content">
	<div class="modal-header">
		<div>
			<span class="modal-eyebrow">NEXUS / PERSONALIZAÇÃO</span>
			<h2 id="appearance-title">Aparência</h2>
		</div>
		<button type="button" class="icon-button" aria-label="Fechar aparência" onclick={onclose}
			><X size={19} /></button
		>
	</div>
	<p class="modal-description">Cores, fontes e detalhes. As mudanças são aplicadas na hora.</p>
	<section class="appearance-section" aria-labelledby="palette-label">
		<div class="appearance-section-heading">
			<h3 id="palette-label">Paleta</h3>
			<span>{appearance.dark ? 'Versão escura' : 'Versão clara'}</span>
		</div>
		<div class="palette-options" role="group" aria-label="Paleta de cores">
			{#each palettes as palette}{@const colors =
					palette[appearance.dark ? 'dark' : 'light']}<button
					type="button"
					class="palette-option"
					class:chosen={appearance.current.palette === palette.id}
					aria-label={palette.name}
					aria-pressed={appearance.current.palette === palette.id}
					onclick={() => appearance.update({ palette: palette.id as Appearance['palette'] })}
					><span
						class="palette-swatch"
						style={`--swatch-bg:${colors.bg};--swatch-surface:${colors.surface};--swatch-text:${colors.text};--swatch-accent:${colors.accent};--swatch-border:${colors.border}`}
						aria-hidden="true"
						><span class="swatch-sidebar"></span><span class="swatch-line"></span><span
							class="swatch-line short"
						></span><span class="swatch-action"></span></span
					><span class="palette-name"
						>{palette.name}{#if appearance.current.palette === palette.id}<Check
								size={12}
							/>{/if}</span
					></button
				>{/each}
		</div>
	</section>
	<section class="appearance-section" aria-labelledby="mode-label">
		<div class="appearance-section-heading">
			<h3 id="mode-label">Modo</h3>
			<span
				>{appearance.current.mode === 'system'
					? 'Acompanha seu dispositivo'
					: 'Independente da paleta'}</span
			>
		</div>
		<div class="mode-options" role="group" aria-label="Modo de cor">
			{#each modes as mode}<button
					type="button"
					class:chosen={appearance.current.mode === mode.value}
					aria-pressed={appearance.current.mode === mode.value}
					onclick={() => appearance.update({ mode: mode.value })}
					><mode.icon size={15} />{mode.label}</button
				>{/each}
		</div>
	</section>
	<section class="appearance-section" aria-labelledby="font-label">
		<div class="appearance-section-heading">
			<h3 id="font-label">Fonte</h3>
			<span>Interface e resultados</span>
		</div>
		<div class="font-options" role="group" aria-label="Fonte da interface">
			{#each fontOptions as font}<button
					type="button"
					class="font-option"
					class:chosen={appearance.current.font === font.value}
					aria-pressed={appearance.current.font === font.value}
					onclick={() => appearance.update({ font: font.value as Appearance['font'] })}
					><span class="font-sample" style:font-family={font.family} aria-hidden="true">Aa</span
					>{' '}<span class="font-option-name">{font.label}</span>{' '}<span
						class="font-option-description">{font.description}</span
					>{#if appearance.current.font === font.value}<Check
							size={13}
							class="font-check"
						/>{/if}</button
				>{/each}
		</div>
	</section>
	<section class="appearance-section" aria-labelledby="details-label">
		<div class="appearance-section-heading">
			<h3 id="details-label">Acabamento</h3>
			<span>A marca mantém sua identidade</span>
		</div>
		<div class="appearance-details">
			<div>
				<span>Cantos</span><Select
					label="Arredondamento dos cantos"
					options={radiusOptions}
					value={appearance.current.radius}
					onchange={(value) => appearance.update({ radius: value as Appearance['radius'] })}
				/>
			</div>
			<div>
				<span>Bordas</span><Select
					label="Estilo das bordas"
					options={borderOptions}
					value={appearance.current.border}
					onchange={(value) => appearance.update({ border: value as Appearance['border'] })}
				/>
			</div>
			<div>
				<span>Sombras</span><Select
					label="Estilo das sombras"
					options={shadowOptions}
					value={appearance.current.shadow}
					onchange={(value) => appearance.update({ shadow: value as Appearance['shadow'] })}
				/>
			</div>
		</div>
	</section>
	<section class="appearance-preview" aria-label="Prévia da aparência">
		<span class="preview-caption">PRÉVIA</span>
		<h3>A web, do seu jeito.</h3>
		<p>Veja como fontes, cores e bordas aparecem nos resultados da sua pesquisa.</p>
		<span class="preview-link">Um novo olhar para a sua próxima descoberta</span>
	</section>
	{#if !appearance.storageAvailable}<p class="appearance-storage-warning" role="status">
			O armazenamento está bloqueado. As mudanças funcionam nesta aba, mas não serão mantidas ao
			recarregar.
		</p>{/if}
</div>
<div class="appearance-footer">
	<button type="button" class="reset-filters" onclick={() => appearance.reset()}
		><RotateCcw size={14} />Restaurar padrão</button
	>
	<div>
		<span>{appearance.storageAvailable ? 'Salvo neste navegador' : 'Somente nesta aba'}</span
		><button type="button" class="primary-button" onclick={onclose}
			>Concluir<Check size={15} /></button
		>
	</div>
</div>
