<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import MasterItemFormDialog from "./master-item-form-dialog.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
import { Switch } from "$lib/components/ui/switch/index.js";
import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
import UndoIcon from "@lucide/svelte/icons/undo-2";
import SaveIcon from "@lucide/svelte/icons/save";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Label } from "$lib/components/ui/label/index.js";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import { ITEM_ACCT, UNIT } from "$lib/(user)/Common/DropdownLists.js";
	import { formatStdPrice } from "$lib/utils/format.js";

	let { data, form } = $props();

	let search = $state("");
	let createOpen = $state(false);
	let deleteOpen = $state(false);
	let sortKey = $state<string>("itemCode");
	let sortDir = $state<"asc" | "desc">("asc");
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<string>());

	// ── Inline Edit State ────────────────────────────────────────────────────
	let changes = $state<Record<string, {
		itemDesc: string;
		itemSpec: string;
		itemUnit: string;
		stdPrice: number | null;
		isActive: boolean;
		itemRemark: string;
	}>>({});

	const hasChanges = $derived(Object.keys(changes).length > 0);

	let stdPriceDisplays = $state<Record<string, string>>({});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function updateInlineChange(id: string, field: string, value: any) {
		const original = data.records.find((r) => r.itemCode === id);
		if (!original) return;

		if (!changes[id]) {
			changes[id] = {
				itemDesc: original.itemDesc,
				itemSpec: original.itemSpec ?? "",
				itemUnit: original.itemUnit ?? "",
				stdPrice: original.stdPrice,
				isActive: original.isActive,
				itemRemark: original.itemRemark ?? "",
			};
		}

		if (field === "itemDesc") changes[id].itemDesc = value;
		if (field === "itemSpec") changes[id].itemSpec = value;
		if (field === "itemUnit") changes[id].itemUnit = value;
		if (field === "stdPrice") changes[id].stdPrice = value === "" || value === null ? null : parseFloat(value) || 0;
		if (field === "isActive") changes[id].isActive = value;
		if (field === "itemRemark") changes[id].itemRemark = value;

		// 원본과 동일하게 돌아왔는지 비교해서 제거
		const c = changes[id];
		const isSame =
			c.itemDesc === original.itemDesc &&
			c.itemSpec === (original.itemSpec ?? "") &&
			c.itemUnit === (original.itemUnit ?? "") &&
			c.stdPrice === original.stdPrice &&
			c.isActive === original.isActive &&
			c.itemRemark === (original.itemRemark ?? "");

		if (isSame) {
			const next = { ...changes };
			delete next[id];
			changes = next;
		}
	}

	function revertAllChanges() {
		changes = {};
		stdPriceDisplays = {};
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

	// Resolve item_acct code to display value
	function itemAcctLabel(code: string): string {
		const item = ITEM_ACCT.list.find((i) => i.code === code);
		return item ? `${item.value} (${item.code})` : code;
	}

	const unitItems = $derived(UNIT.list);

	const filtered = $derived(
		data.records.filter(
			(r) =>
				r.itemCode.toLowerCase().includes(search.toLowerCase()) ||
				r.itemDesc.toLowerCase().includes(search.toLowerCase()) ||
				(r.itemSpec ?? "").toLowerCase().includes(search.toLowerCase()) ||
				(r.itemUnit ?? "").toLowerCase().includes(search.toLowerCase()) ||
				(r.itemRemark ?? "").toLowerCase().includes(search.toLowerCase()) ||
				String(r.isActive).includes(search.toLowerCase()) ||
				itemAcctLabel(r.itemAcct).toLowerCase().includes(search.toLowerCase())
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
		// Reset page when search changes
		search;
		currentPage = 1;
	});

	function focusField(field: string, itemCode?: string) {
		if (itemCode) {
			const el = document.getElementById(`${field}-${itemCode}`);
			if (el) {
				const input = el.querySelector("input:not([type=hidden]), textarea, select, button") as HTMLElement | null;
				(input ?? el).focus();
				el.style.outline = "2px solid #fbbf24";
				el.style.outlineOffset = "2px";
			}
		}
	}

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
			const formAny = form as Record<string, unknown>;
			if (formAny.field) {
				focusField(formAny.field as string, formAny.itemCode as string | undefined);
			}
		}
		if (form?.success) {
			toast.success("Record saved successfully");
			selectedIds = new Set();
			changes = {};
			stdPriceDisplays = {};
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

	function toggleSelect(itemCode: string) {
		const next = new Set(selectedIds);
		if (next.has(itemCode)) next.delete(itemCode);
		else next.add(itemCode);
		selectedIds = next;
	}

	function toggleSelectAll() {
		if (selectedIds.size === paginated.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(paginated.map((r) => r.itemCode));
		}
	}

	function pad(n: number): string {
		return n.toString().padStart(2, "0");
	}

	function formatDateTime(date: Date | null) {
		if (!date) return "—";
		const d = new Date(date);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function openDelete(itemCode: string) {
		deleteId = itemCode;
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
			itemAcct: itemAcctLabel(r.itemAcct),
			itemCode: r.itemCode,
			itemDesc: r.itemDesc,
			itemSpec: r.itemSpec ?? "",
			itemUnit: r.itemUnit ?? "",
			stdPrice: r.stdPrice ?? "",
			isActive: r.isActive ? "Y" : "N",
			itemRemark: r.itemRemark ?? "",
		}));
		if (format === "csv") exportToCSV(exportData, "Master_Item");
		else exportToJSON(exportData, "Master_Item");
	}

	const columns = [
		{ key: "itemAcct", label: "Item Acct" },
		{ key: "itemCode", label: "Item Code" },
		{ key: "itemDesc", label: "Item Desc" },
		{ key: "itemSpec", label: "Item Spec" },
		{ key: "itemUnit", label: "Item Unit" },
		{ key: "stdPrice", label: "Std Price" },
		{ key: "isActive", label: "Is Active" },
		{ key: "itemRemark", label: "Item Remark" },
	];
</script>

<svelte:head>
	<title>Item Info - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{data.currentMenu?.name ?? "Item Info"}</h1>
			<p class="text-muted-foreground">{data.currentMenu?.desc ?? "Manage master item records."}</p>
		</div>
		<div class="flex items-center gap-2">
			{#if hasChanges}
				<Button variant="outline" size="sm" onclick={revertAllChanges} class="border-amber-500 text-amber-500 hover:bg-amber-500/10">
					<UndoIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<form method="POST" action="?/saveItems" use:enhance={() => { return async ({ result, update }) => { if (result.type === "success" || result.type === "redirect") { toast.success("Items saved successfully."); changes = {}; stdPriceDisplays = {}; } else if (result.type === "failure") { const data = result.data as { message?: string; field?: string; itemCode?: string } | undefined; if (data?.message) toast.error(data.message); if (data?.field && data?.itemCode !== undefined) { focusField(data.field, data.itemCode); } } await update(); }; }}>
					<input type="hidden" name="changes" value={JSON.stringify(Object.entries(changes).map(([id, val]) => ({ itemCode: id, itemDesc: val.itemDesc, itemSpec: val.itemSpec || null, itemUnit: val.itemUnit || null, stdPrice: val.stdPrice, isActive: val.isActive, itemRemark: val.itemRemark || null })))} />
					<Button size="sm" type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
						<SaveIcon class="mr-2 size-4" />
						Save
					</Button>
				</form>
			{/if}
			<Button onclick={() => (createOpen = true)}>
				<PlusIcon class="mr-2 size-4" />
				Add Item
			</Button>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2">
		<div class="relative max-w-sm flex-1">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input placeholder="Search records..." class="pl-9" bind:value={search} />
		</div>
		<Button variant="ghost" size="icon" class="size-8 shrink-0" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
		</Button>
		<p class="text-muted-foreground text-sm">
			{filtered.length} record{filtered.length !== 1 ? "s" : ""}
		</p>

		<div class="ml-auto flex items-center gap-2">
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
				{#each paginated as record (record.itemCode)}
					{@const isModified = Boolean(changes[record.itemCode])}
					<Table.Row class={[
						selectedIds.has(record.itemCode) ? 'bg-muted/50' : '',
						isModified ? 'bg-amber-500/10 dark:bg-amber-500/20' : '',
						'[&>td]:align-top [&>td]:pb-0'
					].filter(Boolean).join(' ')}>
						<Table.Cell class="sticky left-0 z-[1] bg-background">
							<input
								type="checkbox"
								checked={selectedIds.has(record.itemCode)}
								onchange={() => toggleSelect(record.itemCode)}
								class="accent-primary size-4"
							/>
						</Table.Cell>
						<Table.Cell>
							<div class="border-purple-400 border rounded px-2 py-1 text-xs bg-muted/30 dark:bg-zinc-800">{itemAcctLabel(record.itemAcct)}</div>
						</Table.Cell>
						<Table.Cell>
							<div class="border-blue-400 border rounded px-2 py-1 text-xs font-mono font-medium bg-muted/30 dark:bg-zinc-800">{record.itemCode}</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-48" id="itemDesc-{record.itemCode}">
								<Input
									value={changes[record.itemCode]?.itemDesc ?? record.itemDesc}
									oninput={(e) => updateInlineChange(record.itemCode, "itemDesc", (e.target as HTMLInputElement).value)}
									class="h-8 text-xs border-amber-400 focus-visible:ring-amber-400"
								/>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-32">
								<Input
									value={changes[record.itemCode]?.itemSpec ?? record.itemSpec ?? ""}
									oninput={(e) => updateInlineChange(record.itemCode, "itemSpec", (e.target as HTMLInputElement).value)}
									placeholder="—"
									class="h-8 text-xs border-muted-foreground/20 focus-visible:ring-muted-foreground/40"
								/>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-28">
								<SearchableSelect
									items={unitItems}
									bind:value={() => changes[record.itemCode]?.itemUnit ?? record.itemUnit ?? "", (v) => updateInlineChange(record.itemCode, "itemUnit", v)}
									placeholder="Select unit..."
									class="h-8 text-xs border-amber-400 focus-visible:ring-amber-400"
								/>
							</div>
						</Table.Cell>
						<Table.Cell>
							<div class="w-28">
								<Input
									type="text"
									inputmode="decimal"
									value={stdPriceDisplays[record.itemCode] ?? formatStdPrice(changes[record.itemCode]?.stdPrice ?? record.stdPrice, data.formatPrice)}
									oninput={(e) => {
										const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.-]/g, "");
										stdPriceDisplays[record.itemCode] = raw;
										updateInlineChange(record.itemCode, "stdPrice", raw === "" ? null : raw);
									}}
									onblur={() => {
										const val = changes[record.itemCode]?.stdPrice ?? record.stdPrice;
										stdPriceDisplays[record.itemCode] = formatStdPrice(val, data.formatPrice);
									}}
									class="h-8 text-right text-xs border-muted-foreground/20 focus-visible:ring-muted-foreground/40"
								/>
							</div>
						</Table.Cell>
						<Table.Cell>
							<Switch
								checked={changes[record.itemCode]?.isActive ?? record.isActive}
								onCheckedChange={(checked) => updateInlineChange(record.itemCode, "isActive", checked)}
							/>
						</Table.Cell>
						<Table.Cell>
							<div class="w-48">
								<Textarea
									value={changes[record.itemCode]?.itemRemark ?? record.itemRemark ?? ""}
									oninput={(e) => updateInlineChange(record.itemCode, "itemRemark", (e.target as HTMLTextAreaElement).value)}
									placeholder="—"
									class="text-xs min-h-[2rem] border-muted-foreground/20 focus-visible:ring-muted-foreground/40"
									rows={1}
								/>
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
									onclick={() => openDelete(record.itemCode)}
								>
									<TrashIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={10} class="h-24 text-center">
							{search ? "No records match your search." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

<MasterItemFormDialog bind:open={createOpen} mode="create" formatPrice={data.formatPrice} />
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