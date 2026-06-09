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
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { toast } from "svelte-sonner";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { TRAN_TYPE } from "$lib/(user)/Common/DropdownLists.js";
	import { formatStdPrice } from "$lib/utils/format.js";

	let { data } = $props();
	// data.records: InvTran[]
	// data.formatQty, data.formatPrice, data.formatAmount: string

	// ── Date range ───────────────────────────────────────────────────────
	const today = new Date();
	const defaultFrom = new Date(today);
	defaultFrom.setDate(defaultFrom.getDate() - 7);

	function dateStr(d: Date) {
		return d.toISOString().slice(0, 10);
	}

	function parseDate(s: string) {
		return new Date(s + "T00:00:00");
	}

	let fromDate = $state(dateStr(defaultFrom));
	let toDate = $state(dateStr(today));

	let search = $state("");
	let sortKey = $state<string>("id");
	let sortDir = $state<"asc" | "desc">("desc");
	let pageSize = $state(10);
	let currentPage = $state(1);

	let auditOpen = $state(false);
	let auditRecord = $state<{
		createdBy: string;
		updatedBy: string;
		createdAt: Date | null;
		updatedAt: Date | null;
	} | null>(null);

	function tranTypeLabel(code: string): string {
		const item = TRAN_TYPE.list.find((i) => i.code === code);
		return item ? item.value : code;
	}

	const columns = [
		{ key: "id", label: "ID" },
		{ key: "documentDt", label: "Document Dt" },
		{ key: "tranType", label: "Tran Type" },
		{ key: "tranItem", label: "Tran Item" },
		{ key: "tranPrice", label: "Tran Price" },
		{ key: "tranQty", label: "Tran Qty" },
		{ key: "tranAmount", label: "Tran Amount" },
		{ key: "tranRemark", label: "Tran Remark" },
	];

	const dateFiltered = $derived(() => {
		const from = parseDate(fromDate);
		const toEnd = parseDate(toDate);
		toEnd.setHours(23, 59, 59, 999);
		return data.records.filter((r) => {
			const d = r.documentDt ? new Date(r.documentDt) : null;
			if (!d) return false;
			return d >= from && d <= toEnd;
		});
	});

	function dateSearchStrings(date: Date | null): string[] {
		if (!date) return [];
		const d = new Date(date);
		const y = d.getFullYear();
		const mm = pad(d.getMonth() + 1);
		const dd = pad(d.getDate());
		return [`${y}${mm}${dd}`, `${y}-${mm}-${dd}`];
	}

	const filtered = $derived(
		dateFiltered().filter(
			(r) =>
				String(r.id).includes(search) ||
				r.tranType.toLowerCase().includes(search.toLowerCase()) ||
				r.tranItem.toLowerCase().includes(search.toLowerCase()) ||
				String(r.tranQty).includes(search) ||
				String(r.tranPrice).includes(search) ||
				String(r.tranAmount).includes(search) ||
				(r.tranRemark ?? "").toLowerCase().includes(search.toLowerCase()) ||
				tranTypeLabel(r.tranType).toLowerCase().includes(search.toLowerCase()) ||
				dateSearchStrings(r.documentDt).some((s) => s.includes(search))
		)
	);

	const sorted = $derived(() => {
		const arr = [...filtered];
		arr.sort((a, b) => {
			const aVal = String((a as Record<string, unknown>)[sortKey] ?? "");
			const bVal = String((b as Record<string, unknown>)[sortKey] ?? "");
			const cmp = aVal.localeCompare(bVal);
			return sortDir === "asc" ? cmp : -cmp;
		});
		return arr;
	});

	const paginated = $derived(sorted().slice((currentPage - 1) * pageSize, currentPage * pageSize));

	$effect(() => {
		search; fromDate; toDate;
		currentPage = 1;
	});

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

	function pad(n: number): string {
		return n.toString().padStart(2, "0");
	}

	function formatDate(date: Date | null) {
		if (!date) return "—";
		const d = new Date(date);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	function formatDateTime(date: Date | null) {
		if (!date) return "—";
		const d = new Date(date);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function openAudit(record: (typeof data.records)[0]) {
		auditRecord = {
			createdBy: record.createdBy,
			updatedBy: record.updatedBy,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		};
		auditOpen = true;
	}

	let refreshing = $state(false);

	async function handleRefresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
		toast.success("Data refreshed");
	}

	function handleExport(format: "csv" | "json") {
		const exportData = filtered.map((r) => ({
			id: r.id,
			documentDt: formatDate(r.documentDt),
			tranType: tranTypeLabel(r.tranType),
			tranItem: r.tranItem,
			tranPrice: r.tranPrice,
			tranQty: r.tranQty,
			tranAmount: r.tranAmount,
			tranRemark: r.tranRemark ?? "",
		}));
		if (format === "csv") exportToCSV(exportData, "InvTranHistory");
		else exportToJSON(exportData, "InvTranHistory");
	}
</script>

<svelte:head>
	<title>Inventory Transaction History - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Transaction History</h1>
			<p class="text-muted-foreground">View inventory transaction history</p>
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
			<Input placeholder="Search records..." class="pl-9" bind:value={search} />
		</div>
		<Button variant="ghost" size="icon" class="size-8 shrink-0" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
		</Button>
		<p class="text-muted-foreground text-sm shrink-0">
			{filtered.length} record{filtered.length !== 1 ? "s" : ""}
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
		<Table.Root class="whitespace-nowrap [&_td]:border-r [&_td]:border-muted-foreground/20 [&_th]:border-r [&_th]:border-muted-foreground/20 last:[&_td]:border-r-0 last:[&_th]:border-r-0">
			<Table.Header>
				<Table.Row>
					{#each columns as col (col.key)}
						{@const SortIcon = sortIcon(col.key)}
						<Table.Head>
							<button
								class="flex items-center gap-1 text-left font-medium"
								onclick={() => toggleSort(col.key)}
							>
								{col.label}
								<SortIcon class="text-muted-foreground size-3" />
							</button>
						</Table.Head>
					{/each}
					<Table.Head class="w-[60px]"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as record (record.id)}
					<Table.Row>
						<Table.Cell class="font-mono text-xs">{record.id}</Table.Cell>
						<Table.Cell class="text-xs">
							{record.documentDt ? new Date(record.documentDt).toISOString().slice(0, 10) : "—"}
						</Table.Cell>
						<Table.Cell class="text-xs">{tranTypeLabel(record.tranType)}</Table.Cell>
						<Table.Cell class="text-xs">{record.tranItem}</Table.Cell>
						<Table.Cell class="text-right text-xs">
							{formatStdPrice(record.tranPrice, data.formatPrice)}
						</Table.Cell>
						<Table.Cell class="text-right text-xs">
							{formatStdPrice(record.tranQty, data.formatQty)}
						</Table.Cell>
						<Table.Cell class="text-right text-xs">
							{formatStdPrice(record.tranAmount, data.formatAmount)}
						</Table.Cell>
						<Table.Cell class="text-xs max-w-[200px] truncate">{record.tranRemark ?? "—"}</Table.Cell>
						<Table.Cell>
							<Button variant="ghost" size="icon" class="size-8" onclick={() => openAudit(record)}>
								<ScrollTextIcon class="size-4" />
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={9} class="h-24 text-center">
							{search || fromDate || toDate ? "No records match your filters." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

<Dialog.Root bind:open={auditOpen}>
	<Dialog.Content class="sm:max-w-[400px]">
		<Dialog.Header>
			<Dialog.Title>Audit Trail</Dialog.Title>
			<Dialog.Description>Record creation and modification history.</Dialog.Description>
		</Dialog.Header>
		{#if auditRecord}
			<div class="grid gap-4 py-4">
				<div class="grid gap-1">
					<Label class="text-muted-foreground text-xs">Created By</Label>
					<p class="text-sm font-medium">{auditRecord.createdBy}</p>
				</div>
				<div class="grid gap-1">
					<Label class="text-muted-foreground text-xs">Updated By</Label>
					<p class="text-sm font-medium">{auditRecord.updatedBy}</p>
				</div>
				<div class="grid gap-1">
					<Label class="text-muted-foreground text-xs">Created At</Label>
					<p class="text-sm font-medium">{formatDateTime(auditRecord.createdAt)}</p>
				</div>
				<div class="grid gap-1">
					<Label class="text-muted-foreground text-xs">Updated At</Label>
					<p class="text-sm font-medium">{formatDateTime(auditRecord.updatedAt)}</p>
				</div>
			</div>
		{/if}
		<Dialog.Footer>
			<Button onclick={() => (auditOpen = false)}>Close</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
