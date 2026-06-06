<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Select from "$lib/components/ui/select/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import DataTablePagination from "$lib/components/data-table-pagination.svelte";
	import DeleteConfirmDialog from "$lib/components/delete-confirm-dialog.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import TrashIcon from "@lucide/svelte/icons/trash-2";
	import SearchIcon from "@lucide/svelte/icons/search";
	import ArrowUpDownIcon from "@lucide/svelte/icons/arrow-up-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
	import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import type { CodeValue } from "$lib/(user)/Common/DropdownLists.js";
	import { SvelteSet } from "svelte/reactivity";

	let { data, form } = $props();

	// ── Type helpers ──────────────────────────────────────────────────────────
	type MenuFlat = (typeof data.flatMenus)[number];
	interface FlatItem {
		item: MenuFlat & { children: MenuFlat[] };
		depth: number;
	}

	// ── Search / Sort / Pagination ────────────────────────────────────────────
	let search = $state("");
	let createOpen = $state(false);
	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let sortKey = $state<string>("name");
	let sortDir = $state<"asc" | "desc">("asc");
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<string>());

	// ── Edit / Delete state ──────────────────────────────────────────────────
	let editRecord = $state<MenuFlat | null>(null);
	let deleteId = $state("");
	let deleteHasChildren = $state(false);

	// ── Form dialog state ────────────────────────────────────────────────────
	let formType = $state<"folder" | "link">("link");
	let formName = $state("");
	let formPath = $state("");
	let formIcon = $state("");
	let formRole = $state<string[]>(["guest"]);
	let formSortOrder = $state(0);
	let formParentId = $state("");
	let formIsActive = $state(true);

	// ── Hierarchical tree expand ─────────────────────────────────────────────
	let expanded = new SvelteSet<string>();
	let treeInitialized = $state(false);

	$effect(() => {
		const tree = data.menuTree;
		if (!treeInitialized && tree.length > 0) {
			function walk(nodes: typeof tree) {
				for (const node of nodes) {
					expanded.add(node.id);
					walk(node.children);
				}
			}
			walk(tree);
			treeInitialized = true;
		}
	});

	function toggleExpand(id: string) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	// ── Flat tree for rendering ──────────────────────────────────────────────
	const flatTree = $derived.by(() => {
		const result: FlatItem[] = [];
		function walk(nodes: (typeof data.menuTree)[number][], depth: number) {
			for (const node of nodes) {
				result.push({ item: node, depth });
				if (expanded.has(node.id) && node.children.length > 0) {
					walk(node.children, depth + 1);
				}
			}
		}
		walk(data.menuTree, 0);
		return result;
	});

	// ── Filtered tree (by search) ────────────────────────────────────────────
	const filteredTree = $derived.by(() => {
		if (!search.trim()) return flatTree;
		const q = search.toLowerCase();
		const matchedIds = new Set<string>();

		// Find matching items
		for (const fi of flatTree) {
			const matchName = fi.item.name.toLowerCase().includes(q);
			const matchPath = (fi.item.path ?? "").toLowerCase().includes(q);
			const matchType = fi.item.type.toLowerCase().includes(q);
			if (matchName || matchPath || matchType) {
				matchedIds.add(fi.item.id);
			}
		}

		// Include ancestor items so tree stays intact
		const included = new Set<string>();
		function collectAncestors(id: string) {
			if (included.has(id)) return;
			included.add(id);
			const menu = data.flatMenus.find((m) => m.id === id);
			if (menu?.parentId) collectAncestors(menu.parentId);
		}
		for (const id of matchedIds) collectAncestors(id);

		return flatTree.filter((fi) => included.has(fi.item.id));
	});

	// ── Sort filtered tree ───────────────────────────────────────────────────
	const sortedTree = $derived.by(() => {
		const arr = [...filteredTree];
		arr.sort((a, b) => {
			let aVal: string;
			let bVal: string;
			if (sortKey === "name") {
				aVal = a.item.name.toLowerCase();
				bVal = b.item.name.toLowerCase();
			} else if (sortKey === "type") {
				aVal = a.item.type;
				bVal = b.item.type;
			} else if (sortKey === "path") {
				aVal = a.item.path ?? "";
				bVal = b.item.path ?? "";
			} else if (sortKey === "isActive") {
				aVal = a.item.isActive ? "1" : "0";
				bVal = b.item.isActive ? "1" : "0";
			} else {
				aVal = String((a.item as Record<string, unknown>)[sortKey] ?? "");
				bVal = String((b.item as Record<string, unknown>)[sortKey] ?? "");
			}
			const cmp = aVal.localeCompare(bVal);
			return sortDir === "asc" ? cmp : -cmp;
		});
		return arr;
	});

	const paginated = $derived(
		sortedTree.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	$effect(() => {
		search;
		currentPage = 1;
	});

	// ── Form success/error ───────────────────────────────────────────────────
	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) {
			toast.success("Menu saved successfully");
			createOpen = false;
			editOpen = false;
			deleteOpen = false;
			selectedIds = new Set();
		}
	});

	// ── Sort helpers ─────────────────────────────────────────────────────────
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

	// ── Select helpers ───────────────────────────────────────────────────────
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
			selectedIds = new Set(paginated.map((fi) => fi.item.id));
		}
	}

	// ── Role helpers ─────────────────────────────────────────────────────────
	const ROLE_OPTIONS = ["admin", "editor", "viewer", "guest"] as const;

	function roleBadgeVariant(role: string): "default" | "secondary" | "outline" {
		switch (role) {
			case "admin":
				return "default";
			case "editor":
				return "secondary";
			default:
				return "outline";
		}
	}

	function typeBadgeVariant(type: string): "default" | "outline" {
		return type === "folder" ? "default" : "outline";
	}

	function isRoleSelected(role: string): boolean {
		return formRole.includes(role);
	}

	function handleRoleChange(role: string) {
		const filtered = formRole.filter((r) => r !== role);
		if (filtered.length === formRole.length) {
			formRole = [...formRole, role];
		} else {
			formRole = filtered.length > 0 ? filtered : ["guest"];
		}
	}

	function parseRoles(roleStr: string): string[] {
		try {
			const parsed = JSON.parse(roleStr);
			return Array.isArray(parsed) ? parsed : ["guest"];
		} catch {
			return ["guest"];
		}
	}

	// ── Parent folder options (exclude self & descendants when editing) ──────
	const parentOptions = $derived.by(() => {
		const result: CodeValue[] = [];

		function walk(items: (typeof data.menuTree)[number][], depth: number, skipChildren: boolean) {
			for (const node of items) {
				if (skipChildren) continue;
				const isSelf = Boolean(editRecord && node.id === editRecord.id);
				if (isSelf) {
					walk(node.children, depth + 1, true);
					continue;
				}
				if (editRecord && isDescendantOf(editRecord.id, node.id)) continue;
				if (node.type === "folder") {
					result.push({
						code: node.id,
						value: `${"\u2500".repeat(depth)} ${node.name}`,
					});
				}
				walk(node.children, depth + 1, false);
			}
		}
		walk(data.menuTree, 0, false);
		return result;
	});

	function isDescendantOf(ancestorId: string, childId: string): boolean {
		let current: string | null | undefined = childId;
		while (current) {
			if (current === ancestorId) return true;
			const node = data.flatMenus.find((m) => m.id === current);
			current = node?.parentId ?? null;
		}
		return false;
	}

	// ── Dialog openers ───────────────────────────────────────────────────────
	function resetForm() {
		formType = "link";
		formName = "";
		formPath = "";
		formIcon = "";
		formRole = ["guest"];
		formSortOrder = 0;
		formParentId = "";
		formIsActive = true;
	}

	function openCreate(presetParentId?: string) {
		resetForm();
		if (presetParentId) formParentId = presetParentId;
		createOpen = true;
	}

	function openEdit(item: MenuFlat) {
		editRecord = item;
		formType = item.type as "folder" | "link";
		formName = item.name;
		formPath = item.path ?? "";
		formIcon = item.icon ?? "";
		formRole = parseRoles(item.role);
		formSortOrder = item.sortOrder;
		formParentId = item.parentId ?? "";
		formIsActive = item.isActive;
		editOpen = true;
	}

	function openDelete(item: MenuFlat) {
		deleteId = item.id;
		deleteHasChildren = data.flatMenus.some((m) => m.parentId === item.id);
		deleteOpen = true;
	}

	// ── Refresh ──────────────────────────────────────────────────────────────
	let refreshing = $state(false);

	async function handleRefresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
		toast.success("Data refreshed");
	}

	// ── Export ───────────────────────────────────────────────────────────────
	function handleExport(format: "csv" | "json") {
		const exportData = filteredTree.map((fi) => ({
			name: fi.item.name,
			type: fi.item.type,
			path: fi.item.path ?? "",
			icon: fi.item.icon ?? "",
			role: fi.item.role,
			sortOrder: fi.item.sortOrder,
			isActive: fi.item.isActive,
		}));
		if (format === "csv") exportToCSV(exportData, "menus");
		else exportToJSON(exportData, "menus");
	}

	// ── Drag & Drop ──────────────────────────────────────────────────────────
	let draggedId = $state<string | null>(null);
	let dropOverId = $state<string | null>(null);
	let dropPosition = $state<"before" | "after" | "inside" | null>(null);

	function isAncestorOrSelf(ancestorId: string, childId: string): boolean {
		if (ancestorId === childId) return true;
		let current: string | null | undefined = childId;
		while (current) {
			const node = data.flatMenus.find((m) => m.id === current);
			current = node?.parentId ?? null;
			if (current === ancestorId) return true;
		}
		return false;
	}

	function handleDragStart(e: DragEvent, itemId: string) {
		draggedId = itemId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
		}
	}

	function handleDragOver(e: DragEvent, itemId: string) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}

		if (draggedId && isAncestorOrSelf(draggedId, itemId)) {
			if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
			dropOverId = null;
			dropPosition = null;
			return;
		}

		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const ratio = (e.clientY - rect.top) / rect.height;

		const targetItem = data.flatMenus.find((m) => m.id === itemId);
		const isFolder = targetItem?.type === "folder";

		if (isFolder && ratio > 0.3 && ratio < 0.7) {
			dropPosition = "inside";
		} else if (ratio < 0.5) {
			dropPosition = "before";
		} else {
			dropPosition = "after";
		}
		dropOverId = itemId;
	}

	function handleDragLeave(e: DragEvent) {
		if (
			e.currentTarget instanceof Node &&
			e.relatedTarget instanceof Node &&
			!e.currentTarget.contains(e.relatedTarget)
		) {
			dropOverId = null;
			dropPosition = null;
		}
	}

	async function handleDropWithSource(
		targetId: string,
		targetParentId: string | null,
		sourceDraggedId: string,
		currentDropPosition: "before" | "after" | "inside"
	) {
		if (sourceDraggedId === targetId) return;

		const circularCheckTarget =
			currentDropPosition === "inside" ? targetId : (targetParentId ?? "");
		if (circularCheckTarget && isAncestorOrSelf(sourceDraggedId, circularCheckTarget)) return;

		if (currentDropPosition === "inside") {
			const targetChildren = data.flatMenus
				.filter((m) => m.parentId === targetId)
				.sort((a, b) => a.sortOrder - b.sortOrder);

			const updates = targetChildren
				.filter((item) => item.id !== sourceDraggedId)
				.map((item, i) => ({
					id: item.id,
					parentId: targetId,
					sort_order: i,
				}));

			updates.push({
				id: sourceDraggedId,
				parentId: targetId,
				sort_order: updates.length,
			});

			const fd = new FormData();
			fd.append("updates", JSON.stringify(updates));
			const response = await fetch("?/reorderMenu", { method: "POST", body: fd });
			if (response.ok) await invalidateAll();
			return;
		}

		const siblings = data.flatMenus
			.filter((m) => (m.parentId ?? null) === (targetParentId ?? null))
			.sort((a, b) => a.sortOrder - b.sortOrder);

		const draggedIdx = siblings.findIndex((m) => m.id === sourceDraggedId);
		const targetIdx = siblings.findIndex((m) => m.id === targetId);

		if (draggedIdx < 0) {
			const insertAt = currentDropPosition === "before" ? targetIdx : targetIdx + 1;

			const updates = siblings.map((item, i) => ({
				id: item.id,
				parentId: targetParentId,
				sort_order: i >= insertAt ? i + 1 : i,
			}));

			updates.push({
				id: sourceDraggedId,
				parentId: targetParentId,
				sort_order: insertAt,
			});

			updates.sort((a, b) => a.sort_order - b.sort_order);
			const normalizedUpdates = updates.map((item, i) => ({ ...item, sort_order: i }));

			const fd = new FormData();
			fd.append("updates", JSON.stringify(normalizedUpdates));
			const response = await fetch("?/reorderMenu", { method: "POST", body: fd });
			if (response.ok) await invalidateAll();
			return;
		}

		const reordered = siblings.filter((m) => m.id !== sourceDraggedId);
		const draggedItem = siblings[draggedIdx];
		let insertAt = targetIdx;
		if (draggedIdx < targetIdx) {
			insertAt = targetIdx - 1;
		}
		if (currentDropPosition === "after" && draggedIdx > targetIdx) {
			insertAt = targetIdx + 1;
		}
		reordered.splice(insertAt, 0, draggedItem);

		const updates = reordered.map((item, i) => ({
			id: item.id,
			parentId: item.parentId ?? null,
			sort_order: i,
		}));

		const fd = new FormData();
		fd.append("updates", JSON.stringify(updates));
		const response = await fetch("?/reorderMenu", { method: "POST", body: fd });
		if (response.ok) await invalidateAll();
	}

	function handleDragEnd() {
		draggedId = null;
		dropOverId = null;
		dropPosition = null;
	}

	async function onDrop(e: DragEvent, targetId: string, targetParentId: string | null) {
		e.preventDefault();
		if (!draggedId || !dropPosition) {
			draggedId = null;
			dropOverId = null;
			dropPosition = null;
			return;
		}

		const sourceDraggedId = draggedId;
		const currentDropPosition = dropPosition;

		draggedId = null;
		dropOverId = null;
		dropPosition = null;

		await handleDropWithSource(targetId, targetParentId, sourceDraggedId, currentDropPosition);
	}

	// ── Drop indicator line classes ──────────────────────────────────────────
	function dropIndicatorClass(itemId: string, pos: "before" | "after"): string {
		if (dropOverId === itemId && dropPosition === pos) {
			return "h-0.5 rounded-full bg-primary pointer-events-none";
		}
		return "h-0";
	}

	const columns = [
		{ key: "name", label: "Name" },
		{ key: "type", label: "Type" },
		{ key: "role", label: "Roles" },
		{ key: "path", label: "Path" },
		{ key: "isActive", label: "Status" },
	];
</script>

<svelte:head>
	<title>Menus - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Menus</h1>
			<p class="text-muted-foreground">Manage navigation structure and menu hierarchy.</p>
		</div>
		<Button onclick={() => openCreate()}>
			<PlusIcon class="mr-2 size-4" />
			Add Menu
		</Button>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2">
		<div class="relative max-w-sm flex-1">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input placeholder="Search menus..." class="pl-9" bind:value={search} />
		</div>
		<Button variant="ghost" size="icon" class="size-8 shrink-0" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
		</Button>
		<p class="text-muted-foreground text-sm">
			{filteredTree.length} menu{filteredTree.length !== 1 ? "s" : ""}
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
					<Table.Head class="sticky right-0 z-[1] w-[100px] bg-background">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as fi (fi.item.id)}
					<!-- before indicator -->
					{#if dropOverId === fi.item.id && dropPosition === "before"}
						<Table.Row>
							<Table.Cell colspan={7} class="h-0.5 p-0">
								<div class="bg-primary h-full w-full rounded-full"></div>
							</Table.Cell>
						</Table.Row>
					{/if}

					<Table.Row
						class="{selectedIds.has(fi.item.id) ? 'bg-muted/50' : ''} {draggedId === fi.item.id ? 'opacity-50' : ''}"
						draggable={true}
						ondragstart={(e) => handleDragStart(e, fi.item.id)}
						ondragend={handleDragEnd}
						ondragover={(e) => handleDragOver(e, fi.item.id)}
						ondragleave={handleDragLeave}
						ondrop={(e) => onDrop(e, fi.item.id, fi.item.parentId ?? null)}
					>
						<Table.Cell class="sticky left-0 z-[1] bg-background">
							<input
								type="checkbox"
								checked={selectedIds.has(fi.item.id)}
								onchange={() => toggleSelect(fi.item.id)}
								class="accent-primary size-4"
							/>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1" style="margin-left: {fi.depth * 1.5}rem">
								<!-- Drag handle -->
								<div class="text-muted-foreground cursor-grab opacity-0 group-hover:opacity-100">
									<GripVerticalIcon class="size-4" />
								</div>
								<!-- Expand/collapse for folders -->
								{#if fi.item.type === "folder" && data.flatMenus.some((m) => m.parentId === fi.item.id)}
									<button
										type="button"
										class="text-muted-foreground hover:text-foreground flex items-center"
										onclick={() => toggleExpand(fi.item.id)}
									>
										{#if expanded.has(fi.item.id)}
											<ChevronDownIcon class="size-4" />
										{:else}
											<ChevronRightIcon class="size-4" />
										{/if}
									</button>
								{:else}
									<span class="w-4"></span>
								{/if}
								<span class="font-medium">{fi.item.name}</span>
							</div>
						</Table.Cell>
						<Table.Cell>
							<Badge variant={typeBadgeVariant(fi.item.type)} class="rounded-md">
								{fi.item.type}
							</Badge>
						</Table.Cell>
						<Table.Cell>
							<div class="flex items-center gap-1">
								{#each parseRoles(fi.item.role) as role (role)}
									<Badge variant={roleBadgeVariant(role)} class="rounded-md text-xs">
										{role}
									</Badge>
								{/each}
							</div>
						</Table.Cell>
						<Table.Cell class="text-muted-foreground">{fi.item.path ?? "—"}</Table.Cell>
						<Table.Cell>
							<Badge variant={fi.item.isActive ? "default" : "outline"} class="rounded-md">
								{fi.item.isActive ? "Active" : "Inactive"}
							</Badge>
						</Table.Cell>
						<Table.Cell class="sticky right-0 z-[1] bg-background">
							<div class="flex items-center gap-1">
								{#if fi.item.type === "folder"}
									<Button variant="ghost" size="icon" class="size-8" onclick={() => openCreate(fi.item.id)} title="Add child">
										<PlusIcon class="size-4" />
									</Button>
								{/if}
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openEdit(fi.item)} title="Edit">
									<PencilIcon class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8"
									onclick={() => openDelete(fi.item)}
									title="Delete"
								>
									<TrashIcon class="size-4" />
								</Button>
							</div>
						</Table.Cell>
					</Table.Row>

					<!-- after indicator -->
					{#if dropOverId === fi.item.id && dropPosition === "after"}
						<Table.Row>
							<Table.Cell colspan={7} class="h-0.5 p-0">
								<div class="bg-primary h-full w-full rounded-full"></div>
							</Table.Cell>
						</Table.Row>
					{/if}
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="h-24 text-center">
							{search ? "No menus match your search." : "No menus found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filteredTree.length} bind:pageSize bind:currentPage />
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<DeleteConfirmDialog bind:open={deleteOpen} action="?/delete" id={deleteId} itemName="menu" />
{#if deleteHasChildren && deleteOpen}
	<p class="text-muted-foreground mt-1 text-xs">Note: Menus with children cannot be deleted.</p>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════════
     Create / Edit Dialog
     ═══════════════════════════════════════════════════════════════════════════ -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add Menu</Dialog.Title>
			<Dialog.Description>Create a new menu item.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						createOpen = false;
					}
					await update();
				};
			}}
		>
			<div class="grid gap-4 py-4">
				<!-- Type -->
				<div class="grid gap-2">
					<Label for="create-type" class="text-amber-600 dark:text-amber-400">Type *</Label>
					<Select.Root
						type="single"
						value={formType}
						onValueChange={(v: string) => {
							if (v) formType = v as "folder" | "link";
						}}
					>
						<Select.Trigger id="create-type" class="w-full">
							{formType === "folder" ? "Folder" : "Link"}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="folder">Folder</Select.Item>
							<Select.Item value="link">Link</Select.Item>
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={formType} />
				</div>

				<!-- Name -->
				<div class="grid gap-2">
					<Label for="create-name" class="text-amber-600 dark:text-amber-400">Name *</Label>
					<Input id="create-name" name="name" bind:value={formName} required />
				</div>

				<!-- Path (only for link) -->
				{#if formType === "link"}
					<div class="grid gap-2">
						<Label for="create-path">Path</Label>
						<Input id="create-path" name="path" bind:value={formPath} placeholder="/example" />
					</div>
				{/if}

				<!-- Icon -->
				<div class="grid gap-2">
					<Label for="create-icon">Icon</Label>
					<Input id="create-icon" name="icon" bind:value={formIcon} placeholder="home, settings, ..." />
				</div>

				<!-- Role checkboxes -->
				<div class="grid gap-2">
					<Label>Roles</Label>
					<div class="flex flex-wrap gap-3">
						{#each ROLE_OPTIONS as role (role)}
							<label class="flex items-center gap-1.5 text-sm">
								<input
									type="checkbox"
									name="role"
									value={role}
									checked={isRoleSelected(role)}
									onchange={() => handleRoleChange(role)}
								/>
								{role}
							</label>
						{/each}
					</div>
				</div>

				<!-- Parent folder -->
				<div class="grid gap-2">
					<Label for="create-parent">Parent Folder</Label>
					<SearchableSelect
						items={[{ code: "", value: "\u2014 No Parent \u2014" }, ...parentOptions]}
						bind:value={formParentId}
						placeholder="Select parent folder..."
					/>
					<input type="hidden" name="parentId" value={formParentId} />
				</div>

				<!-- Sort order -->
				<div class="grid gap-2">
					<Label for="create-sortOrder">Sort Order</Label>
					<Input id="create-sortOrder" name="sortOrder" type="number" min="0" bind:value={formSortOrder} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
				<Button type="submit">Create</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Edit Menu</Dialog.Title>
			<Dialog.Description>Update menu item details.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						editOpen = false;
					}
					await update();
				};
			}}
		>
			{#if editRecord}
				<input type="hidden" name="id" value={editRecord.id} />
			{/if}
			<div class="grid gap-4 py-4">
				<!-- Type -->
				<div class="grid gap-2">
					<Label for="edit-type" class="text-amber-600 dark:text-amber-400">Type *</Label>
					<Select.Root
						type="single"
						value={formType}
						onValueChange={(v: string) => {
							if (v) formType = v as "folder" | "link";
						}}
					>
						<Select.Trigger id="edit-type" class="w-full">
							{formType === "folder" ? "Folder" : "Link"}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="folder">Folder</Select.Item>
							<Select.Item value="link">Link</Select.Item>
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="type" value={formType} />
				</div>

				<!-- Name -->
				<div class="grid gap-2">
					<Label for="edit-name" class="text-amber-600 dark:text-amber-400">Name *</Label>
					<Input id="edit-name" name="name" bind:value={formName} required />
				</div>

				<!-- Path (only for link) -->
				{#if formType === "link"}
					<div class="grid gap-2">
						<Label for="edit-path">Path</Label>
						<Input id="edit-path" name="path" bind:value={formPath} placeholder="/example" />
					</div>
				{/if}

				<!-- Icon -->
				<div class="grid gap-2">
					<Label for="edit-icon">Icon</Label>
					<Input id="edit-icon" name="icon" bind:value={formIcon} placeholder="home, settings, ..." />
				</div>

				<!-- Role checkboxes -->
				<div class="grid gap-2">
					<Label>Roles</Label>
					<div class="flex flex-wrap gap-3">
						{#each ROLE_OPTIONS as role (role)}
							<label class="flex items-center gap-1.5 text-sm">
								<input
									type="checkbox"
									name="role"
									value={role}
									checked={isRoleSelected(role)}
									onchange={() => handleRoleChange(role)}
								/>
								{role}
							</label>
						{/each}
					</div>
				</div>

				<!-- Parent folder -->
				<div class="grid gap-2">
					<Label for="edit-parent">Parent Folder</Label>
					<SearchableSelect
						items={[{ code: "", value: "\u2014 No Parent \u2014" }, ...parentOptions]}
						bind:value={formParentId}
						placeholder="Select parent folder..."
					/>
					<input type="hidden" name="parentId" value={formParentId} />
				</div>

				<!-- Sort order -->
				<div class="grid gap-2">
					<Label for="edit-sortOrder">Sort Order</Label>
					<Input id="edit-sortOrder" name="sortOrder" type="number" min="0" bind:value={formSortOrder} />
				</div>

				<!-- isActive -->
				<div class="flex items-center gap-2">
					<input type="hidden" name="isActive" value={formIsActive ? "true" : "false"} />
					<input
						type="checkbox"
						id="edit-isActive"
						checked={formIsActive}
						onchange={(e) => {
							formIsActive = e.currentTarget.checked;
						}}
					/>
					<Label for="edit-isActive">Active</Label>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
				<Button type="submit">Save Changes</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
