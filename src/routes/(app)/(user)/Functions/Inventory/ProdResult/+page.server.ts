import { db } from "$lib/server/db/index.js";
import { invTran, appSettings, menus, masterBOM, masterItem } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, desc, and, inArray, asc } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";
import { getAllItemInfoMap } from "$lib/(user)/Common/DropdownItemInfo.js";
import { ITEM_ACCT } from "$lib/(user)/Common/DropdownLists.js";

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

function padField(str: string): string {
	return str.padEnd(20, " ");
}

/** ITEM_ACCT code → display name lookup */
const ACCT_NAME_MAP: Record<string, string> = Object.fromEntries(
	ITEM_ACCT.list.map((item) => [item.code, item.value])
);

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, "/login");

	// Get R03 records
	const r03Records = await db
		.select()
		.from(invTran)
		.where(eq(invTran.tranType, "R03"))
		.orderBy(desc(invTran.id));

	// Get associated I01 records (children of R03)
	const r03Ids = r03Records.map((r) => r.id);
	let i01Records: typeof r03Records = [];

	if (r03Ids.length > 0) {
		i01Records = await db
			.select()
			.from(invTran)
			.where(and(
				eq(invTran.tranType, "I01"),
				// Show only I01 records that have a valid Prod_id pointing to an R03
			))
			.orderBy(desc(invTran.id));
		// Filter to only I01 with prodId matching an R03 id
		i01Records = i01Records.filter((r) => r.prodId && r03Ids.includes(Number(r.prodId)));
	}

	// Get I02 records (also displayed but read-only)
	const i02Records = await db
		.select()
		.from(invTran)
		.where(eq(invTran.tranType, "I02"))
		.orderBy(desc(invTran.id));

	// Combine R03, I01, and I02 records
	const allRecords = [...r03Records, ...i01Records, ...i02Records];

	const formatSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "formatQty"),
	});
	const formatQty = formatSetting?.value ?? "#,##0.00";

	const currentMenu = await db.query.menus.findFirst({
		where: eq(menus.path, url.pathname),
	});

	// Production items only: ITEM_ACCT IN ('10', '20')
	const productionRecords = await db
		.select()
		.from(masterItem)
		.where(and(eq(masterItem.isActive, true), inArray(masterItem.itemAcct, ["10", "20"])))
		.orderBy(asc(masterItem.itemAcct), asc(masterItem.itemCode));

	const itemInfo = {
		title: "ITEM_INFO / 품목 정보",
		list: productionRecords.map((r) => ({
			code: r.itemCode,
			value:
				padField(ACCT_NAME_MAP[r.itemAcct] || r.itemAcct) +
				padField(r.itemDesc) +
				padField(r.itemSpec ?? "") +
				padField(r.itemUnit ?? ""),
			stdPrice: r.stdPrice ?? 0,
		})),
	};

	const allItemInfoMap = await getAllItemInfoMap();

	return { records: allRecords, currentUserName: locals.user.name, formatQty, currentMenu, itemInfo, allItemInfoMap };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const documentDtStr = formData.get("Document_dt");
		const tranType = formData.get("Tran_type");
		const tranItem = formData.get("Tran_item");
		const tranQty = formData.get("Tran_qty");
		const tranPrice = formData.get("Tran_price");
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

		const qty = roundByFormat(Number(tranQty), fmt) ?? 0;
		const price = roundByFormat(Number(tranPrice) || 0, fmt) ?? 0;
		const amount = roundByFormat(qty * price, fmt) ?? 0;

		// Insert R03 and return the inserted row
		const [inserted] = await db
			.insert(invTran)
			.values({
				documentDt,
				tranType,
				tranItem,
				tranQty: qty,
				tranPrice: price,
				tranAmount: amount,
				tranRemark: typeof tranRemark === "string" && tranRemark.trim() ? tranRemark : null,
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			})
			.returning();

		const r03Id = inserted.id;

		// Auto-create I01 records based on BOM
		const bomRecords = await db
			.select()
			.from(masterBOM)
			.where(eq(masterBOM.BOM_item_parent, tranItem));

		for (const bom of bomRecords) {
			const i01Qty = (bom.BOM_item_qty || 1) * qty;
			await db.insert(invTran).values({
				documentDt,
				tranType: "I01",
				tranItem: bom.BOM_item,
				tranQty: roundByFormat(i01Qty, fmt) ?? 0,
				tranPrice: 0,
				tranAmount: 0,
				tranRemark: `Auto from R03 #${r03Id}`,
				prodId: String(r03Id),
				createdBy: userName,
				createdAt: now,
				updatedBy: userName,
				updatedAt: now,
			});
		}

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
		const tranPrice = formData.get("Tran_price");
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

		const qty = roundByFormat(Number(tranQty), fmt) ?? 0;
		const price = roundByFormat(Number(tranPrice) || 0, fmt) ?? 0;
		const amount = roundByFormat(qty * price, fmt) ?? 0;

		await db
			.update(invTran)
			.set({
				documentDt,
				tranType,
				tranItem,
				tranQty: qty,
				tranPrice: price,
				tranAmount: amount,
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

		// Delete associated I01 records first
		await db
			.delete(invTran)
			.where(and(eq(invTran.prodId, String(id)), eq(invTran.tranType, "I01")));

		// Then delete the R03
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
				// Delete associated I01 first
				await db
					.delete(invTran)
					.where(and(eq(invTran.prodId, String(id)), eq(invTran.tranType, "I01")));
				// Then delete R03
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
			tranPrice: number;
			tranRemark: string | null;
			prodId: string | null;
		};
		let changes: ChangeItem[];
		try {
			changes = JSON.parse(changesJson);
		} catch {
			return fail(400, { message: "Invalid change data format." });
		}

		// Only process R03 records
		for (const c of changes) {
			if (!c.id || isNaN(c.id)) {
				return fail(400, { message: "Invalid ID in change data." });
			}
			if (c.tranType !== "R03") {
				return fail(400, { message: `Only R03 records can be saved. ID ${c.id} is ${c.tranType}.` });
			}
			if (!c.documentDt || typeof c.documentDt !== "string") {
				return fail(400, { message: `Document Date is required for ID ${c.id}.` });
			}
			if (!c.tranItem || typeof c.tranItem !== "string") {
				return fail(400, { message: `Tran Item is required for ID ${c.id}.` });
			}
			if (c.tranQty == null || isNaN(c.tranQty) || c.tranQty === 0) {
				return fail(400, { message: `Tran Qty must be a non-zero number for ID ${c.id}.` });
			}
			// Price is optional (not required)
		}

		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatQty"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		for (const c of changes) {
			const qty = roundByFormat(c.tranQty, fmt) ?? 0;
			const price = roundByFormat(c.tranPrice ?? 0, fmt) ?? 0;
			const amount = roundByFormat(qty * price, fmt) ?? 0;
			await db
				.update(invTran)
				.set({
					documentDt: new Date(c.documentDt + "T00:00:00"),
					tranType: c.tranType ?? undefined,
					tranItem: c.tranItem ?? undefined,
					tranQty: qty,
					tranPrice: price,
					tranAmount: amount,
					tranRemark: c.tranRemark || undefined,
					prodId: c.prodId ?? undefined,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(invTran.id, c.id));
		}

		return { success: true };
	},
};
