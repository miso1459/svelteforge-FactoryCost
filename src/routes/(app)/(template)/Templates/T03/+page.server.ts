import { db } from "$lib/server/db/index.js";
import { template03 } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, "/login");

	const allRecords = await db
		.select()
		.from(template03)
		.orderBy(desc(template03.id));

	return { records: allRecords, currentUserName: locals.user.name };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const documentDtStr = formData.get("documentDt");
		const code = formData.get("code");
		const desc = formData.get("desc");
		const remark = formData.get("remark");
		const itemAcct = formData.get("itemAcct");
		const dateValid = formData.get("dateValid");

		if (typeof documentDtStr !== "string" || !documentDtStr.trim()) {
			return fail(400, { message: "Document Date is required" });
		}
		if (typeof code !== "string" || code.length < 1 || code.length > 100) {
			return fail(400, { message: "Code is required (1-100 characters)" });
		}
		if (typeof desc !== "string" || desc.length < 1 || desc.length > 255) {
			return fail(400, { message: "Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		const documentDt = new Date(documentDtStr + "T00:00:00");
		const userName = locals.user.name;
		const now = new Date();
		const dateValidVal = typeof dateValid === "string" && dateValid.trim()
			? new Date(dateValid + "T00:00:00")
			: null;

		await db.insert(template03).values({
			documentDt,
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

		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idStr = formData.get("id");
		const documentDtStr = formData.get("documentDt");
		const code = formData.get("code");
		const desc = formData.get("desc");
		const remark = formData.get("remark");
		const itemAcct = formData.get("itemAcct");
		const dateValid = formData.get("dateValid");

		const id = Number(idStr);
		if (!id || isNaN(id)) {
			return fail(400, { message: "Invalid ID" });
		}

		if (typeof documentDtStr !== "string" || !documentDtStr.trim()) {
			return fail(400, { message: "Document Date is required" });
		}
		if (typeof code !== "string" || code.length < 1 || code.length > 100) {
			return fail(400, { message: "Code is required (1-100 characters)" });
		}
		if (typeof desc !== "string" || desc.length < 1 || desc.length > 255) {
			return fail(400, { message: "Desc is required (1-255 characters)" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		const documentDt = new Date(documentDtStr + "T00:00:00");
		const dateValidVal = typeof dateValid === "string" && dateValid.trim()
			? new Date(dateValid + "T00:00:00")
			: null;

		await db
			.update(template03)
			.set({
				documentDt,
				code,
				desc,
				remark: typeof remark === "string" && remark.trim() ? remark : null,
				itemAcct,
				dateValid: dateValidVal,
				updatedBy: locals.user.name,
				updatedAt: new Date(),
			})
			.where(eq(template03.id, id));

		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idStr = formData.get("id");

		const id = Number(idStr);
		if (!id || isNaN(id)) {
			return fail(400, { message: "Invalid ID" });
		}

		await db.delete(template03).where(eq(template03.id, id));

		return { success: true };
	},

	bulkDelete: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const idsRaw = formData.get("ids");

		if (typeof idsRaw !== "string" || !idsRaw.trim()) {
			return fail(400, { message: "No records selected" });
		}

		const ids = idsRaw.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
		if (ids.length === 0) {
			return fail(400, { message: "No records selected" });
		}

		try {
			for (const id of ids) {
				await db.delete(template03).where(eq(template03.id, id));
			}
		} catch {
			return fail(400, { message: "Bulk delete failed" });
		}

		return { success: true };
	},
};
