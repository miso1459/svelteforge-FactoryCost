<script lang="ts">
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import * as ScrollArea from "$lib/components/ui/scroll-area/index.js";
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import XIcon from "@lucide/svelte/icons/x";
	import type { CodeValue } from "$lib/(user)/Common/DropdownLists.js";

	type Props = {
		items: CodeValue[];
		value: string;
		placeholder?: string;
		disabled?: boolean;
		class?: string;
	};

	let {
		items,
		value = $bindable(""),
		placeholder = "Select...",
		disabled = false,
		class: className = "",
	}: Props = $props();

	let open = $state(false);
	let search = $state("");

	const selectedLabel = $derived(items.find((i) => i.code === value)?.value ?? "");

	const maxCodeLen = $derived(Math.max(...items.map((i) => i.code.length)));
	const codeStyle = $derived(`min-width: ${maxCodeLen}ch;`);

	const filtered = $derived(() => {
		if (!search.trim()) return items;
		const q = search.toLowerCase();
		return items.filter(
			(i) =>
				i.code.toLowerCase().includes(q) || i.value.toLowerCase().includes(q)
		);
	});

	function select(code: string) {
		value = code;
		open = false;
		search = "";
	}

	function clearSearch() {
		search = "";
	}

	$effect(() => {
		if (!open) search = "";
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger {disabled} class="w-full">
		<Button
			variant="outline"
			role="combobox"
			aria-expanded={open}
			class={["w-full justify-between font-normal", className].filter(Boolean).join(" ")}
			{disabled}
		>
			<span class={selectedLabel ? "" : "text-muted-foreground"}>
				{selectedLabel || placeholder}
			</span>
			<ChevronsUpDownIcon class="text-muted-foreground size-4 shrink-0" />
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-[--bits-popover-anchor-width] p-0" align="start" sideOffset={4}>
		<div class="flex items-center border-b px-3 py-2">
			<Input
				class="border-none p-0 shadow-none focus-visible:ring-0"
				placeholder="Search..."
				bind:value={search}
			/>
			{#if search}
				<Button variant="ghost" size="icon" class="size-6 shrink-0" onclick={clearSearch}>
					<XIcon class="size-3" />
				</Button>
			{/if}
		</div>
		<ScrollArea.Root class="max-h-60">
			{#if filtered().length === 0}
				<div class="text-muted-foreground py-6 text-center text-sm">No results found.</div>
			{:else}
				{#each filtered() as item (item.code)}
					<button
						class="hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground w-full px-3 py-2 text-left text-sm cursor-pointer"
						data-selected={item.code === value || undefined}
						onclick={() => select(item.code)}
					>
						<span class="flex items-center gap-2">
							<span class="text-muted-foreground font-mono text-xs shrink-0" style={codeStyle}>{item.code}</span>
							<span class="font-medium truncate">{item.value}</span>
						</span>
					</button>
				{/each}
			{/if}
		</ScrollArea.Root>
	</Popover.Content>
</Popover.Root>
