<script lang="ts">
	import * as Table from "$lib/components/ui/table/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
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
	import DownloadIcon from "@lucide/svelte/icons/download";
	import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import SaveIcon from "@lucide/svelte/icons/save";
	import UndoIcon from "@lucide/svelte/icons/undo-2";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { invalidateAll } from "$app/navigation";
	import { exportToCSV, exportToJSON } from "$lib/utils/export.js";
	import { SvelteSet } from "svelte/reactivity";

	let { data, form } = $props();

	// ── Type helpers ──────────────────────────────────────────────────────────
	type BOMFlat = (typeof data.flatBOM)[number];
	interface FlatItem {
		item: BOMFlat & { children: BOMFlat[] };
		depth: number;
	}

	// ── Search / Pagination ───────────────────────────────────────────────────
	let search = $state("");
	let createOpen = $state(false);
	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let pageSize = $state(10);
	let currentPage = $state(1);
	let selectedIds = $state(new Set<number>());

	// ── Qty Formatting ─────────────────────────────────────────────────────
	function parseFormatPattern(format: string): { decimalPlaces: number; useGrouping: boolean } {
		const parts = format.split(".");
		const fracPart = parts[1] || "";
		const intPart = parts[0] || "";
		const decimalPlaces = [...fracPart].filter((c) => c === "0" || c === "#").length;
		const useGrouping = intPart.includes(",");
		return { decimalPlaces, useGrouping };
	}

	function formatQty(value: number, format: string): string {
		const { decimalPlaces, useGrouping } = parseFormatPattern(format);
		try {
			return new Intl.NumberFormat("en-US", {
				minimumFractionDigits: decimalPlaces,
				maximumFractionDigits: decimalPlaces,
				useGrouping,
			}).format(value);
		} catch {
			return value.toFixed(decimalPlaces);
		}
	}

	const qtyStep = $derived.by(() => {
		const { decimalPlaces } = parseFormatPattern(data.formatQty);
		if (decimalPlaces === 0) return "1";
		return "0." + "0".repeat(decimalPlaces - 1) + "1";
	});

	const qtyMin = $derived.by(() => {
		const { decimalPlaces } = parseFormatPattern(data.formatQty);
		if (decimalPlaces === 0) return "1";
		return "0." + "0".repeat(decimalPlaces - 1) + "1";
	});

	// ── Edit / Delete state ──────────────────────────────────────────────────
	let editRecord = $state<BOMFlat | null>(null);
	let deleteId = $state<number | null>(null);
	let deleteHasChildren = $state(false);

	// ── Audit Trail ────────────────────────────────────────────────────────────
	let auditOpen = $state(false);
	let auditRecord = $state<{
		createdBy: string;
		updatedBy: string;
		createdAt: Date | null;
		updatedAt: Date | null;
	} | null>(null);

	// ── Form dialog state ────────────────────────────────────────────────────
	let formParentId = $state("");
	let formParentQty = $state(1);
	let formItem = $state("");
	let formItemQty = $state(1);
	let formRemark = $state("");

	// ── Inline Edit State ────────────────────────────────────────────────────
	// 각 id 마다 변경된 사항을 저장할 상태 맵
	let changes = $state<Record<number, {
		BOM_item: string;
		BOM_item_qty: number;
		BOM_parent_qty: number;
		BOM_remark: string;
	}>>({});

	const hasChanges = $derived(Object.keys(changes).length > 0);

	function updateInlineChange(id: number, field: string, value: any) {
		const original = data.flatBOM.find(item => item.id === id);
		if (!original) return;

		if (!changes[id]) {
			changes[id] = {
				BOM_item: original.BOM_item,
				BOM_item_qty: original.BOM_item_qty,
				BOM_parent_qty: original.BOM_item_parent_qty,
				BOM_remark: original.BOM_remark ?? ""
			};
		}

		if (field === "BOM_item") changes[id].BOM_item = value;
		if (field === "BOM_item_qty") changes[id].BOM_item_qty = parseFloat(value) || 0;
		if (field === "BOM_parent_qty") changes[id].BOM_parent_qty = parseFloat(value) || 0;
		if (field === "BOM_remark") changes[id].BOM_remark = value;

		// 원본과 동일하게 돌아왔는지 비교해서 제거
		const c = changes[id];
		const isSame =
			c.BOM_item === original.BOM_item &&
			c.BOM_item_qty === original.BOM_item_qty &&
			c.BOM_parent_qty === original.BOM_item_parent_qty &&
			c.BOM_remark === (original.BOM_remark ?? "");

		if (isSame) {
			const next = { ...changes };
			delete next[id];
			changes = next;
		}
	}

	function revertAllChanges() {
		changes = {};
		toast.success("All changes reverted.");
	}

	// ── Hierarchical tree expand ─────────────────────────────────────────────
	let expanded = new SvelteSet<number>();
	let treeInitialized = $state(false);

	$effect(() => {
		const tree = data.bomTree;
		if (!treeInitialized && tree.length > 0) {
			function walk(nodes: typeof tree) {
				for (const node of nodes) {
					expanded.add(node.id);
					if (node.children) {
						walk(node.children);
					}
				}
			}
			walk(tree);
			treeInitialized = true;
		}
	});

	function toggleExpand(id: number) {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	// ── Flat tree for rendering ──────────────────────────────────────────────
	const flatTree = $derived.by(() => {
		const result: FlatItem[] = [];
		function walk(nodes: (typeof data.bomTree)[number][], depth: number) {
			for (const node of nodes) {
				result.push({ item: node, depth });
				if (expanded.has(node.id) && node.children && node.children.length > 0) {
					walk(node.children, depth + 1);
				}
			}
		}
		walk(data.bomTree, 0);
		return result;
	});

	// ── Filtered tree (by search) ────────────────────────────────────────────
	const filteredTree = $derived.by(() => {
		if (!search.trim()) return flatTree;
		const q = search.toLowerCase();
		const matchedIds = new Set<number>();

		// 매칭되는 아이템 찾기
		for (const fi of flatTree) {
			const itemInfo = data.itemsMap[fi.item.BOM_item];
			const matchItem = fi.item.BOM_item.toLowerCase().includes(q) ||
				(itemInfo?.itemDesc ?? "").toLowerCase().includes(q);
			const matchParent = (fi.item.BOM_item_parent ?? "").toLowerCase().includes(q);
			const matchRemark = (fi.item.BOM_remark ?? "").toLowerCase().includes(q);

			if (matchItem || matchParent || matchRemark) {
				matchedIds.add(fi.item.id);
			}
		}

		// 부모 조상들 트리 구조 유지를 위해 포함
		const included = new Set<number>();
		function collectAncestors(id: number) {
			if (included.has(id)) return;
			included.add(id);
			const node = data.flatBOM.find((m) => m.id === id);
			if (node?.BOM_item_parent) {
				// BOM_item_parent가 가리키는 부모 품목코드를 가진 행들의 id를 찾음
				const parentRows = data.flatBOM.filter((m) => m.BOM_item === node.BOM_item_parent);
				for (const p of parentRows) {
					collectAncestors(p.id);
				}
			}
		}
		for (const id of matchedIds) collectAncestors(id);

		return flatTree.filter((fi) => included.has(fi.item.id));
	});

	const paginated = $derived(
		filteredTree.slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);

	$effect(() => {
		search;
		currentPage = 1;
	});

	// ── Form success/error ───────────────────────────────────────────────────
	$effect(() => {
		if (form?.message) toast.error(form.message);
		if (form?.success) {
			toast.success("BOM saved successfully.");
			createOpen = false;
			editOpen = false;
			deleteOpen = false;
			selectedIds = new Set();
			changes = {};
		}
	});

	// ── Select helpers ───────────────────────────────────────────────────────
	function toggleSelect(id: number) {
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

	// ── ITEM_ACCT 필터링 옵션 ───────────────────────────────────────────────
	const childItemOptions = $derived(
		data.itemInfo.list.filter(item => {
			const info = data.itemsMap[item.code];
			return info && info.itemAcct !== "50";
		})
	);

	const parentItemOptions = $derived(
		data.itemInfo.list.filter(item => {
			const info = data.itemsMap[item.code];
			return info && (info.itemAcct === "10" || info.itemAcct === "20");
		})
	);

	// ── Dialog / Reset ───────────────────────────────────────────────────────
	function resetForm() {
		formParentId = "";
		formParentQty = 1;
		formItem = "";
		formItemQty = 1;
		formRemark = "";
	}

	function openCreate(presetParentId?: string) {
		resetForm();
		if (presetParentId) {
			formParentId = presetParentId;
		}
		createOpen = true;
	}

	function openDelete(item: BOMFlat) {
		deleteId = item.id;
		deleteHasChildren = data.flatBOM.some((m) => m.BOM_item_parent === item.BOM_item);
		deleteOpen = true;
	}

	function pad(n: number): string {
		return n.toString().padStart(2, "0");
	}
	function formatDateTime(date: Date | null): string {
		if (!date) return "\u2014";
		const d = new Date(date);
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
	}

	function openAudit(item: BOMFlat) {
		auditRecord = {
			createdBy: item.createdBy,
			updatedBy: item.updatedBy,
			createdAt: item.createdAt,
			updatedAt: item.updatedAt,
		};
		auditOpen = true;
	}

	// ── Refresh & Export ─────────────────────────────────────────────────────
	let refreshing = $state(false);

	async function handleRefresh() {
		refreshing = true;
		await invalidateAll();
		refreshing = false;
		toast.success("Data refreshed.");
	}

	function handleExport(format: "csv" | "json") {
		const exportData = filteredTree.map((fi) => {
			const itemInfo = data.itemsMap[fi.item.BOM_item];
			const parentInfo = fi.item.BOM_item_parent ? data.itemsMap[fi.item.BOM_item_parent] : null;
			return {
				parent_code: fi.item.BOM_item_parent ?? "",
				parent_name: parentInfo?.itemDesc ?? "",
				parent_qty: fi.item.BOM_item_parent_qty,
				child_code: fi.item.BOM_item,
				child_name: itemInfo?.itemDesc ?? "",
				child_qty: fi.item.BOM_item_qty,
				remark: fi.item.BOM_remark ?? "",
			};
		});
		if (format === "csv") exportToCSV(exportData, "BOM_Info");
		else exportToJSON(exportData, "BOM_Info");
	}

	// ── Client Side Validation & Constraint Checks ───────────────────────────
	function isAncestorOrSelfBOM(ancestorCode: string, childCode: string): boolean {
		if (ancestorCode === childCode) return true;
		const visited = new Set<string>();
		const queue: string[] = [childCode];

		while (queue.length > 0) {
			const current = queue.shift()!;
			if (current === ancestorCode) return true;
			if (visited.has(current)) continue;
			visited.add(current);

			const children = data.flatBOM
				.filter((item) => item.BOM_item_parent === current)
				.map((item) => item.BOM_item);
			for (const child of children) {
				queue.push(child);
			}
		}
		return false;
	}

	function validateBOMClient(parentCode: string | null, childCode: string): { valid: boolean; message?: string } {
		const childInfo = data.itemsMap[childCode];
		if (!childInfo) return { valid: false, message: "Invalid item." };
		if (childInfo.itemAcct === "50") return { valid: false, message: "Child cannot be Merchandise ('50')." };

		if (parentCode) {
			const parentInfo = data.itemsMap[parentCode];
			if (!parentInfo) return { valid: false, message: "Invalid parent item." };
			if (parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
				return { valid: false, message: "Parent item must be Product ('10') or Semi-finished Product ('20')." };
			}
			if (childInfo.itemAcct === "10" && parentInfo.itemAcct !== "10") {
				return { valid: false, message: "If child is Product ('10'), parent must be Product ('10')." };
			}
			if (childInfo.itemAcct === "20" && parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
				return { valid: false, message: "If child is Semi-finished Product ('20'), parent must be Product ('10') or Semi-finished Product ('20')." };
			}
			if ((childInfo.itemAcct === "30" || childInfo.itemAcct === "40") && parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
				return { valid: false, message: "If child is Raw/Sub material, parent must be Product ('10') or Semi-finished Product ('20')." };
			}
			if (isAncestorOrSelfBOM(parentCode, childCode)) {
				return { valid: false, message: "Circular reference detected. Cannot move. (Child is an ancestor of the parent)" };
			}
		}
		return { valid: true };
	}

	// ── Drag & Drop Logic ────────────────────────────────────────────────────
	let draggedId = $state<number | null>(null);
	let dropOverId = $state<number | null>(null);
	let dropPosition = $state<"before" | "after" | "inside" | null>(null);

	function handleDragStart(e: DragEvent, itemId: number) {
		draggedId = itemId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = "move";
		}
	}

	function handleDragOver(e: DragEvent, itemId: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = "move";
		}

		const draggedItem = data.flatBOM.find((m) => m.id === draggedId);
		if (!draggedItem) return;

		// 자기 자신 또는 자기 하위의 노드로는 이동 불가
		if (draggedId && draggedItem) {
			const targetItem = data.flatBOM.find((m) => m.id === itemId);
			if (targetItem && isAncestorOrSelfBOM(draggedItem.BOM_item, targetItem.BOM_item)) {
				if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
				dropOverId = null;
				dropPosition = null;
				return;
			}
		}

		const el = e.currentTarget as HTMLElement;
		const rect = el.getBoundingClientRect();
		const ratio = (e.clientY - rect.top) / rect.height;

		const targetItem = data.flatBOM.find((m) => m.id === itemId);
		const targetInfo = targetItem ? data.itemsMap[targetItem.BOM_item] : null;
		
		// 부모 품목이 될 수 있는 경우(ITEM_ACCT IN '10', '20')만 inside 드롭 가능
		const canBeParent = targetInfo && (targetInfo.itemAcct === "10" || targetInfo.itemAcct === "20");

		if (canBeParent && ratio > 0.3 && ratio < 0.7) {
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
		targetId: number,
		targetParentCode: string | null,
		sourceDraggedId: number,
		currentDropPosition: "before" | "after" | "inside"
	) {
		if (sourceDraggedId === targetId) return;

		const draggedItem = data.flatBOM.find((m) => m.id === sourceDraggedId);
		const targetItem = data.flatBOM.find((m) => m.id === targetId);
		if (!draggedItem || !targetItem) return;

		let nextParentCode = targetParentCode;
		if (currentDropPosition === "inside") {
			nextParentCode = targetItem.BOM_item;
		}

		// 비즈니스 밸리데이션 검사
		const check = validateBOMClient(nextParentCode, draggedItem.BOM_item);
		if (!check.valid) {
			toast.error(check.message ?? "Constraints validation failed.");
			return;
		}

		if (currentDropPosition === "inside") {
			const targetChildren = data.flatBOM
				.filter((m) => m.BOM_item_parent === targetItem.BOM_item)
				.sort((a, b) => a.sortOrder - b.sortOrder);

			const updates = targetChildren
				.filter((item) => item.id !== sourceDraggedId)
				.map((item, i) => ({
					id: item.id,
					BOM_item_parent: targetItem.BOM_item,
					sort_order: i,
				}));

			updates.push({
				id: sourceDraggedId,
				BOM_item_parent: targetItem.BOM_item,
				sort_order: updates.length,
			});

			const fd = new FormData();
			fd.append("updates", JSON.stringify(updates));
			const response = await fetch("?/reorderBOM", { method: "POST", body: fd });
			if (response.ok) {
				await invalidateAll();
				toast.success("BOM reordered successfully.");
			} else {
				const resData = await response.json();
				toast.error(resData?.message || "Failed to update.");
			}
			return;
		}

		// before / after 정렬
		const siblings = data.flatBOM
			.filter((m) => m.BOM_item_parent === targetParentCode)
			.sort((a, b) => a.sortOrder - b.sortOrder);

		const draggedIdx = siblings.findIndex((m) => m.id === sourceDraggedId);
		const targetIdx = siblings.findIndex((m) => m.id === targetId);

		if (draggedIdx < 0) {
			const insertAt = currentDropPosition === "before" ? targetIdx : targetIdx + 1;

			const updates = siblings.map((item, i) => ({
				id: item.id,
				BOM_item_parent: targetParentCode,
				sort_order: i >= insertAt ? i + 1 : i,
			}));

			updates.push({
				id: sourceDraggedId,
				BOM_item_parent: targetParentCode,
				sort_order: insertAt,
			});

			updates.sort((a, b) => a.sort_order - b.sort_order);
			const normalizedUpdates = updates.map((item, i) => ({ ...item, sort_order: i }));

			const fd = new FormData();
			fd.append("updates", JSON.stringify(normalizedUpdates));
			const response = await fetch("?/reorderBOM", { method: "POST", body: fd });
			if (response.ok) {
				await invalidateAll();
				toast.success("BOM reordered successfully.");
			} else {
				const resData = await response.json();
				toast.error(resData?.message || "Failed to update.");
			}
			return;
		}

		const reordered = siblings.filter((m) => m.id !== sourceDraggedId);
		const draggedItemObj = siblings[draggedIdx];
		let insertAt = targetIdx;
		if (draggedIdx < targetIdx) {
			insertAt = targetIdx - 1;
		}
		if (currentDropPosition === "after" && draggedIdx > targetIdx) {
			insertAt = targetIdx + 1;
		}
		reordered.splice(insertAt, 0, draggedItemObj);

		const updates = reordered.map((item, i) => ({
			id: item.id,
			BOM_item_parent: item.BOM_item_parent,
			sort_order: i,
		}));

		const fd = new FormData();
		fd.append("updates", JSON.stringify(updates));
		const response = await fetch("?/reorderBOM", { method: "POST", body: fd });
		if (response.ok) {
			await invalidateAll();
			toast.success("BOM reordered successfully.");
		} else {
			const resData = await response.json();
			toast.error(resData?.message || "Failed to update.");
		}
	}

	function handleDragEnd() {
		draggedId = null;
		dropOverId = null;
		dropPosition = null;
	}

	async function onDrop(e: DragEvent, targetId: number, targetParentCode: string | null) {
		e.preventDefault();
		if (draggedId === null || !dropPosition) {
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

		await handleDropWithSource(targetId, targetParentCode, sourceDraggedId, currentDropPosition);
	}

	const columns = ["Child Item", "Parent Qty", "Child Qty", "Remark"];
</script>

<svelte:head>
	<title>{data.pageTitle} - SvelteForge Factory Cost</title>
</svelte:head>

<div class="min-w-0 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">{data.pageTitle}</h1>
			<p class="text-muted-foreground">{data.pageDesc}</p>
		</div>
		<div class="flex items-center gap-2">
			{#if hasChanges}
				<Button variant="outline" size="sm" onclick={revertAllChanges} class="border-amber-500 text-amber-500 hover:bg-amber-500/10">
					<UndoIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<form
					method="POST"
					action="?/saveBOM"
					use:enhance={() => {
						return async ({ result, update }) => {
							if (result.type === "success" || result.type === "redirect") {
								toast.success("BOM saved successfully.");
								changes = {};
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="changes" value={JSON.stringify(
						Object.entries(changes).map(([id, val]) => ({
							id: parseInt(id),
							BOM_item: val.BOM_item,
							BOM_item_qty: val.BOM_item_qty,
							BOM_item_parent_qty: val.BOM_parent_qty,
							BOM_remark: val.BOM_remark
						}))
					)} />
					<Button size="sm" type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
						<SaveIcon class="mr-2 size-4" />
						Save BOM
					</Button>
				</form>
			{/if}
			<Button onclick={() => openCreate()}>
				<PlusIcon class="mr-2 size-4" />
				Add BOM
			</Button>
		</div>
	</div>

	<!-- Toolbar -->
	<div class="flex items-center gap-2">
		<div class="relative max-w-sm flex-1">
			<SearchIcon class="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input placeholder="Search BOM items..." class="pl-9" bind:value={search} />
		</div>
		<Button variant="ghost" size="icon" class="size-8 shrink-0" onclick={handleRefresh} disabled={refreshing}>
			<RefreshCwIcon class="size-4 {refreshing ? 'animate-spin' : ''}" />
		</Button>
		<p class="text-muted-foreground text-sm">
			{filteredTree.length} item{filteredTree.length !== 1 ? "s" : ""}
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
					{#each columns as label}
						<Table.Head>{label}</Table.Head>
					{/each}
					<Table.Head class="sticky right-0 z-[1] w-[120px] bg-background text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each paginated as fi (fi.item.id)}
					<!-- before indicator -->
					{#if dropOverId === fi.item.id && dropPosition === "before"}
						<Table.Row>
							<Table.Cell colspan={6} class="h-0.5 p-0">
								<div class="bg-primary h-full w-full rounded-full"></div>
							</Table.Cell>
						</Table.Row>
					{/if}

					{@const isModified = Boolean(changes[fi.item.id])}
					{@const itemValue = changes[fi.item.id]?.BOM_item ?? fi.item.BOM_item}
					{@const itemQtyValue = changes[fi.item.id]?.BOM_item_qty ?? fi.item.BOM_item_qty}
					{@const parentQtyValue = changes[fi.item.id]?.BOM_parent_qty ?? fi.item.BOM_item_parent_qty}
					{@const remarkValue = changes[fi.item.id]?.BOM_remark ?? (fi.item.BOM_remark ?? "")}
					{@const itemDetails = data.itemsMap[itemValue]}

					<Table.Row
						class={[
							selectedIds.has(fi.item.id) ? 'bg-muted/50' : '',
							draggedId === fi.item.id ? 'opacity-50' : '',
							isModified ? 'bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/20' : ''
						].filter(Boolean).join(' ')}
						draggable={true}
						ondragstart={(e) => handleDragStart(e, fi.item.id)}
						ondragend={handleDragEnd}
						ondragover={(e) => handleDragOver(e, fi.item.id)}
						ondragleave={handleDragLeave}
						ondrop={(e) => onDrop(e, fi.item.id, fi.item.BOM_item_parent)}
					>
						<!-- Checkbox -->
						<Table.Cell class="sticky left-0 z-[1] bg-background">
							<input
								type="checkbox"
								checked={selectedIds.has(fi.item.id)}
								onchange={() => toggleSelect(fi.item.id)}
								class="accent-primary size-4"
							/>
						</Table.Cell>

						<!-- Child Item Code & Description (with Tree Structure) -->
						<Table.Cell>
							<div class="flex items-center gap-1" style="margin-left: {fi.depth * 1.5}rem">
								<!-- Drag handle -->
								<div class="text-muted-foreground cursor-grab opacity-30 hover:opacity-100 mr-1">
									<GripVerticalIcon class="size-4" />
								</div>
								
								<!-- Expand/collapse button -->
								{#if fi.item.children && fi.item.children.length > 0}
									<button
										type="button"
										class="text-muted-foreground hover:text-foreground flex items-center p-0.5"
										onclick={() => toggleExpand(fi.item.id)}
									>
										{#if expanded.has(fi.item.id)}
											<ChevronDownIcon class="size-4" />
										{:else}
											<ChevronRightIcon class="size-4" />
										{/if}
									</button>
								{:else}
									<span class="w-5"></span>
								{/if}
								
								<!-- Item Input Searchable Select -->
								<div class="w-64">
									<SearchableSelect
										items={childItemOptions}
										bind:value={() => itemValue, (v) => updateInlineChange(fi.item.id, "BOM_item", v)}
										placeholder="Select Child Item..."
										class="h-8 text-xs"
									/>
								</div>
							</div>
						</Table.Cell>

						<!-- Parent Qty -->
						<Table.Cell>
							<div class="w-24">
								<Input
									type="number"
									step={qtyStep}
									min={qtyMin}
									value={parentQtyValue}
									oninput={(e) => updateInlineChange(fi.item.id, "BOM_parent_qty", (e.target as HTMLInputElement).value)}
									class="h-8 text-right text-xs"
								/>
							</div>
						</Table.Cell>

						<!-- Child Qty -->
						<Table.Cell>
							<div class="w-24">
								<Input
									type="number"
									step={qtyStep}
									min={qtyMin}
									value={itemQtyValue}
									oninput={(e) => updateInlineChange(fi.item.id, "BOM_item_qty", (e.target as HTMLInputElement).value)}
									class="h-8 text-right text-xs"
								/>
							</div>
						</Table.Cell>

						<!-- Remark -->
						<Table.Cell>
							<div class="w-64">
								<Input
									value={remarkValue}
									oninput={(e) => updateInlineChange(fi.item.id, "BOM_remark", (e.target as HTMLInputElement).value)}
									placeholder="Enter remark..."
									class="h-8 text-xs"
								/>
							</div>
						</Table.Cell>

						<!-- Actions -->
						<Table.Cell class="sticky right-0 z-[1] bg-background text-right">
							<div class="flex items-center justify-end gap-1">
								{#if itemDetails && (itemDetails.itemAcct === "10" || itemDetails.itemAcct === "20")}
									<Button variant="ghost" size="icon" class="size-8" onclick={() => openCreate(itemValue)} title="Add Child BOM">
										<PlusIcon class="size-4" />
									</Button>
								{/if}
								<Button variant="ghost" size="icon" class="size-8" onclick={() => openAudit(fi.item)} title="Audit Trail">
									<ScrollTextIcon class="size-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive size-8 hover:bg-destructive/10"
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
							<Table.Cell colspan={6} class="h-0.5 p-0">
								<div class="bg-primary h-full w-full rounded-full"></div>
							</Table.Cell>
						</Table.Row>
					{/if}
				{:else}
					<Table.Row>
						<Table.Cell colspan={6} class="h-24 text-center">
							{search ? "No BOM items match your search." : "No BOM items found."}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
		<DataTablePagination totalItems={filteredTree.length} bind:pageSize bind:currentPage />
	</div>
</div>

<!-- Delete Confirmation Dialog -->
<DeleteConfirmDialog bind:open={deleteOpen} action="?/delete" id={deleteId !== null ? String(deleteId) : ""} itemName="BOM" />
{#if deleteHasChildren && deleteOpen}
	<p class="text-muted-foreground mt-1 text-xs text-center">Note: BOM items with children cannot be deleted.</p>
{/if}

<!-- ═══════════════════════════════════════════════════════════════════════════
     Audit Trail Dialog
     ═══════════════════════════════════════════════════════════════════════════ -->
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

<!-- ═══════════════════════════════════════════════════════════════════════════
     Create Dialog
     ═══════════════════════════════════════════════════════════════════════════ -->
<Dialog.Root bind:open={createOpen}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add BOM Item</Dialog.Title>
			<Dialog.Description>Register a new child item in the BOM hierarchy.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						createOpen = false;
						resetForm();
					}
					await update();
				};
			}}
		>
			<div class="grid gap-4 py-4">
				<!-- Parent Item -->
				<div class="grid gap-2">
					<Label for="create-parent" class="text-foreground">Parent Item (Optional)</Label>
					<SearchableSelect
						items={parentItemOptions}
						bind:value={formParentId}
						placeholder="Root level (no parent)"
					/>
					<input type="hidden" name="BOM_item_parent" value={formParentId ?? ""} />
				</div>

				<!-- Parent Qty -->
				<div class="grid gap-2">
					<Label for="create-parent-qty" class="text-foreground">Parent Qty *</Label>
					<Input
						id="create-parent-qty"
						name="BOM_item_parent_qty"
						type="number"
						step={qtyStep}
						min={qtyMin}
						bind:value={formParentQty}
						required
					/>
				</div>

				<!-- Child Item -->
				<div class="grid gap-2">
					<Label for="create-child" class="text-amber-600 dark:text-amber-400">Child Item *</Label>
					<SearchableSelect
						items={childItemOptions}
						bind:value={formItem}
						placeholder="Select child item..."
					/>
					<input type="hidden" name="BOM_item" value={formItem} />
				</div>

				<!-- Child Qty -->
				<div class="grid gap-2">
					<Label for="create-child-qty" class="text-foreground">Child Qty *</Label>
					<Input
						id="create-child-qty"
						name="BOM_item_qty"
						type="number"
						step={qtyStep}
						min={qtyMin}
						bind:value={formItemQty}
						required
					/>
				</div>

				<!-- Remark -->
				<div class="grid gap-2">
					<Label for="create-remark" class="text-foreground">Remark</Label>
					<Input
						id="create-remark"
						name="BOM_remark"
						bind:value={formRemark}
						placeholder="Enter remark..."
					/>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => { createOpen = false; resetForm(); }}>Cancel</Button>
				<Button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
