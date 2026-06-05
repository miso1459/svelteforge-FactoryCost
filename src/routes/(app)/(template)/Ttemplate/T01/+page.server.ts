import { db } from "$lib/server/db/index.js";
import { template01 } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const allRecords = await db
		.select()
		.from(template01)
		.orderBy(template01.createdAt);

	return { records: allRecords, currentUserName: locals.user.name };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const code = formData.get("code");
		const desc = formData.get("desc");
		const remark = formData.get("remark");
		const itemAcct = formData.get("itemAcct");
		const dateValid = formData.get("dateValid");

		if (typeof code !== "string" || code.length < 1 || code.length > 100) {
			return fail(400, { message: "Code is required (1-100 characters)" });
		}
		if (typeof desc !== "string" || desc.length < 1 || desc.length > 255) {
			return fail(400, { message: "Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		const userName = locals.user.name;
		const now = new Date();
		const dateValidVal = typeof dateValid === "string" && dateValid.trim()
			? new Date(dateValid + "T00:00:00")
			: null;

		try {
			await db.insert(template01).values({
				code,
				desc,
				remark: typeof remark === "string" && remark.trim() ? remark : null,
				itemAcct,
				dateValid: dateValidVal,
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			});
		} catch {
			return fail(400, { message: "Code already exists" });
		}

		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const code = formData.get("code");
		const desc = formData.get("desc");
		const remark = formData.get("remark");
		const itemAcct = formData.get("itemAcct");
		const dateValid = formData.get("dateValid");

		if (typeof code !== "string" || code.length < 1) {
			return fail(400, { message: "Code is required" });
		}
		if (typeof desc !== "string" || desc.length < 1 || desc.length > 255) {
			return fail(400, { message: "Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		const dateValidVal = typeof dateValid === "string" && dateValid.trim()
			? new Date(dateValid + "T00:00:00")
			: null;

		try {
			await db
				.update(template01)
				.set({
					desc,
					remark: typeof remark === "string" && remark.trim() ? remark : null,
					itemAcct,
					dateValid: dateValidVal,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(template01.code, code));
		} catch {
			return fail(400, { message: "Update failed" });
		}

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const code = formData.get("id");

		if (typeof code !== "string" || !code.trim()) {
			return fail(400, { message: "Code is required" });
		}

		try {
			await db.delete(template01).where(eq(template01.code, code));
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
			await db.delete(template01).where(inArray(template01.code, ids));
		} catch {
			return fail(400, { message: "Bulk delete failed" });
		}

		return { success: true };
	},
};
