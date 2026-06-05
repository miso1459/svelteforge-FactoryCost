<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import Template01FormDialog from "./template01-form-dialog.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { ITEM_ACCT } from "$lib/(user)/Common/DropdownLists.js";

	let { data, form } = $props();

	let search = $state("");
	let createOpen = $state(false);
	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let sortKey = $state<string>("code");
	let sortDir = $state<"asc" | "desc">("asc");
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<string>());

	let editData = $state<{
		code: string;
		desc: string;
		remark: string | null;
		itemAcct: string;
		dateValid: Date | null;
	} | null>(null);
	let deleteId = $state("");

	// Resolve item_acct code to display value
	function itemAcctLabel(code: string): string {
		const item = ITEM_ACCT.list.find((i) => i.code === code);
		return item ? `${item.value} (${item.code})` : code;
	}

	const filtered = $derived(
		data.records.filter(
			(r) =>
				r.code.toLowerCase().includes(search.toLowerCase()) ||
				r.desc.toLowerCase().includes(search.toLowerCase()) ||
				(r.remark ?? "").toLowerCase().includes(search.toLowerCase()) ||
				itemAcctLabel(r.itemAcct).toLowerCase().includes(search.toLowerCase()) ||
				r.createdBy.toLowerCase().includes(search.toLowerCase()) ||
				r.updatedBy.toLowerCase().includes(search.toLowerCase())
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

	function toggleSelect(code: string) {
		const next = new Set(selectedIds);
		if (next.has(code)) next.delete(code);
		else next.add(code);
		selectedIds = next;
	}

	function toggleSelectAll() {
		if (selectedIds.size === paginated.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(paginated.map((r) => r.code));
		}
	}

	function formatDate(date: Date | null) {
		if (!date) return "—";
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		}).format(new Date(date));
	}

	function formatDateTime(date: Date | null) {
		if (!date) return "—";
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}).format(new Date(date));
	}

	function openEdit(record: (typeof data.records)[0]) {
		editData = {
			code: record.code,
			desc: record.desc,
			remark: record.remark,
			itemAcct: record.itemAcct,
			dateValid: record.dateValid,
		};
		editOpen = true;
	}

	function openDelete(code: string) {
		deleteId = code;
		deleteOpen = true;
	}

	function handleExport(format: "csv" | "json") {
		const exportData = filtered.map((r) => ({
			code: r.code,
			desc: r.desc,
			remark: r.remark ?? "",
			itemAcct: itemAcctLabel(r.itemAcct),
			dateValid: formatDate(r.dateValid),
			createdBy: r.createdBy,
			updatedBy: r.updatedBy,
			createdAt: formatDateTime(r.createdAt),
			updatedAt: formatDateTime(r.updatedAt),
		}));
		if (format === "csv") exportToCSV(exportData, "template01");
		else exportToJSON(exportData, "template01");
	}

	const columns = [
		{ key: "code", label: "Code" },
		{ key: "desc", label: "Desc" },
		{ key: "remark", label: "Remark" },
		{ key: "itemAcct", label: "Item Acct" },
		{ key: "dateValid", label: "Date Valid" },
		{ key: "createdBy", label: "Created By" },
		{ key: "updatedBy", label: "Updated By" },
		{ key: "createdAt", label: "Created At" },
		{ key: "updatedAt", label: "Updated At" },
	];
</script>

<svelte:head>
	<title>Template 01 - SvelteForge Admin</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Template 01</h1>
			<p class="text-muted-foreground">Manage template records.</p>
		</div>
		<Button onclick={() => (createOpen = true)}>
			<PlusIcon class="mr-2 size-4" />
			Add Record
		</Button>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2">
		<div class="relative max-w-sm flex-1">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input placeholder="Search records..." class="pl-9" bind:value={search} />
		</div>
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
	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-[40px]">
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
					<Table.Head class="w-[100px]">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as record (record.code)}
					<Table.Row class={selectedIds.has(record.code) ? "bg-muted/50" : ""}>
						<Table.Cell>
							<input
								type="checkbox"
								checked={selectedIds.has(record.code)}
								onchange={() => toggleSelect(record.code)}
								class="accent-primary size-4"
							/>
						</Table.Cell>
						<Table.Cell class="font-medium font-mono">{record.code}</Table.Cell>
						<Table.Cell>{record.desc}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{record.remark ?? "—"}</Table.Cell>
						<Table.Cell>{itemAcctLabel(record.itemAcct)}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{formatDate(record.dateValid)}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{record.createdBy}</Table.Cell>
						<Table.Cell class="text-muted-foreground">{record.updatedBy}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-sm">{formatDateTime(record.createdAt)}</Table.Cell>
						<Table.Cell class="text-muted-foreground text-sm">{formatDateTime(record.updatedAt)}</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1">
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openEdit(record)}>
									<PencilIcon class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8"
									onclick={() => openDelete(record.code)}
								>
									<TrashIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={11} class="h-24 text-center">
							{search ? "No records match your search." : "No records found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filtered.length} bind:pageSize bind:currentPage />
	</div>
</div>

<Template01FormDialog bind:open={createOpen} mode="create" />
<Template01FormDialog bind:open={editOpen} mode="edit" data={editData} />
<DeleteConfirmDialog bind:open={deleteOpen} action="?/delete" id={deleteId} itemName="record" />
