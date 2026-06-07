import { db } from "$lib/server/db/index.js";
import { masterItem, appSettings, menus } from "$lib/server/db/schema.js";
import { fail, redirect } from "@sveltejs/kit";
import { eq, inArray } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types.js";

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
		.from(masterItem)
		.orderBy(masterItem.createdAt);

	// Load formatPrice from app settings
	const formatSetting = await db.query.appSettings.findFirst({
		where: eq(appSettings.key, "formatPrice"),
	});
	const formatPrice = formatSetting?.value ?? "#,##0.00";

	// Load current menu info from menus table for page header
	const currentMenu = await db.query.menus.findFirst({
		where: eq(menus.path, url.pathname),
	});

	return { records: allRecords, currentUserName: locals.user.name, formatPrice, currentMenu };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const itemCode = formData.get("itemCode");
		const itemDesc = formData.get("itemDesc");
		const itemSpec = formData.get("itemSpec");
		const itemUnit = formData.get("itemUnit");
		const stdPrice = formData.get("stdPrice");
		const isActive = formData.get("isActive");
		const itemRemark = formData.get("itemRemark");
		const itemAcct = formData.get("itemAcct");

		if (typeof itemCode !== "string" || itemCode.length < 1 || itemCode.length > 100) {
			return fail(400, { message: "Item Code is required (1-100 characters)" });
		}
		if (typeof itemDesc !== "string" || itemDesc.length < 1 || itemDesc.length > 255) {
			return fail(400, { message: "Item Desc is required (1-255 characters)" });
		}
		if (typeof itemUnit !== "string" || itemUnit.length < 1) {
			return fail(400, { message: "Item Unit is required" });
		}
		if (typeof itemAcct !== "string" || itemAcct.length < 1) {
			return fail(400, { message: "Item Acct is required" });
		}

		// Load formatPrice for rounding
		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatPrice"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		const userName = locals.user.name;
		const now = new Date();

		try {
			await db.insert(masterItem).values({
				itemCode,
				itemDesc,
				itemSpec: typeof itemSpec === "string" && itemSpec.trim() ? itemSpec : null,
				itemUnit: typeof itemUnit === "string" && itemUnit.trim() ? itemUnit : null,
				stdPrice: roundByFormat(stdPrice !== null && stdPrice !== "" ? Number(stdPrice) : null, fmt),
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
		const itemUnit = formData.get("itemUnit");
		const stdPrice = formData.get("stdPrice");
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

		// Load formatPrice for rounding
		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatPrice"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		try {
			await db
				.update(masterItem)
				.set({
					itemDesc,
					itemSpec: typeof itemSpec === "string" && itemSpec.trim() ? itemSpec : null,
					itemUnit: typeof itemUnit === "string" && itemUnit.trim() ? itemUnit : null,
					stdPrice: roundByFormat(stdPrice !== null && stdPrice !== "" ? Number(stdPrice) : null, fmt),
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

	saveItems: async ({ request, locals }) => {
		if (!locals.user) redirect(302, "/login");

		const formData = await request.formData();
		const changesJson = formData.get("changes") as string | null;

		if (!changesJson) {
			return fail(400, { message: "No change data." });
		}

		type ChangeItem = {
			itemCode: string;
			itemDesc: string;
			itemSpec: string | null;
			itemUnit: string | null;
			stdPrice: number | null;
			isActive: boolean;
			itemRemark: string | null;
		};
		let changes: ChangeItem[];
		try {
			changes = JSON.parse(changesJson);
		} catch {
			return fail(400, { message: "Invalid change data format." });
		}

		// 필드 검증
		for (const c of changes) {
			if (!c.itemCode || !c.itemDesc) {
				return fail(400, { message: "Item Code and Item Desc are required." });
			}
		}

		// Load formatPrice for rounding
		const fmtSetting = await db.query.appSettings.findFirst({
			where: eq(appSettings.key, "formatPrice"),
		});
		const fmt = fmtSetting?.value ?? "#,##0.00";

		for (const c of changes) {
			await db
				.update(masterItem)
				.set({
					itemDesc: c.itemDesc,
					itemSpec: c.itemSpec || null,
					itemUnit: c.itemUnit || null,
					stdPrice: roundByFormat(c.stdPrice, fmt),
					isActive: c.isActive,
					itemRemark: c.itemRemark || null,
					updatedBy: locals.user.name,
					updatedAt: new Date(),
				})
				.where(eq(masterItem.itemCode, c.itemCode));
		}

		return { success: true };
	},
};
