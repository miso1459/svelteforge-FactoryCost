import Database from "better-sqlite3";
const sqlite = new Database("./svelteforge.db");
const r = sqlite
	.prepare(
		"UPDATE menus SET desc = '입출고 거래 이력 조회', updated_at = unixepoch() WHERE path = '/Functions/Inventory/InvTranHistory'",
	)
	.run();
console.log("Updated rows:", r.changes);
sqlite.close();
