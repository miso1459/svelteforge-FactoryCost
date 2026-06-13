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
	let triggerEl = $state<HTMLElement | null>(null);
	let popoverWidth = $state<string>("var(--bits-popover-anchor-width)");

	const selectedLabel = $derived(items.find((i) => i.code === value)?.value ?? "");

	function filterItems(list: CodeValue[], query: string) {
		if (!query.trim()) return list;
		const q = query.toLowerCase();
		return list.filter(
			(i) => i.code.toLowerCase().includes(q) || i.value.toLowerCase().includes(q)
		);
	}

	const visibleItems = $derived(filterItems(items, search));
	const maxCodeLen = $derived(
		visibleItems.length > 0 ? Math.max(...visibleItems.map((i) => i.code.length)) : 1
	);
	const codeStyle = $derived(`min-width: ${maxCodeLen}ch;`);

	// canvas로 실제 픽셀 너비를 측정
	let _canvas: HTMLCanvasElement | null = null;
	let _ctx: CanvasRenderingContext2D | null = null;

	function measureText(text: string, font: string): number {
		if (typeof document === "undefined") return 0;
		if (!_canvas) _canvas = document.createElement("canvas");
		if (!_ctx) _ctx = _canvas.getContext("2d");
		if (!_ctx) return 0;
		_ctx.font = font;
		return _ctx.measureText(text).width;
	}

	// 보이는 항목 중 가장 긴 조합을 기준으로 팝오버 너비 계산
	function calcWidth(vis: CodeValue[]): string {
		if (typeof document === "undefined" || vis.length === 0) {
			return "var(--bits-popover-anchor-width)";
		}

		// 폰트: text-sm(14px) font-medium, text-xs(12px) font-mono
		const labelFont = "500 14px Inter, ui-sans-serif, system-ui, sans-serif";
		const codeFont = "400 12px ui-monospace, SFMono-Regular, Menlo, monospace";

		// 레이아웃 여백:
		// px-3(12px) * 2 = 24px (버튼 좌우 패딩)
		// gap-2 = 8px
		// 스크롤바 여유 = 8px
		// 아이콘(ChevronsUpDown) + 여유 = 24px
		const PADDING = 24 + 8 + 8;
		// code 컬럼은 maxCodeLen ch 고정 → monospace 12px ≈ 7.2px/ch
		const codeColWidth = maxCodeLen * 7.2 + 4;

		let maxLabelWidth = 0;
		for (const item of vis) {
			const w = measureText(item.value, labelFont);
			if (w > maxLabelWidth) maxLabelWidth = w;
		}

		const contentWidth = Math.ceil(PADDING + codeColWidth + maxLabelWidth);

		// 트리거 버튼 너비와 비교하여 더 큰 값 사용
		const triggerWidth = triggerEl?.offsetWidth ?? 0;
		const finalWidth = Math.max(contentWidth, triggerWidth, 160);

		return `${finalWidth}px`;
	}

	// open이 되거나 visibleItems가 바뀔 때 너비 재계산
	$effect(() => {
		// 반응성: visibleItems, open 모두 추적
		const vis = visibleItems;
		if (open) {
			popoverWidth = calcWidth(vis);
		}
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
			bind:ref={triggerEl}
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
	<Popover.Content
		class="p-0"
		style="width: {popoverWidth}"
		align="start"
		sideOffset={4}
	>
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
			{#if visibleItems.length === 0}
				<div class="text-muted-foreground py-6 text-center text-sm">No results found.</div>
			{:else}
				{#each visibleItems as item (item.code)}
					<button
						class="hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground w-full px-3 py-2 text-left text-sm cursor-pointer"
						data-selected={item.code === value || undefined}
						onclick={() => select(item.code)}
					>
						<span class="flex items-center gap-2">
							<span class="text-muted-foreground font-mono text-xs shrink-0" style={codeStyle}
								>{item.code}</span
							>
							<span class="font-medium">{item.value}</span>
						</span>
					</button>
				{/each}
			{/if}
		</ScrollArea.Root>
	</Popover.Content>
</Popover.Root>
