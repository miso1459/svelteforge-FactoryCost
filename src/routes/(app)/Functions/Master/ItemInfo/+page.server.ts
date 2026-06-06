import { db } from "$lib/server/db/index.js";
import { masterItem } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const allRecords = await db
		.select()
		.from(masterItem)
		.orderBy(masterItem.createdAt);

	return { records: allRecords, currentUserName: locals.user.name };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const itemCode = formData.get("itemCode");
		const itemDesc = formData.get("itemDesc");
		const itemSpec = formData.get("itemSpec");
		const isActive = formData.get("isActive");
		const itemRemark = formData.get("itemRemark");
		const itemAcct = formData.get("itemAcct");

		if (typeof itemCode !== "string" || itemCode.length < 1 || itemCode.length > 100) {
			return fail(400, { message: "Item Code is required (1-100 characters)" });
		}
		if (typeof itemDesc !== "string" || itemDesc.length < 1 || itemDesc.length > 255) {
			return fail(400, { message: "Item Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		const userName = locals.user.name;
		const now = new Date();

		try {
			await db.insert(masterItem).values({
				itemCode,
				itemDesc,
				itemSpec: typeof itemSpec === "string" && itemSpec.trim() ? itemSpec : null,
				isActive: isActive === "true",
				itemRemark: typeof itemRemark === "string" && itemRemark.trim() ? itemRemark : null,
				itemAcct,
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			});
		} catch {
			return fail(400, { message: "Item Code already exists" });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const itemCode = formData.get("itemCode");
		const itemDesc = formData.get("itemDesc");
		const itemSpec = formData.get("itemSpec");
		const isActive = formData.get("isActive");
		const itemRemark = formData.get("itemRemark");
		const itemAcct = formData.get("itemAcct");

		if (typeof itemCode !== "string" || itemCode.length < 1) {
			return fail(400, { message: "Item Code is required" });
		}
		if (typeof itemDesc !== "string" || itemDesc.length < 1 || itemDesc.length > 255) {
			return fail(400, { message: "Item Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		try {
			await db
				.update(masterItem)
				.set({
					itemDesc,
					itemSpec: typeof itemSpec === "string" && itemSpec.trim() ? itemSpec : null,
					isActive: isActive === "true",
					itemRemark: typeof itemRemark === "string" && itemRemark.trim() ? itemRemark : null,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(masterItem.itemCode, itemCode));
		} catch {
			return fail(400, { message: "Update failed" });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const itemCode = formData.get("id");

		if (typeof itemCode !== "string" || !itemCode.trim()) {
			return fail(400, { message: "Item Code is required" });
		}

		try {
			await db.delete(masterItem).where(eq(masterItem.itemCode, itemCode));
		} catch {
			return fail(400, { message: "Delete failed" });
		}

		return { success: true };
	},

	bulkDelete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idsRaw = formData.get("ids");

		if (typeof idsRaw !== "string" || !idsRaw.trim()) {
			return fail(400, { message: "No records selected" });
		}

		const ids = idsRaw.split(",").filter(Boolean);
		if (ids.length === 0) {
			return fail(400, { message: "No records selected" });
		}

		try {
			await db.delete(masterItem).where(inArray(masterItem.itemCode, ids));
		} catch {
			return fail(400, { message: "Bulk delete failed" });
		}

		return { success: true };
	},
};
