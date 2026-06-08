import { db } from "$lib/server/db/index.js";
import { invTran, appSettings, menus } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, desc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";
import { getItemInfo } from "$lib/(user)/Common/DropdownItemInfo.js";

// helpers
function parseFormatDecimalPlaces(format: string): number {
	const parts = format.split(".");
	const fracPart = parts[1] || "";
	return [...fracPart].filter((c) => c === "0" || c === "#").length;
}

function roundByFormat(value: number | null | undefined, format: string): number | null {
	if (value == null || isNaN(value)) return null;
	const dp = parseFormatDecimalPlaces(format);
	return Number(value.toFixed(dp));
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, "/login");

	const allRecords = await db
		.select()
		.from(invTran)
		.orderBy(desc(invTran.id));

	const formatSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "formatQty"),
	});
	const formatQty = formatSetting?.value ?? "#,##0.00";

	const currentMenu = await db.query.menus.findFirst({
		where: eq(menus.path, url.pathname),
	});

	const itemInfo = await getItemInfo();

	return { records: allRecords, currentUserName: locals.user.name, formatQty, currentMenu, itemInfo };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const documentDtStr = formData.get("Document_dt");
		const tranType = formData.get("Tran_type");
		const tranItem = formData.get("Tran_item");
		const tranQty = formData.get("Tran_qty");
		const tranRemark = formData.get("Tran_remark");

		if (typeof documentDtStr !== "string" || !documentDtStr.trim()) {
			return fail(400, { field: "Document_dt", message: "Document Date is required" });
		}
		if (typeof tranType !== "string" || !tranType.trim()) {
			return fail(400, { field: "Tran_type", message: "Tran Type is required" });
		}
		if (typeof tranItem !== "string" || !tranItem.trim()) {
			return fail(400, { field: "Tran_item", message: "Tran Item is required" });
		}
		if (tranQty === null || tranQty === "" || isNaN(Number(tranQty)) || Number(tranQty) === 0) {
			return fail(400, { field: "Tran_qty", message: "Tran Qty must be a non-zero number" });
		}

		const documentDt = new Date(documentDtStr + "T00:00:00");
		const userName = locals.user.name;
		const now = new Date();

		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatQty"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		await db.insert(invTran).values({
			documentDt,
			tranType,
			tranItem,
			tranQty: roundByFormat(Number(tranQty), fmt) ?? 0,
			tranRemark: typeof tranRemark === "string" && tranRemark.trim() ? tranRemark : null,
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
		const documentDtStr = formData.get("Document_dt");
		const tranType = formData.get("Tran_type");
		const tranItem = formData.get("Tran_item");
		const tranQty = formData.get("Tran_qty");
		const tranRemark = formData.get("Tran_remark");

		const id = Number(idStr);
		if (!id || isNaN(id)) {
			return fail(400, { message: "Invalid ID" });
		}
		if (typeof documentDtStr !== "string" || !documentDtStr.trim()) {
			return fail(400, { field: "Document_dt", message: "Document Date is required" });
		}
		if (typeof tranType !== "string" || !tranType.trim()) {
			return fail(400, { field: "Tran_type", message: "Tran Type is required" });
		}
		if (typeof tranItem !== "string" || !tranItem.trim()) {
			return fail(400, { field: "Tran_item", message: "Tran Item is required" });
		}
		if (tranQty === null || tranQty === "" || isNaN(Number(tranQty)) || Number(tranQty) === 0) {
			return fail(400, { field: "Tran_qty", message: "Tran Qty must be a non-zero number" });
		}

		const documentDt = new Date(documentDtStr + "T00:00:00");

		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatQty"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		await db
			.update(invTran)
			.set({
				documentDt,
				tranType,
				tranItem,
				tranQty: roundByFormat(Number(tranQty), fmt) ?? 0,
				tranRemark: typeof tranRemark === "string" && tranRemark.trim() ? tranRemark : null,
				updatedBy: locals.user.name,
				updatedAt: new Date(),
			})
			.where(eq(invTran.id, id));

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

		await db.delete(invTran).where(eq(invTran.id, id));

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
				await db.delete(invTran).where(eq(invTran.id, id));
			}
		} catch {
			return fail(400, { message: "Bulk delete failed" });
		}

		return { success: true };
	},

	saveItems: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const changesJson = formData.get("changes") as string | null;

		if (!changesJson) {
			return fail(400, { message: "No change data." });
		}

		type ChangeItem = {
			id: number;
			documentDt: string | null;
			tranType: string | null;
			tranItem: string | null;
			tranQty: number;
			tranRemark: string | null;
		};
		let changes: ChangeItem[];
		try {
			changes = JSON.parse(changesJson);
		} catch {
			return fail(400, { message: "Invalid change data format." });
		}

		for (const c of changes) {
			if (!c.id || isNaN(c.id)) {
				return fail(400, { message: "Invalid ID in change data." });
			}
			if (!c.documentDt || typeof c.documentDt !== "string") {
				return fail(400, { message: `Document Date is required for ID ${c.id}.` });
			}
			if (!c.tranType || typeof c.tranType !== "string") {
				return fail(400, { message: `Tran Type is required for ID ${c.id}.` });
			}
			if (!c.tranItem || typeof c.tranItem !== "string") {
				return fail(400, { message: `Tran Item is required for ID ${c.id}.` });
			}
			if (c.tranQty == null || isNaN(c.tranQty) || c.tranQty === 0) {
				return fail(400, { message: `Tran Qty must be a non-zero number for ID ${c.id}.` });
			}
		}

		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatQty"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		for (const c of changes) {
			await db
				.update(invTran)
				.set({
					documentDt: new Date(c.documentDt + "T00:00:00"),
					tranType: c.tranType ?? undefined,
					tranItem: c.tranItem ?? undefined,
					tranQty: roundByFormat(c.tranQty, fmt) ?? 0,
					tranRemark: c.tranRemark || undefined,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(invTran.id, c.id));
		}

		return { success: true };
	},
};
