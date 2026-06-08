import { db } from "$lib/server/db/index.js";
import { invTran, appSettings, menus } from "$lib/server/db/schema.js";
import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";
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
		.orderBy(invTran.documentDt);

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
