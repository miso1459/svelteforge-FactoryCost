import { db } from "$lib/server/db/index.js";
import { menus } from "$lib/server/db/schema.js";
import { generateId } from "$lib/server/id.js";
import { eq, inArray, count } from "drizzle-orm";
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types.js";

type FlatMenu = typeof menus.$inferSelect;
type MenuTreeNode = FlatMenu & { children: MenuTreeNode[] };

function buildTree(flat: FlatMenu[]): MenuTreeNode[] {
	const map = new Map<string, MenuTreeNode>();
	const roots: MenuTreeNode[] = [];

	for (const item of flat) {
		map.set(item.id, { ...item, children: [] });
	}

	for (const item of flat) {
		const node = map.get(item.id)!;
		if (item.parentId) {
			const parent = map.get(item.parentId);
			if (parent) {
				parent.children.push(node);
			} else {
				roots.push(node);
			}
		} else {
			roots.push(node);
		}
	}

	return roots;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const flatMenus = await db
		.select()
		.from(menus)
		.orderBy(menus.sortOrder, menus.createdAt);

	const menuTree = buildTree(flatMenus);

	return { flatMenus, menuTree, currentUserName: locals.user.name };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const type = formData.get("type") as string | null;
		const name = formData.get("name") as string | null;
		const path = formData.get("path") as string | null;
		const icon = formData.get("icon") as string | null;
		const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
		const parentId = formData.get("parentId") as string | null;

		if (!type || (type !== "folder" && type !== "link")) {
			return fail(400, { message: "Type must be 'folder' or 'link'" });
		}
		if (typeof name !== "string" || name.length < 1 || name.length > 255) {
			return fail(400, { message: "Name is required (1-255 characters)" });
		}

		const selectedRoles = formData.getAll("role") as string[];
		const role = selectedRoles.length > 0 ? JSON.stringify(selectedRoles) : JSON.stringify(["guest"]);

		const userName = locals.user.name;
		const now = new Date();

		try {
			await db.insert(menus).values({
				id: generateId(10),
				type,
				name,
				path: path || null,
				icon: icon || null,
				role,
				sortOrder,
				parentId: parentId || null,
				isActive: true,
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			});
		} catch {
			return fail(400, { message: "Failed to create menu" });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const id = formData.get("id") as string | null;
		const type = formData.get("type") as string | null;
		const name = formData.get("name") as string | null;
		const path = formData.get("path") as string | null;
		const icon = formData.get("icon") as string | null;
		const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
		const parentId = formData.get("parentId") as string | null;
		const isActive = formData.get("isActive") as string | null;

		if (typeof id !== "string" || !id.trim()) {
			return fail(400, { message: "Menu ID is required" });
		}
		if (typeof name !== "string" || name.length < 1 || name.length > 255) {
			return fail(400, { message: "Name is required (1-255 characters)" });
		}

		const selectedRoles = formData.getAll("role") as string[];
		const role = selectedRoles.length > 0 ? JSON.stringify(selectedRoles) : JSON.stringify(["guest"]);

		try {
			await db
				.update(menus)
				.set({
					type: type as "folder" | "link",
					name,
					path: path || null,
					icon: icon || null,
					role,
					sortOrder,
					parentId: parentId || null,
					isActive: isActive === "true",
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(menus.id, id));
		} catch {
			return fail(400, { message: "Update failed" });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const id = formData.get("id") as string | null;

		if (typeof id !== "string" || !id.trim()) {
			return fail(400, { message: "Menu ID is required" });
		}

		const childrenResult = await db
			.select({ value: count() })
			.from(menus)
			.where(eq(menus.parentId, id));

		if (childrenResult[0]?.value > 0) {
			return fail(400, { message: "Remove child menus first" });
		}

		try {
			await db.delete(menus).where(eq(menus.id, id));
		} catch {
			return fail(400, { message: "Delete failed" });
		}

		return { success: true };
	},

	bulkDelete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idsRaw = formData.get("ids") as string | null;

		if (typeof idsRaw !== "string" || !idsRaw.trim()) {
			return fail(400, { message: "No menus selected" });
		}

		const ids = idsRaw.split(",").filter(Boolean);
		if (ids.length === 0) {
			return fail(400, { message: "No menus selected" });
		}

		const blockedIds: string[] = [];
		for (const id of ids) {
			const childrenResult = await db
				.select({ value: count() })
				.from(menus)
				.where(eq(menus.parentId, id));
			if (childrenResult[0]?.value > 0) {
				blockedIds.push(id);
			}
		}

		const deleteIds = ids.filter((id) => !blockedIds.includes(id));

		if (deleteIds.length === 0) {
			return fail(400, { message: "All selected menus have children. Remove them first." });
		}

		try {
			await db.delete(menus).where(inArray(menus.id, deleteIds));
		} catch {
			return fail(400, { message: "Bulk delete failed" });
		}

		return { success: true, skippedIds: blockedIds };
	},

	reorderMenu: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const updatesJson = formData.get("updates") as string | null;

		if (!updatesJson) {
			return fail(400, { message: "Updates data is required" });
		}

		type ReorderItem = { id: string; parentId: string | null; sort_order: number };
		const updates: ReorderItem[] = JSON.parse(updatesJson);

		for (const u of updates) {
			await db
				.update(menus)
				.set({ parentId: u.parentId ?? null, sortOrder: u.sort_order })
				.where(eq(menus.id, u.id));
		}

		return { success: true };
	},
};
