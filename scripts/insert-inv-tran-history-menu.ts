import Database from "better-sqlite3";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";

function generateId(length: number = 10): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return encodeBase32LowerCaseNoPadding(bytes);
}

// Connect to the SQLite database (same path as db/index.ts)
const dbPath = process.env.DATABASE_URL || "svelteforge.db";
const sqlite = new Database(dbPath);

// Find Inventory folder menu
const folder = sqlite
	.prepare("SELECT id FROM menus WHERE name = ? AND type = ?")
	.get("Inventory", "folder") as { id: string } | undefined;

if (!folder) {
	console.error("Inventory folder menu not found!");
	process.exit(1);
}

console.log(`Found Inventory folder: ${folder.id}`);

// Insert InvTranHistory menu
const id = generateId(10);
const now = new Date().toISOString();

const stmt = sqlite.prepare(`
	INSERT INTO menus (id, type, name, desc, path, icon, role, sort_order, parent_id, is_active, prompt, created_by, created_at, updated_by, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

stmt.run(
	id,
	"link",
	"Inv. Tran. History",
	"Inventory transaction history - read-only view",
	"/Functions/Inventory/InvTranHistory",
	null,
	'["admin","editor"]',
	4,
	folder.id,
	1, // is_active
	null,
	"admin",
	now,
	"admin",
	now,
);

console.log(`Inserted InvTranHistory menu with id: ${id}`);

sqlite.close();
