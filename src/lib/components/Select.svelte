<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { Check, ChevronDown } from '@lucide/svelte';
	import type { Option } from '#lib/filters.ts';
	let {
		value = $bindable(''),
		options,
		label,
		name,
		onchange,
		disabled = false
	}: {
		value?: string;
		options: Option[];
		label: string;
		name?: string;
		onchange?: (value: string) => void;
		disabled?: boolean;
	} = $props();
	const id = $props.id();
	let trigger: HTMLButtonElement;
	let menu: HTMLDivElement;
	let open = $state(false);
	let active = $state(0);
	let position = $state({ left: 0, top: 0, width: 220, height: 320 });
	let typed = '';
	let lastTyped = 0;
	const selected = $derived(options.find((option) => option.value === value) || options[0]);
	onMount(() => {
		const reposition = (event: Event) => {
			if (open && !menu.contains(event.target as Node)) place();
		};
		window.addEventListener('scroll', reposition, { capture: true, passive: true });
		return () => window.removeEventListener('scroll', reposition, true);
	});

	async function show(index = options.findIndex((option) => option.value === value)) {
		if (disabled) return;
		place();
		active = Math.max(0, index);
		menu.showPopover();
		open = true;
		await reveal();
	}
	function place() {
		const rect = trigger.getBoundingClientRect();
		if (open && (rect.bottom < 0 || rect.top > window.innerHeight)) {
			close();
			return;
		}
		const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 32);
		const desiredHeight = Math.min(
			options.reduce((height, option) => height + (option.description ? 62 : 42), 12),
			340
		);
		const below = window.innerHeight - rect.bottom - 16;
		const above = rect.top - 16;
		const flip = below < desiredHeight && above > below;
		const height = Math.min(desiredHeight, flip ? above : below);
		position = {
			left: Math.max(16, Math.min(rect.left, window.innerWidth - width - 16)),
			top: flip ? rect.top - height - 6 : rect.bottom + 6,
			width,
			height
		};
	}
	function close() {
		menu?.hidePopover();
		open = false;
	}
	async function reveal() {
		await tick();
		const option = menu?.querySelector<HTMLElement>(`[data-index="${active}"]`);
		if (!option) return;
		if (option.offsetTop < menu.scrollTop) menu.scrollTop = option.offsetTop;
		else if (option.offsetTop + option.offsetHeight > menu.scrollTop + menu.clientHeight) {
			menu.scrollTop = option.offsetTop + option.offsetHeight - menu.clientHeight;
		}
	}
	function choose(index: number) {
		value = options[index].value;
		onchange?.(value);
		close();
		trigger.focus({ preventScroll: true });
	}
	function keyboard(event: KeyboardEvent) {
		if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) {
			event.preventDefault();
			event.stopPropagation();
			if (event.key === 'Enter' || event.key === ' ') {
				if (open) choose(active);
				else void show();
				return;
			}
			if (!open) {
				void show(event.key === 'End' ? options.length - 1 : event.key === 'Home' ? 0 : undefined);
				return;
			}
			active =
				event.key === 'Home'
					? 0
					: event.key === 'End'
						? options.length - 1
						: (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
			void reveal();
		} else if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			close();
		} else if (event.key === 'Tab') {
			close();
		} else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			typed = Date.now() - lastTyped > 700 ? event.key : typed + event.key;
			lastTyped = Date.now();
			const index = options.findIndex((option) =>
				option.label.toLocaleLowerCase().startsWith(typed.toLocaleLowerCase())
			);
			if (index >= 0) {
				event.preventDefault();
				if (!open) void show(index);
				else {
					active = index;
					void reveal();
				}
			}
		}
	}
</script>

<svelte:window
	onresize={() => {
		if (open) place();
	}}
/>
<div class="select-control">
	{#if name}<input type="hidden" {name} {value} />{/if}
	<button
		bind:this={trigger}
		type="button"
		class="select-trigger"
		class:is-open={open}
		role="combobox"
		aria-label={label}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-controls={`${id}-list`}
		aria-activedescendant={open ? `${id}-option-${active}` : undefined}
		{disabled}
		onclick={() => (open ? close() : show())}
		onkeydown={keyboard}
	>
		<span>{selected?.label}</span><ChevronDown size={14} strokeWidth={1.8} />
	</button>
	<div
		bind:this={menu}
		id={`${id}-list`}
		class="select-menu"
		role="listbox"
		tabindex="-1"
		aria-label={label}
		popover="auto"
		style={`left:${position.left}px;top:${position.top}px;width:${position.width}px;max-height:${position.height}px`}
		ontoggle={(event) => {
			open = event.newState === 'open';
		}}
		onpointerdown={(event) => event.preventDefault()}
	>
		{#each options as option, index}<button
				type="button"
				id={`${id}-option-${index}`}
				data-index={index}
				role="option"
				aria-selected={value === option.value}
				tabindex="-1"
				class="select-option"
				class:highlighted={active === index}
				onpointermove={() => (active = index)}
				onclick={() => choose(index)}
				><span
					><span class="option-label">{option.label}</span>{#if option.description}<span
							class="option-description">{option.description}</span
						>{/if}</span
				><span class="option-check"
					>{#if value === option.value}<Check size={15} />{/if}</span
				></button
			>{/each}
	</div>
</div>
