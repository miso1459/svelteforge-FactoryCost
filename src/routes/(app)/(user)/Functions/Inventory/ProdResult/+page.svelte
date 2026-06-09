<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import ProdResultFormDialog from "./prod-result-form-dialog.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import UndoIcon from "@lucide/svelte/icons/undo-2";
	import SaveIcon from "@lucide/svelte/icons/save";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { TRAN_TYPE } from "$lib/(user)/Common/DropdownLists.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import { formatStdPrice } from "$lib/utils/format.js";
	import { SvelteSet } from "svelte/reactivity";

	let { data, form } = $props();
	// data.records: InvTran[]
	// data.formatQty: string
	// data.currentMenu: { name, desc } | null
	// data.itemInfo: { title: string; list: { code: string; value: string }[] }

	// ── Date range (T03 pattern) ─────────────────────────────────────────────
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
	let createOpen = $state(false);
	let deleteOpen = $state(false);
	let sortKey = $state<string>("id");
	let sortDir = $state<"asc" | "desc">("desc");
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<string>());

	// ── Parent-Child Expand State ──────────────────────────────────────────
	let expanded = new SvelteSet<number>();

	function toggleExpand(id: number) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
		expanded = expanded; // trigger reactivity
	}

	// ── Records with depth (parent-child hierarchy) ────────────────────────
	type RecordWithDepth = (typeof data.records)[number] & { depth: number };

	// Build a map of R03 id -> I01 children
	const r03ToI01Map = $derived.by(() => {
		const map = new Map<number, typeof data.records>();
		for (const r of data.records) {
			if (r.tranType === 'I01' && r.prodId) {
				const parentId = Number(r.prodId);
				if (!map.has(parentId)) map.set(parentId, []);
				map.get(parentId)!.push(r);
			}
		}
		return map;
	});

	// Flatten records with depth for table display
	const recordsWithDepth = $derived.by(() => {
		const result: RecordWithDepth[] = [];

		// Group records by type
		const r03Records: typeof data.records = [];
		const i01Records: typeof data.records = [];
		const i02Records: typeof data.records = [];

		for (const record of data.records) {
			if (record.tranType === 'R03') {
				r03Records.push(record);
			} else if (record.tranType === 'I01') {
				i01Records.push(record);
			} else if (record.tranType === 'I02') {
				i02Records.push(record);
			}
		}

		// Build R03 -> I01 children map
		const r03ToI01 = new Map<number, typeof i01Records>();
		for (const i01 of i01Records) {
			if (i01.prodId) {
				const parentId = Number(i01.prodId);
				if (!r03ToI01.has(parentId)) r03ToI01.set(parentId, []);
				r03ToI01.get(parentId)!.push(i01);
			}
		}

		// Build I01 -> R03 parent map (for sorting)
		const i01ToR03 = new Map<number, number>();
		for (const i01 of i01Records) {
			if (i01.prodId) {
				i01ToR03.set(i01.id, Number(i01.prodId));
			}
		}

		// Sort I01 records by their parent R03's order
		const r03Order = new Map<number, number>();
		r03Records.forEach((r, idx) => r03Order.set(r.id, idx));
		i01Records.sort((a, b) => {
			const orderA = r03Order.get(i01ToR03.get(a.id) ?? -1) ?? -1;
			const orderB = r03Order.get(i01ToR03.get(b.id) ?? -1) ?? -1;
			return orderA - orderB;
		});

		// Interleave R03 and its I01 children
		for (const r03 of r03Records) {
			result.push({ ...r03, depth: 0 });
			if (expanded.has(r03.id)) {
				const children = r03ToI01.get(r03.id) ?? [];
				for (const child of children) {
					result.push({ ...child, depth: 1 });
				}
			}
		}

		// Add I02 records (independent, no hierarchy)
		for (const i02 of i02Records) {
			result.push({ ...i02, depth: 0 });
		}

		return result;
	});

	// Check if R03 has I01 children
	function hasI01Children(r03Id: number): boolean {
		return r03ToI01Map.has(r03Id) && r03ToI01Map.get(r03Id)!.length > 0;
	}

	// ── Inline Edit State ────────────────────────────────────────────────────
	let changes = $state<Record<number, {
		documentDt: string;
		tranType: string;
		tranItem: string;
		tranQty: number | null;
		tranRemark: string;
	}>>({});
	const hasChanges = $derived(Object.keys(changes).length > 0);

	let qtyDisplays = $state<Record<number, string>>({});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function updateInlineChange(id: number, field: string, value: any) {
		const original = data.records.find((r) => r.id === id);
		if (!original) return;

		if (!changes[id]) {
			changes[id] = {
				documentDt: original.documentDt ? new Date(original.documentDt).toISOString().slice(0, 10) : "",
				tranType: original.tranType,
				tranItem: original.tranItem,
				tranQty: original.tranQty,
				tranRemark: original.tranRemark ?? "",
			};
		}

		if (field === "documentDt") changes[id].documentDt = value;
		if (field === "tranType") changes[id].tranType = value;
		if (field === "tranItem") changes[id].tranItem = value;
		if (field === "tranQty") changes[id].tranQty = value === "" || value === null ? null : parseFloat(value) || 0;
		if (field === "tranRemark") changes[id].tranRemark = value;

		// Remove if back to original
		const c = changes[id];
		const origDt = original.documentDt ? new Date(original.documentDt).toISOString().slice(0, 10) : "";
		const isSame =
			c.documentDt === origDt &&
			c.tranType === original.tranType &&
			c.tranItem === original.tranItem &&
			c.tranQty === original.tranQty &&
			c.tranRemark === (original.tranRemark ?? "");

		if (isSame) {
			const next = { ...changes };
			delete next[id];
			changes = next;
		}
	}

	function revertAllChanges() {
		changes = {};
		qtyDisplays = {};
		toast.success("All changes reverted.");
	}

	let deleteId = $state("");
	let auditOpen = $state(false);
	let auditRecord = $state<{
		createdBy: string;
		updatedBy: string;
		createdAt: Date | null;
		updatedAt: Date | null;
	} | null>(null);

	// Resolve TRAN_TYPE code to display value
	function tranTypeLabel(code: string): string {
		const item = TRAN_TYPE.list.find((i) => i.code === code);
		return item ? item.value : code;
	}

	const tranTypeItems = $derived(TRAN_TYPE.list.filter((i) => i.opt2 === "1"));
	const tranItemItems = $derived(data.itemInfo.list);

	// Per-row dropdown: active items + current row's item if inactive (not in active list)
	const getTranItemItemsWithCurrent = (rowTranItem: string) => {
		const activeItems = data.itemInfo.list;
		const activeCodes = new Set(activeItems.map((i) => i.code));
		if (activeCodes.has(rowTranItem)) return activeItems;
		// Current item is inactive — prepend it so it appears at top
		const currentItem = data.allItemInfoMap?.get(rowTranItem);
		if (currentItem) {
			return [{ code: rowTranItem, value: currentItem.value, stdPrice: currentItem.stdPrice }, ...activeItems];
		}
		return activeItems;
	};

	const dateFiltered = $derived(() => {
		const from = parseDate(fromDate);
		const toEnd = parseDate(toDate);
		toEnd.setHours(23, 59, 59, 999);
		return recordsWithDepth.filter((r) => {
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
				r.tranType.toLowerCase().includes(search.toLowerCase()) ||
				r.tranItem.toLowerCase().includes(search.toLowerCase()) ||
				String(r.tranQty).includes(search) ||
				(r.tranRemark ?? "").toLowerCase().includes(search.toLowerCase()) ||
				tranTypeLabel(r.tranType).toLowerCase().includes(search.toLowerCase()) ||
				dateSearchStrings(r.documentDt).some((s) => s.includes(search))
		)
	);

	const sorted = $derived(() => {
		// Group R03 with its I01 children, then sort
		const r03Map = new Map<number, typeof filtered>();
		const standalone: typeof filtered = [];

		for (const item of filtered) {
			if (item.tranType === 'R03') {
				r03Map.set(item.id, [item]);
			} else if (item.tranType === 'I01' && item.prodId) {
				const parentId = Number(item.prodId);
				if (!r03Map.has(parentId)) r03Map.set(parentId, []);
				r03Map.get(parentId)!.push(item);
			} else {
				standalone.push(item);
			}
		}

		// Sort R03 by the selected column
		const r03Entries = Array.from(r03Map.entries());
		r03Entries.sort(([aId, aItems], [bId, bItems]) => {
			const aVal = String((aItems[0] as Record<string, unknown>)[sortKey] ?? "");
			const bVal = String((bItems[0] as Record<string, unknown>)[sortKey] ?? "");
			const cmp = aVal.localeCompare(bVal);
			return sortDir === "asc" ? cmp : -cmp;
		});

		// Flatten: R03 followed by its I01 children
		const grouped = r03Entries.flatMap(([, items]) => items);

		// Sort standalone (I02) by selected column
		standalone.sort((a, b) => {
			const aVal = String((a as Record<string, unknown>)[sortKey] ?? "");
			const bVal = String((b as Record<string, unknown>)[sortKey] ?? "");
			const cmp = aVal.localeCompare(bVal);
			return sortDir === "asc" ? cmp : -cmp;
		});

		return [...grouped, ...standalone];
	});

	const paginated = $derived(sorted().slice((currentPage - 1) * pageSize, currentPage * pageSize));

	$effect(() => {
		search; fromDate; toDate;
		currentPage = 1;
	});

	function focusField(field: string, id?: number) {
		if (id !== undefined) {
			const el = document.getElementById(`${field}-${id}`);
			if (el) {
				const input = el.querySelector("input:not([type=hidden]), textarea, select, button") as HTMLElement | null;
				(input ?? el).focus();
			}
		}
	}

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
			const formAny = form as Record<string, unknown>;
			if (formAny.field) {
				focusField(formAny.field as string, formAny.id as number | undefined);
			}
		}
		if (form?.success) {
			toast.success("Record saved successfully");
			selectedIds = new Set();
			changes = {};
			qtyDisplays = {};
		}
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

	function toggleSelect(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectAll() {
		if (selectedIds.size === paginated.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(paginated.map((r) => String(r.id)));
		}
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

	function openDelete(id: number) {
		deleteId = String(id);
		deleteOpen = true;
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
			documentDt: formatDate(r.documentDt),
			tranType: tranTypeLabel(r.tranType),
			tranItem: r.tranItem,
			tranQty: r.tranQty,
			tranRemark: r.tranRemark ?? "",
		}));
		if (format === "csv") exportToCSV(exportData, "ProdResult");
		else exportToJSON(exportData, "ProdResult");
	}

	const columns = [
		{ key: "documentDt", label: "Document Dt" },
		{ key: "tranType", label: "Tran Type" },
		{ key: "tranItem", label: "Tran Item" },
		{ key: "tranQty", label: "Tran Qty" },
		{ key: "tranRemark", label: "Tran Remark" },
	];
</script>

<svelte:head>
	<title>Production Result - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{data.currentMenu?.name ?? "생산입고"}</h1>
			<p class="text-muted-foreground">{data.currentMenu?.desc ?? "생산입고 관리 (R03 사용자 등록, I01 자동 생성)"}</p>
		</div>
		<div class="flex items-center gap-2">
			{#if hasChanges}
				<Button variant="outline" size="sm" onclick={revertAllChanges} class="border-amber-500 text-amber-500 hover:bg-amber-500/10">
					<UndoIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<form method="POST" action="?/saveItems" use:enhance={() => { return async ({ result, update }) => { if (result.type === "success" || result.type === "redirect") { toast.success("Items saved successfully."); changes = {}; qtyDisplays = {}; } else if (result.type === "failure") { const errData = result.data as { message?: string; field?: string; id?: number } | undefined; if (errData?.message) toast.error(errData.message); if (errData?.field && errData?.id !== undefined) { focusField(errData.field, errData.id); } } await update(); }; }}>
					<input type="hidden" name="changes" value={JSON.stringify(Object.entries(changes).map(([id, val]) => ({ id: Number(id), documentDt: val.documentDt || null, tranType: val.tranType || null, tranItem: val.tranItem || null, tranQty: val.tranQty, tranRemark: val.tranRemark || null })))} />
					<Button size="sm" type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
						<SaveIcon class="mr-2 size-4" />
						Save
					</Button>
				</form>
			{/if}
			<Button onclick={() => (createOpen = true)}>
				<PlusIcon class="mr-2 size-4" />
				생산입고 추가
			</Button>
		</div>
	</div>

	<!-- Date Range Row (T03 pattern) -->
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
			{#if selectedIds.size > 0}
				<form method="POST" action="?/bulkDelete" use:enhance>
					<input type="hidden" name="ids" value={[...selectedIds].join(",")} />
					<Button variant="destructive" size="sm" type="submit">
						<TrashIcon class="mr-2 size-4" />
						Delete {selectedIds.size}
					</Button>
				</form>
			{/if}
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
					<Table.Head class="sticky left-0 z-[1] w-[40px] bg-background">
						<input
							type="checkbox"
							checked={paginated.length > 0 && selectedIds.size === paginated.length}
							onchange={toggleSelectAll}
							class="accent-primary size-4"
						/>
					</Table.Head>
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
					<Table.Head class="sticky right-0 z-[1] w-[140px] bg-background">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as record (record.id)}
					{@const rid = String(record.id)}
					{@const isModified = Boolean(changes[record.id])}
					{@const isEditable = record.tranType === 'R03'}
					{@const isParent = record.tranType === 'R03'}
					{@const hasChildren = isParent && hasI01Children(record.id)}
					{@const depth = (record as any).depth ?? 0}
					<Table.Row class={[
						selectedIds.has(rid) ? 'bg-muted/50' : '',
						isModified ? 'bg-amber-500/10 dark:bg-amber-500/20' : '',
						'[&>td]:align-top [&>td]:pb-0'
					].filter(Boolean).join(' ')}>
						<Table.Cell class="sticky left-0 z-[1] bg-background">
							<div class="flex items-center gap-1" style="margin-left: {depth * 1.5}rem">
								<!-- Expand/collapse button for parent rows -->
								{#if isParent && hasChildren}
									<button
										type="button"
										class="text-muted-foreground hover:text-foreground flex items-center p-0.5"
										onclick={() => toggleExpand(record.id)}
									>
										{#if expanded.has(record.id)}
											<ChevronDownIcon class="size-4" />
										{:else}
											<ChevronRightIcon class="size-4" />
										{/if}
									</button>
								{:else if isParent}
									<span class="w-5"></span>
								{:else}
									<!-- Child rows show indent but no toggle -->
									<span class="w-5"></span>
								{/if}
								<input
									type="checkbox"
									checked={selectedIds.has(rid)}
									onchange={() => toggleSelect(rid)}
									class="accent-primary size-4"
									disabled={!isEditable}
								/>
							</div>
						</Table.Cell>
						<Table.Cell class="font-medium">
							<div class="w-36" id="documentDt-{record.id}">
								{#if isEditable}
									<Input
										type="date"
										value={changes[record.id]?.documentDt ?? (record.documentDt ? new Date(record.documentDt).toISOString().slice(0, 10) : "")}
										oninput={(e) => updateInlineChange(record.id, "documentDt", (e.target as HTMLInputElement).value)}
										class="h-8 text-xs border-amber-400 focus-visible:ring-amber-400"
									/>
								{:else}
									<span class="text-xs py-1 px-2 block h-8 leading-6">
										{record.documentDt ? new Date(record.documentDt).toISOString().slice(0, 10) : "—"}
									</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-36" id="tranType-{record.id}">
								<span class="text-xs py-1 px-2 block h-8 leading-6">{tranTypeLabel(record.tranType)}</span>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-48" id="tranItem-{record.id}">
								{#if isEditable}
									<SearchableSelect
										items={getTranItemItemsWithCurrent(record.tranItem)}
										bind:value={() => changes[record.id]?.tranItem ?? record.tranItem, (v) => updateInlineChange(record.id, "tranItem", v)}
										placeholder="Select item..."
										class="h-8 text-xs border-amber-400 focus-visible:ring-amber-400"
									/>
								{:else}
									<span class="text-xs py-1 px-2 block h-8 leading-6">{record.tranItem}</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-28" id="tranQty-{record.id}">
								{#if isEditable}
									<Input
										type="text"
										inputmode="decimal"
										value={qtyDisplays[record.id] ?? formatStdPrice(changes[record.id]?.tranQty ?? record.tranQty, data.formatQty)}
										oninput={(e) => {
											const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, "");
											qtyDisplays[record.id] = raw;
											updateInlineChange(record.id, "tranQty", raw === "" ? null : raw);
										}}
										onblur={() => {
											const val = changes[record.id]?.tranQty ?? record.tranQty;
											qtyDisplays[record.id] = formatStdPrice(val, data.formatQty);
										}}
										class="h-8 text-right text-xs border-amber-400 focus-visible:ring-amber-400"
									/>
								{:else}
									<span class="text-xs py-1 px-2 block h-8 leading-6 text-right">{formatStdPrice(record.tranQty, data.formatQty)}</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-48">
								{#if isEditable}
									<Textarea
										value={changes[record.id]?.tranRemark ?? record.tranRemark ?? ""}
										oninput={(e) => updateInlineChange(record.id, "tranRemark", (e.target as HTMLTextAreaElement).value)}
										placeholder="—"
										class="text-xs min-h-[2rem] border-muted-foreground/20 focus-visible:ring-muted-foreground/40"
										rows={1}
									/>
								{:else}
									<span class="text-xs py-1 px-2 block min-h-[2rem] leading-6">{record.tranRemark ?? "—"}</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="sticky right-0 z-[1] bg-background">
							<div class="flex items-center gap-1">
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openAudit(record)}>
									<ScrollTextIcon class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8"
									onclick={() => openDelete(record.id)}
									disabled={!isEditable}
								>
									<TrashIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="h-24 text-center">
							{search || fromDate || toDate ? "No records match your filters." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

<ProdResultFormDialog bind:open={createOpen} mode="create" formatQty={data.formatQty} itemInfo={data.itemInfo} defaultDt={toDate} />
<DeleteConfirmDialog bind:open={deleteOpen} action="?/delete" id={deleteId} itemName="record" />

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
