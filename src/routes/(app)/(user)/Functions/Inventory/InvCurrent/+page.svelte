<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import { Label } from "$lib/components/ui/label/index.js";
	import { toast } from "svelte-sonner";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { TRAN_TYPE } from "$lib/(user)/Common/DropdownLists.js";
	import { formatStdPrice } from "$lib/utils/format.js";

	let { data } = $props();

	// ── Date range (당월 1일 ~ 오늘) ────────────────────────────────────────────
	const today = new Date();
	const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);

	function dateStr(d: Date) {
		return d.toISOString().slice(0, 10);
	}

	function parseDate(s: string) {
		return new Date(s + "T00:00:00");
	}

	let fromDate = $state(dateStr(defaultFrom));
	let toDate = $state(dateStr(today));

	let search = $state("");
	let sortKey = $state<string>("tranItem");
	let sortDir = $state<"asc" | "desc">("asc");
	let pageSize = $state(10);
	let currentPage = $state(1);

	function pad(n: number): string {
		return n.toString().padStart(2, "0");
	}

	function formatDate(date: Date | null) {
		if (!date) return "—";
		const d = new Date(date);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	// ── Item value lookup ─────────────────────────────────────────────────────
	const itemValueMap = $derived(new Map(data.itemInfo.list.map((i) => [i.code, i.value])));

	// ── Aggregation ───────────────────────────────────────────────────────────
	const aggregated = $derived.by(() => {
		const from = parseDate(fromDate);
		const toEnd = parseDate(toDate);
		toEnd.setHours(23, 59, 59, 999);

		type Group = { preQty: number; inQty: number; outQty: number };
		const groups = new Map<string, Group>();

		for (const r of data.records) {
			const d = r.documentDt ? new Date(r.documentDt) : null;
			if (!d) continue;

			const typeInfo = TRAN_TYPE.list.find((t) => t.code === r.tranType);
			const sign = parseInt(typeInfo?.opt1 ?? "1");

			if (!groups.has(r.tranItem)) {
				groups.set(r.tranItem, { preQty: 0, inQty: 0, outQty: 0 });
			}
			const g = groups.get(r.tranItem)!;

			if (d < from) {
				// 기간 이전: 잔량 계산 (sign 적용)
				g.preQty += r.tranQty * sign;
			} else if (d >= from && d <= toEnd) {
				// 기간 내: 입고/출고 분리
				if (sign === 1) {
					g.inQty += r.tranQty;
				} else {
					g.outQty += r.tranQty;
				}
			}
		}

		return Array.from(groups.entries()).map(([code, g]) => ({
			tranItem: code,
			itemValue: itemValueMap.get(code) ?? code,
			preQty: g.preQty,
			inQty: g.inQty,
			outQty: g.outQty,
			stockQty: g.preQty + g.inQty - g.outQty,
		}));
	});

	// ── Search filter ─────────────────────────────────────────────────────────
	const filtered = $derived(
		aggregated.filter(
			(r) =>
				r.itemValue.toLowerCase().includes(search.toLowerCase()) ||
				r.tranItem.toLowerCase().includes(search.toLowerCase())
		)
	);

	// ── Sort ──────────────────────────────────────────────────────────────────
	const sorted = $derived.by(() => {
		const arr = [...filtered];
		arr.sort((a, b) => {
			const aVal = String((a as Record<string, unknown>)[sortKey] ?? "");
			const bVal = String((b as Record<string, unknown>)[sortKey] ?? "");
			const cmp = aVal.localeCompare(bVal);
			return sortDir === "asc" ? cmp : -cmp;
		});
		return arr;
	});

	const paginated = $derived(sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize));

	// ── Reset page on filter change ───────────────────────────────────────────
	$effect(() => {
		search; fromDate; toDate;
		currentPage = 1;
	});

	// ── Sort toggle ───────────────────────────────────────────────────────────
	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === "asc" ? "desc" : "asc";
		} else {
			sortKey = key;
			sortDir = "asc";
		}
	}

	function sortIcon(key: string) {
		if (sortKey !== key) return ArrowUpDownIcon;
		return sortDir === "asc" ? ArrowUpIcon : ArrowDownIcon;
	}

	// ── Refresh ───────────────────────────────────────────────────────────────
	let refreshing = $state(false);

	async function handleRefresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
		toast.success("Data refreshed");
	}

	// ── Export ────────────────────────────────────────────────────────────────
	function handleExport(format: "csv" | "json") {
		const exportData = filtered.map((r) => ({
			itemCode: r.tranItem,
			itemName: r.itemValue,
			preQty: r.preQty,
			inQty: r.inQty,
			outQty: r.outQty,
			stockQty: r.stockQty,
		}));
		if (format === "csv") exportToCSV(exportData, "Inv_Current");
		else exportToJSON(exportData, "Inv_Current");
	}

	// ── Columns ───────────────────────────────────────────────────────────────
	const columns = [
		{ key: "itemValue", label: "Item" },
		{ key: "preQty", label: "Pre Qty" },
		{ key: "inQty", label: "In Qty" },
		{ key: "outQty", label: "Out Qty" },
		{ key: "stockQty", label: "Stock Qty" },
	];
</script>

<svelte:head>
	<title>Inv Current - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{data.currentMenu?.name ?? "Inv Current"}</h1>
			<p class="text-muted-foreground">{data.currentMenu?.desc ?? "Current Stock"}</p>
		</div>
	</div>

	<!-- Date Range Row -->
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2">
			<Label for="fromDate" class="text-xs text-muted-foreground">From</Label>
			<Input id="fromDate" type="date" class="w-36" bind:value={fromDate} />
		</div>
		<div class="flex items-center gap-2">
			<Label for="toDate" class="text-xs text-muted-foreground">To</Label>
			<Input id="toDate" type="date" class="w-36" bind:value={toDate} />
		</div>
	</div>

	<!-- Search + Actions Row -->
	<div class="flex items-center gap-2">
		<div class="relative max-w-sm flex-1">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input placeholder="Search items..." class="pl-9" bind:value={search} />
		</div>
		<Button variant="ghost" size="icon" class="size-8 shrink-0" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
		</Button>
		<p class="text-muted-foreground text-sm shrink-0">
			{filtered.length} item{filtered.length !== 1 ? "s" : ""}
		</p>
		<div class="ml-auto flex items-center gap-2 shrink-0">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="outline" size="sm" {...props}>
							<DownloadIcon class="mr-2 size-4" />
							Export
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item onclick={() => handleExport("csv")}>Export as CSV</DropdownMenu.Item>
					<DropdownMenu.Item onclick={() => handleExport("json")}>Export as JSON</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<!-- Table -->
	<div class="w-full overflow-x-auto rounded-md border">
		<Table.Root class="whitespace-nowrap">
			<Table.Header>
				<Table.Row>
					{#each columns as col, i (col.key)}
						{@const SortIcon = sortIcon(col.key)}
						<Table.Head class={i < columns.length - 1 ? 'border-r border-border/50' : ''}>
							<button
								class="flex items-center gap-1 text-left font-medium"
								onclick={() => toggleSort(col.key)}
							>
								{col.label}
								<SortIcon class="text-muted-foreground size-3" />
							</button>
						</Table.Head>
					{/each}
					</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as row (row.tranItem)}
					<Table.Row>
						<Table.Cell class="border-r border-border/50 font-medium">{row.itemValue}</Table.Cell>
						<Table.Cell class="border-r border-border/50 text-right">{formatStdPrice(row.preQty, data.formatQty)}</Table.Cell>
						<Table.Cell class="border-r border-border/50 text-right">{formatStdPrice(row.inQty, data.formatQty)}</Table.Cell>
						<Table.Cell class="border-r border-border/50 text-right">{formatStdPrice(row.outQty, data.formatQty)}</Table.Cell>
						<Table.Cell class="text-right font-semibold">{formatStdPrice(row.stockQty, data.formatQty)}</Table.Cell>
				</Table.Row>
			{:else}
				<Table.Row>
					<Table.Cell colspan={5} class="h-24 text-center">
							{search || fromDate || toDate ? "No items match your filters." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

