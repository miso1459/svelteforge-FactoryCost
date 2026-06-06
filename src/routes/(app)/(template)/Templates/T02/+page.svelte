<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import Template02FormDialog from "./template02-form-dialog.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { ITEM_ACCT } from "$lib/(user)/Common/DropdownLists.js";

	let { data, form } = $props();

	// Date range: default From = Today-7, To = Today
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
	let createDate = $state(dateStr(today)); // for passing to create dialog

	let search = $state("");
	let createOpen = $state(false);
	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let sortKey = $state<string>("documentDt");
	let sortDir = $state<"asc" | "desc">("desc");
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<string>());

	let editData = $state<{
		documentDt: string;
		code: string;
		desc: string;
		remark: string | null;
		itemAcct: string;
		dateValid: Date | null;
	} | null>(null);
	let deleteId = $state("");
	let auditOpen = $state(false);
	let auditRecord = $state<{
		createdBy: string;
		updatedBy: string;
		createdAt: Date | null;
		updatedAt: Date | null;
	} | null>(null);

	function pkFmt(dt: Date | null) {
		if (!dt) return "";
		const d = new Date(dt);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	}

	// Resolve item_acct code to display value
	function itemAcctLabel(code: string): string {
		const item = ITEM_ACCT.list.find((i) => i.code === code);
		return item ? `${item.value} (${item.code})` : code;
	}

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

	const filtered = $derived(
		dateFiltered().filter(
			(r) =>
				r.code.toLowerCase().includes(search.toLowerCase()) ||
				r.desc.toLowerCase().includes(search.toLowerCase()) ||
				(r.remark ?? "").toLowerCase().includes(search.toLowerCase()) ||
				itemAcctLabel(r.itemAcct).toLowerCase().includes(search.toLowerCase()) ||
				dateSearchStrings(r.documentDt).some((s) => s.includes(search)) ||
				dateSearchStrings(r.dateValid).some((s) => s.includes(search))
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

	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) {
			toast.success("Record saved successfully");
			selectedIds = new Set();
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

	function compositeId(r: typeof data.records[0]) {
		return `${pkFmt(r.documentDt)}|${r.code}`;
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
			selectedIds = new Set(paginated.map((r) => compositeId(r)));
		}
	}

	function pad(n: number): string {
		return n.toString().padStart(2, "0");
	}

	function dateSearchStrings(date: Date | null): string[] {
		if (!date) return [];
		const d = new Date(date);
		const y = d.getFullYear();
		const mm = pad(d.getMonth() + 1);
		const dd = pad(d.getDate());
		return [`${y}${mm}${dd}`, `${y}-${mm}-${dd}`];
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

	function openEdit(record: (typeof data.records)[0]) {
		editData = {
			documentDt: pkFmt(record.documentDt),
			code: record.code,
			desc: record.desc,
			remark: record.remark,
			itemAcct: record.itemAcct,
			dateValid: record.dateValid,
		};
		editOpen = true;
	}

	function openDelete(dateStr: string, code: string) {
		deleteId = `${dateStr}|${code}`;
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

	function onOpenCreate() {
		createDate = toDate;
		createOpen = true;
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
			code: r.code,
			desc: r.desc,
			remark: r.remark ?? "",
			itemAcct: itemAcctLabel(r.itemAcct),
			dateValid: formatDate(r.dateValid),
		}));
		if (format === "csv") exportToCSV(exportData, "template02");
		else exportToJSON(exportData, "template02");
	}

	const columns = [
		{ key: "documentDt", label: "Document Dt" },
		{ key: "code", label: "Code" },
		{ key: "desc", label: "Desc" },
		{ key: "remark", label: "Remark" },
		{ key: "itemAcct", label: "Item Acct" },
		{ key: "dateValid", label: "Date Valid" },
	];
</script>

<svelte:head>
	<title>Template 02 - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Template 02</h1>
			<p class="text-muted-foreground">Manage template records with date range.</p>
		</div>
		<Button onclick={onOpenCreate}>
			<PlusIcon class="mr-2 size-4" />
			Add Record
		</Button>
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
				{#each paginated as record (compositeId(record))}
					{@const rid = compositeId(record)}
					<Table.Row class={selectedIds.has(rid) ? "bg-muted/50" : ""}>
						<Table.Cell class="sticky left-0 z-[1] bg-background">
							<input
								type="checkbox"
								checked={selectedIds.has(rid)}
								onchange={() => toggleSelect(rid)}
								class="accent-primary size-4"
							/>
						</Table.Cell>
						<Table.Cell class="font-medium">{formatDate(record.documentDt)}</Table.Cell>
						<Table.Cell class="font-mono">{record.code}</Table.Cell>
						<Table.Cell>{record.desc}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{record.remark ?? "—"}</Table.Cell>
						<Table.Cell>{itemAcctLabel(record.itemAcct)}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{formatDate(record.dateValid)}</Table.Cell>
						<Table.Cell class="sticky right-0 z-[1] bg-background">
							<div class="flex items-center gap-1">
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openAudit(record)}>
									<ScrollTextIcon class="size-4" />
								</Button>
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openEdit(record)}>
									<PencilIcon class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8"
									onclick={() => openDelete(rid, record.code)}
								>
									<TrashIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={8} class="h-24 text-center">
							{search ? "No records match your filters." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

<Template02FormDialog bind:open={createOpen} mode="create" defaultDt={createDate} />
<Template02FormDialog bind:open={editOpen} mode="edit" data={editData} />
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
