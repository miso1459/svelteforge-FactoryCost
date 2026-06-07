import { db } from "$lib/server/db/index.js";
import { masterBOM, masterItem, menus } from "$lib/server/db/schema.js";
import { getItemInfo } from "$lib/(user)/Common/DropdownItemInfo.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, inArray, count } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

type BOMFlat = typeof masterBOM.$inferSelect;
type BOMTreeNode = BOMFlat & { children: BOMTreeNode[] };

function buildTree(flat: BOMFlat[]): BOMTreeNode[] {
	const map = new Map<number, BOMTreeNode>();

	for (const item of flat) {
		map.set(item.id, { ...item, children: [] });
	}

	const rootNodes: BOMTreeNode[] = [];
	const parentMap = new Map<string, BOMTreeNode[]>(); // BOM_item_parent → 자식 rows

	for (const item of flat) {
		const node = map.get(item.id)!;
		if (item.BOM_item_parent === null || item.BOM_item_parent === "") {
			rootNodes.push(node);
		} else {
			const key = item.BOM_item_parent;
			if (!parentMap.has(key)) parentMap.set(key, []);
			parentMap.get(key)!.push(node);
		}
	}

	// 재귀적으로 자식 연결
	function attachChildren(node: BOMTreeNode) {
		const children = parentMap.get(node.BOM_item) ?? [];
		node.children = children.sort((a, b) => a.sortOrder - b.sortOrder);
		for (const child of node.children) {
			attachChildren(child);
		}
	}

	for (const root of rootNodes) {
		attachChildren(root);
	}

	return rootNodes.sort((a, b) => a.sortOrder - b.sortOrder);
}

// 순환 참조 체크 헬퍼
function checkCircular(
	parentCode: string,
	childCode: string,
	flatBOM: { BOM_item_parent: string | null; BOM_item: string }[]
): boolean {
	const visited = new Set<string>();
	const queue: string[] = [childCode];

	while (queue.length > 0) {
		const current = queue.shift()!;
		if (current === parentCode) return true;
		if (visited.has(current)) continue;
		visited.add(current);

		const children = flatBOM
			.filter((item) => item.BOM_item_parent === current)
			.map((item) => item.BOM_item);
		for (const child of children) {
			queue.push(child);
		}
	}
	return false;
}

// ITEM_ACCT 비즈니스 규칙 및 검증 헬퍼
function validateBOM(
	parentCode: string | null,
	childCode: string,
	itemsMap: Record<string, { itemAcct: string }>,
	flatBOM: { BOM_item_parent: string | null; BOM_item: string }[]
): { valid: boolean; message?: string } {
	const childInfo = itemsMap[childCode];
	if (!childInfo) {
		return { valid: false, message: `Invalid BOM_item code: ${childCode}` };
	}

	if (childInfo.itemAcct === "50") {
		return { valid: false, message: "BOM_item (child) cannot be Merchandise ('50')." };
	}

	if (parentCode) {
		const parentInfo = itemsMap[parentCode];
		if (!parentInfo) {
			return { valid: false, message: `Invalid BOM_item_parent code: ${parentCode}` };
		}

		if (parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
			return { valid: false, message: "Parent item must be Product ('10') or Semi-finished Product ('20')." };
		}

		// 부모-자식 ITEM_ACCT 제약
		if (childInfo.itemAcct === "10" && parentInfo.itemAcct !== "10") {
			return { valid: false, message: "If child is Product ('10'), parent must be Product ('10')." };
		}
		if (childInfo.itemAcct === "20" && parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
			return { valid: false, message: "If child is Semi-finished Product ('20'), parent must be Product ('10') or Semi-finished Product ('20')." };
		}
		if ((childInfo.itemAcct === "30" || childInfo.itemAcct === "40") && parentInfo.itemAcct !== "10" && parentInfo.itemAcct !== "20") {
			return { valid: false, message: "If child is Raw/Sub material, parent must be Product ('10') or Semi-finished Product ('20')." };
		}

		// 순환 참조 검사
		if (checkCircular(parentCode, childCode, flatBOM)) {
			return { valid: false, message: "Circular reference detected. Cannot save. (Child is an ancestor of the parent)" };
		}
	}

	return { valid: true };
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const flatBOM = await db
		.select()
		.from(masterBOM)
		.orderBy(masterBOM.sortOrder, masterBOM.createdAt);

	const bomTree = buildTree(flatBOM);
	const itemInfo = await getItemInfo();

	// 모든 활성화 품목 정보를 가져와서 itemsMap 구성
	const activeItems = await db
		.select()
		.from(masterItem)
		.where(eq(masterItem.isActive, true));

	const itemsMap = Object.fromEntries(
		activeItems.map((item) => [
			item.itemCode,
			{ itemAcct: item.itemAcct, itemDesc: item.itemDesc, itemSpec: item.itemSpec ?? "", itemUnit: item.itemUnit ?? "" }
		])
	);

	// menus 테이블에서 페이지 타이틀 및 설명 정보 조회
	const pageMenuInfo = await db
		.select({ name: menus.name, desc: menus.desc })
		.from(menus)
		.where(eq(menus.path, "/Functions/Master/BOMInfo"))
		.limit(1);

	const pageTitle = pageMenuInfo[0]?.name ?? "BOMs";
	const pageDesc = pageMenuInfo[0]?.desc ?? "Manage Bill of Materials (BOM) structure and item hierarchy.";

	return { flatBOM, bomTree, itemInfo, itemsMap, pageTitle, pageDesc, currentUserName: locals.user.name };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const BOM_item_parent = formData.get("BOM_item_parent") as string | null;
		const BOM_item_parent_qty = parseFloat(formData.get("BOM_item_parent_qty") as string);
		const BOM_item = formData.get("BOM_item") as string | null;
		const BOM_item_qty = parseFloat(formData.get("BOM_item_qty") as string);
		const BOM_remark = formData.get("BOM_remark") as string | null;

		if (!BOM_item || BOM_item.trim().length === 0) {
			return fail(400, { message: "BOM_item is required." });
		}
		if (isNaN(BOM_item_qty) || BOM_item_qty <= 0) {
			return fail(400, { message: "BOM_item_qty must be greater than 0." });
		}
		if (isNaN(BOM_item_parent_qty) || BOM_item_parent_qty <= 0) {
			return fail(400, { message: "BOM_item_parent_qty must be greater than 0." });
		}

		// 비즈니스 규칙 검증을 위해 데이터 조회
		const activeItems = await db.select().from(masterItem).where(eq(masterItem.isActive, true));
		const itemsMap = Object.fromEntries(activeItems.map((item) => [item.itemCode, { itemAcct: item.itemAcct }]));
		const flatBOM = await db.select().from(masterBOM);

		const validation = validateBOM(BOM_item_parent || null, BOM_item, itemsMap, flatBOM);
		if (!validation.valid) {
			return fail(400, { message: validation.message });
		}

		const userName = locals.user.name;
		const now = new Date();

		const siblings = await db
			.select({ value: count() })
			.from(masterBOM)
			.where(
				BOM_item_parent
					? eq(masterBOM.BOM_item_parent, BOM_item_parent)
					: eq(masterBOM.BOM_item_parent, "")
			);
		const sortOrder = siblings[0]?.value ?? 0;

		try {
			await db.insert(masterBOM).values({
				BOM_item_parent: BOM_item_parent || null,
				BOM_item_parent_qty: isNaN(BOM_item_parent_qty) ? 1 : BOM_item_parent_qty,
				BOM_item: BOM_item.trim(),
				BOM_item_qty: isNaN(BOM_item_qty) ? 1 : BOM_item_qty,
				BOM_remark: BOM_remark?.trim() || null,
				sortOrder,
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			});
		} catch {
			return fail(400, { message: "Failed to create BOM item." });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const id = parseInt(formData.get("id") as string);
		const BOM_item_parent = formData.get("BOM_item_parent") as string | null;
		const BOM_item_parent_qty = parseFloat(formData.get("BOM_item_parent_qty") as string);
		const BOM_item = formData.get("BOM_item") as string | null;
		const BOM_item_qty = parseFloat(formData.get("BOM_item_qty") as string);
		const BOM_remark = formData.get("BOM_remark") as string | null;

		if (isNaN(id)) {
			return fail(400, { message: "Invalid ID." });
		}
		if (!BOM_item || BOM_item.trim().length === 0) {
			return fail(400, { message: "BOM_item is required." });
		}
		if (isNaN(BOM_item_qty) || BOM_item_qty <= 0) {
			return fail(400, { message: "BOM_item_qty must be greater than 0." });
		}
		if (isNaN(BOM_item_parent_qty) || BOM_item_parent_qty <= 0) {
			return fail(400, { message: "BOM_item_parent_qty must be greater than 0." });
		}

		// 비즈니스 규칙 검증
		const activeItems = await db.select().from(masterItem).where(eq(masterItem.isActive, true));
		const itemsMap = Object.fromEntries(activeItems.map((item) => [item.itemCode, { itemAcct: item.itemAcct }]));
		const allFlatBOM = await db.select().from(masterBOM);
		const filteredFlatBOM = allFlatBOM.filter(item => item.id !== id);

		const validation = validateBOM(BOM_item_parent || null, BOM_item, itemsMap, filteredFlatBOM);
		if (!validation.valid) {
			return fail(400, { message: validation.message });
		}

		try {
			await db
				.update(masterBOM)
				.set({
					BOM_item_parent: BOM_item_parent || null,
					BOM_item_parent_qty,
					BOM_item: BOM_item.trim(),
					BOM_item_qty,
					BOM_remark: BOM_remark?.trim() || null,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(masterBOM.id, id));
		} catch {
			return fail(400, { message: "Failed to update BOM item." });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idRaw = formData.get("id") as string | null;
		const id = parseInt(idRaw ?? "");

		if (isNaN(id)) {
			return fail(400, { message: "Invalid ID." });
		}

		const currentRow = await db.select().from(masterBOM).where(eq(masterBOM.id, id)).limit(1);
		if (currentRow.length > 0) {
			const childCount = await db
				.select({ value: count() })
				.from(masterBOM)
				.where(eq(masterBOM.BOM_item_parent, currentRow[0].BOM_item));
			if ((childCount[0]?.value ?? 0) > 0) {
				return fail(400, { message: "Please delete child BOM items first." });
			}
		}

		try {
			await db.delete(masterBOM).where(eq(masterBOM.id, id));
		} catch {
			return fail(400, { message: "Failed to delete." });
		}

		return { success: true };
	},

	bulkDelete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idsRaw = formData.get("ids") as string | null;

		if (!idsRaw?.trim()) {
			return fail(400, { message: "No items selected." });
		}

		const ids = idsRaw
			.split(",")
			.map((s) => parseInt(s.trim()))
			.filter((n) => !isNaN(n));

		if (ids.length === 0) {
			return fail(400, { message: "No items selected." });
		}

		const blockedIds: number[] = [];
		for (const id of ids) {
			const currentRow = await db.select().from(masterBOM).where(eq(masterBOM.id, id)).limit(1);
			if (currentRow.length > 0) {
				const childCount = await db
					.select({ value: count() })
					.from(masterBOM)
					.where(eq(masterBOM.BOM_item_parent, currentRow[0].BOM_item));
				if ((childCount[0]?.value ?? 0) > 0) {
					blockedIds.push(id);
				}
			}
		}

		const deleteIds = ids.filter((id) => !blockedIds.includes(id));

		if (deleteIds.length === 0) {
			return fail(400, { message: "All selected items have children and cannot be deleted." });
		}

		try {
			await db.delete(masterBOM).where(inArray(masterBOM.id, deleteIds));
		} catch {
			return fail(400, { message: "Failed to bulk delete." });
		}

		return { success: true, skippedIds: blockedIds };
	},

	reorderBOM: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const updatesJson = formData.get("updates") as string | null;

		if (!updatesJson) {
			return fail(400, { message: "Update data is required." });
		}

		type ReorderItem = {
			id: number;
			BOM_item_parent: string | null;
			sort_order: number;
		};
		const updates: ReorderItem[] = JSON.parse(updatesJson);

		// 비즈니스 규칙 및 순환참조 검증
		const activeItems = await db.select().from(masterItem).where(eq(masterItem.isActive, true));
		const itemsMap = Object.fromEntries(activeItems.map((item) => [item.itemCode, { itemAcct: item.itemAcct }]));
		const allFlatBOM = await db.select().from(masterBOM);

		// 하나씩 검증
		for (const u of updates) {
			const currentItem = allFlatBOM.find(item => item.id === u.id);
			if (!currentItem) continue;
			
			// 부모가 실제로 바뀌는 경우에만 검증 수행
			if (currentItem.BOM_item_parent !== u.BOM_item_parent) {
				const otherFlatBOM = allFlatBOM.filter(item => item.id !== u.id);
				const validation = validateBOM(u.BOM_item_parent, currentItem.BOM_item, itemsMap, otherFlatBOM);
				if (!validation.valid) {
					return fail(400, { message: validation.message });
				}
			}
		}

		for (const u of updates) {
			await db
				.update(masterBOM)
				.set({
					BOM_item_parent: u.BOM_item_parent ?? null,
					sortOrder: u.sort_order,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(masterBOM.id, u.id));
		}

		return { success: true };
	},

	saveBOM: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const changesJson = formData.get("changes") as string | null;

		if (!changesJson) {
			return fail(400, { message: "No change data." });
		}

		type ChangeItem = {
			id: number;
			BOM_item: string;
			BOM_item_qty: number;
			BOM_item_parent_qty: number;
			BOM_remark: string | null;
		};
		const changes: ChangeItem[] = JSON.parse(changesJson);

		// 비즈니스 규칙 검증
		const activeItems = await db.select().from(masterItem).where(eq(masterItem.isActive, true));
		const itemsMap = Object.fromEntries(activeItems.map((item) => [item.itemCode, { itemAcct: item.itemAcct }]));
		const allFlatBOM = await db.select().from(masterBOM);

		for (const c of changes) {
			if (!c.BOM_item || c.BOM_item_qty <= 0 || c.BOM_item_parent_qty <= 0) {
				return fail(400, { message: "BOM item quantities must be greater than 0." });
			}
			
			const currentItem = allFlatBOM.find(item => item.id === c.id);
			if (!currentItem) continue;

			// 자식 품목이 변경된 경우만
			if (currentItem.BOM_item !== c.BOM_item) {
				const otherFlatBOM = allFlatBOM.filter(item => item.id !== c.id);
				const validation = validateBOM(currentItem.BOM_item_parent, c.BOM_item, itemsMap, otherFlatBOM);
				if (!validation.valid) {
					return fail(400, { message: validation.message });
				}
			}
		}

		for (const c of changes) {
			await db
				.update(masterBOM)
				.set({
					BOM_item: c.BOM_item,
					BOM_item_qty: c.BOM_item_qty,
					BOM_item_parent_qty: c.BOM_item_parent_qty,
					BOM_remark: c.BOM_remark || null,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(masterBOM.id, c.id));
		}

		return { success: true };
	},
};

