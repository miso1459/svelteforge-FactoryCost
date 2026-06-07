import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
	createTestDb,
	createTestUser,
	createMockLocals,
	createFormData,
	createMockRequest,
} from "$lib/server/db/test-utils.js";
import { masterItem, appSettings } from "$lib/server/db/schema.js";

let testDb: ReturnType<typeof createTestDb>;
let adminId: string;

vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));

const { actions } = await import("./+page.server.js");

describe("ItemInfo saveItems", () => {
	beforeEach(async () => {
		testDb = createTestDb();

		// Master_Item table not in test-utils SCHEMA_SQL — create manually
		testDb.run(/* sql */ `
			CREATE TABLE IF NOT EXISTS "Master_Item" (
				"item_code" text PRIMARY KEY NOT NULL,
				"item_desc" text NOT NULL,
				"item_spec" text,
				"item_unit" text,
				"std_price" real,
				"is_active" integer DEFAULT 1 NOT NULL,
				"item_remark" text,
				"item_acct" text NOT NULL,
				"created_by" text NOT NULL,
				"created_at" integer NOT NULL,
				"updated_by" text NOT NULL,
				"updated_at" integer NOT NULL
			)
		`);

		adminId = await createTestUser(testDb, {
			name: "Admin",
			email: "admin@test.com",
			username: "admin",
			role: "admin",
		});

		// Seed two test items
		await testDb.insert(masterItem).values([
			{
				itemCode: "ITEM001",
				itemDesc: "Item Alpha",
				itemSpec: "Spec A",
				itemUnit: "EA",
				stdPrice: 100,
				isActive: true,
				itemRemark: "remark1",
				itemAcct: "10",
				createdBy: "Admin",
				createdAt: new Date(),
				updatedBy: "Admin",
				updatedAt: new Date(),
			},
			{
				itemCode: "ITEM002",
				itemDesc: "Item Beta",
				itemSpec: "Spec B",
				itemUnit: "KG",
				stdPrice: 200,
				isActive: false,
				itemRemark: "remark2",
				itemAcct: "20",
				createdBy: "Admin",
				createdAt: new Date(),
				updatedBy: "Admin",
				updatedAt: new Date(),
			},
		]);
	});

	it("updates multiple items with JSON changes", async () => {
		const changes = [
			{
				itemCode: "ITEM001",
				itemDesc: "Updated Alpha",
				itemSpec: "New Spec A",
				itemUnit: "PC",
				stdPrice: 150,
				isActive: false,
				itemRemark: "updated remark",
			},
			{
				itemCode: "ITEM002",
				itemDesc: "Updated Beta",
				itemSpec: "New Spec B",
				itemUnit: "BOX",
				stdPrice: 250,
				isActive: true,
				itemRemark: null,
			},
		];

		const formData = createFormData({ changes: JSON.stringify(changes) });

		const result = await actions.saveItems({
			request: createMockRequest(formData),
			locals: createMockLocals(adminId),
		} as any);

		expect(result).toEqual({ success: true });

		// Verify item 1 updated
		const rows1: any = await testDb
			.select()
			.from(masterItem)
			.where(eq(masterItem.itemCode, "ITEM001"));
		expect(rows1[0].itemDesc).toBe("Updated Alpha");
		expect(rows1[0].itemSpec).toBe("New Spec A");
		expect(rows1[0].itemUnit).toBe("PC");
		expect(rows1[0].stdPrice).toBe(150);
		expect(rows1[0].isActive).toBe(false);
		expect(rows1[0].itemRemark).toBe("updated remark");

		// Verify item 2 updated
		const rows2: any = await testDb
			.select()
			.from(masterItem)
			.where(eq(masterItem.itemCode, "ITEM002"));
		expect(rows2[0].itemDesc).toBe("Updated Beta");
		expect(rows2[0].itemSpec).toBe("New Spec B");
		expect(rows2[0].itemUnit).toBe("BOX");
		expect(rows2[0].stdPrice).toBe(250);
		expect(rows2[0].isActive).toBe(true);
		expect(rows2[0].itemRemark).toBeNull();
	});

	it("returns 400 on empty changes", async () => {
		const formData = createFormData({ changes: "" });

		const result = await actions.saveItems({
			request: createMockRequest(formData),
			locals: createMockLocals(adminId),
		} as any);

		expect(result).toHaveProperty("status", 400);
		expect(result).toHaveProperty("data");
	});

	it("returns 400 on missing itemDesc", async () => {
		const changes = [
			{
				itemCode: "ITEM001",
				itemDesc: "",
				itemSpec: "Spec",
				itemUnit: "EA",
				stdPrice: 100,
				isActive: true,
				itemRemark: null,
			},
		];

		const formData = createFormData({ changes: JSON.stringify(changes) });

		const result = await actions.saveItems({
			request: createMockRequest(formData),
			locals: createMockLocals(adminId),
		} as any);

		expect(result).toHaveProperty("status", 400);
	});

	it("rounds stdPrice correctly", async () => {
		// Insert formatPrice setting: 2 decimal places
		await testDb.insert(appSettings).values({
			key: "formatPrice",
			value: "#,##0.00",
			updatedAt: new Date(),
		});

		const changes = [
			{
				itemCode: "ITEM001",
				itemDesc: "Rounded Item",
				itemSpec: "Spec",
				itemUnit: "EA",
				stdPrice: 123.456,
				isActive: true,
				itemRemark: null,
			},
		];

		const formData = createFormData({ changes: JSON.stringify(changes) });

		const result = await actions.saveItems({
			request: createMockRequest(formData),
			locals: createMockLocals(adminId),
		} as any);

		expect(result).toEqual({ success: true });

		const rows: any = await testDb
			.select()
			.from(masterItem)
			.where(eq(masterItem.itemCode, "ITEM001"));
		expect(rows[0].stdPrice).toBe(123.46);
	});
});
