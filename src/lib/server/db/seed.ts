import { fileURLToPath } from "node:url";
import { db } from "./index.js";
import { appSettings, menus, sessions, users, pages, notifications, oauthAccounts, passwordResetTokens } from "./schema.js";
import { sql } from "drizzle-orm";
import { generateId } from "../id.js";

export async function seedDemo() {
	console.log("Clearing existing data...");

	// Temporarily disable FK checks to clear tables in any order
	db.run(sql`PRAGMA foreign_keys = OFF`);

	db.delete(appSettings).run();
	db.delete(notifications).run();
	db.delete(sessions).run();
	db.delete(pages).run();
	db.delete(menus).run();
	db.delete(users).run();
	db.delete(oauthAccounts).run();
	db.delete(passwordResetTokens).run();

	db.run(sql`PRAGMA foreign_keys = ON`);

	// --- APP SETTINGS (from current production data) ---
	console.log("Creating app settings...");
	const settingsData = [
		{ key: "defaultRole", value: "guest" },
		{ key: "formatAmount", value: "#,##0" },
		{ key: "formatPrice", value: "#,##0.00" },
		{ key: "formatQty", value: "#,##0.00" },
		{ key: "maintenanceMode", value: "false" },
		{ key: "siteName", value: "SvelteForge Factory Cost" },
		{ key: "timezone", value: "Asia/Seoul" },
	];

	for (const s of settingsData) {
		await db.insert(appSettings).values({
			key: s.key,
			value: s.value,
			updatedAt: new Date(),
		});
	}
	console.log(`  Created ${settingsData.length} app settings`);

	// --- MENUS (hierarchical navigation structure) ---
	console.log("Creating menus...");
	const now = new Date();
	const createdBy = "admin";
	const masterFolderId = generateId(10);
	const inventoryFolderId = generateId(10);

	const menuData = [
		{
			id: masterFolderId,
			type: "folder" as const,
			name: "Master",
			desc: null,
			path: null,
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 0,
			parentId: null,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "Item Info",
			desc: "Manage item master data including codes, descriptions, units, and attributes for all materials and products.",
			path: "/Functions/Master/ItemInfo",
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 0,
			parentId: masterFolderId,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "B.O.M Info",
			desc: "Manage materials, components, and quantities required to manufacture a product.",
			path: "/Functions/Master/BOMInfo",
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 0,
			parentId: masterFolderId,
			isActive: true,
			prompt: null,
		},
		{
			id: inventoryFolderId,
			type: "folder" as const,
			name: "Inventory",
			desc: null,
			path: null,
			icon: "folder-tree",
			role: '["admin","editor"]',
			sortOrder: 1,
			parentId: null,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "Inventory Transaction",
			desc: null,
			path: "/Functions/Inventory/InvTran",
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 1,
			parentId: inventoryFolderId,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "Current Inventory",
			desc: null,
			path: "/Functions/Inventory/InvCurrent",
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 2,
			parentId: inventoryFolderId,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "Production Result",
			desc: "Production receipt management (R03 user registration, I01 auto-generation)",
			path: "/Functions/Inventory/ProdResult",
			icon: null,
			role: '["admin","editor"]',
			sortOrder: 3,
			parentId: inventoryFolderId,
			isActive: true,
			prompt: null,
		},
		{
			id: generateId(10),
			type: "link" as const,
			name: "Inv. Tran. History",
			desc: "Inventory transaction history - read-only view of all inventory movements",
			path: "/Functions/Inventory/InvTranHistory",
			icon: null,
			role: '["admin","editor","viewer"]',
			sortOrder: 4,
			parentId: inventoryFolderId,
			isActive: true,
			prompt: null,
		},
	];

	for (const m of menuData) {
		await db.insert(menus).values({
			id: m.id,
			type: m.type,
			name: m.name,
			desc: m.desc,
			path: m.path,
			icon: m.icon,
			role: m.role,
			sortOrder: m.sortOrder,
			parentId: m.parentId,
			isActive: m.isActive,
			prompt: m.prompt,
			createdBy,
			createdAt: now,
			updatedBy: createdBy,
			updatedAt: now,
		});
	}
	console.log(`  Created ${menuData.length} menus`);

	console.log("\nSeed complete!");
	console.log(`  ${settingsData.length} app settings`);
	console.log(`  ${menuData.length} menus`);
}

// Auto-run when invoked as a CLI (e.g. `tsx src/lib/server/db/seed.ts`)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	seedDemo().catch((err) => {
		console.error("Seed failed:", err);
		process.exit(1);
	});
}
