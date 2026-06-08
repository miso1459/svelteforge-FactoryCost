import { db } from "$lib/server/db/index.js";
import { invTran, appSettings, menus } from "$lib/server/db/schema.js";
import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types.js";
import { getItemInfo } from "$lib/(user)/Common/DropdownItemInfo.js";

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
