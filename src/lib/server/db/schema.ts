import { sqliteTable, text, integer, real, uniqueIndex, primaryKey, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	name: text("name").notNull(),
	avatarUrl: text("avatar_url"),
	role: text("role", { enum: ["admin", "editor", "viewer", "guest"] })
		.notNull()
		.default("guest"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	expiresAt: integer("expires_at").notNull(),
	userAgent: text("user_agent"),
	ipAddress: text("ip_address"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const pages = sqliteTable("pages", {
	id: text("id").primaryKey(),
	title: text("title").notNull(),
	slug: text("slug").notNull().unique(),
	content: text("content").notNull().default(""),
	template: text("template", { enum: ["default", "landing", "blog"] })
		.notNull()
		.default("default"),
	status: text("status", { enum: ["draft", "published", "archived"] })
		.notNull()
		.default("draft"),
	authorId: text("author_id")
		.notNull()
		.references(() => users.id),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	publishedAt: integer("published_at", { mode: "timestamp" }),
});

export const notifications = sqliteTable("notifications", {
	id: text("id").primaryKey(),
	userId: text("user_id").references(() => users.id),
	title: text("title").notNull(),
	message: text("message").notNull(),
	type: text("type", { enum: ["info", "warning", "error", "success"] })
		.notNull()
		.default("info"),
	read: integer("read", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const passwordResetTokens = sqliteTable("password_reset_tokens", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	tokenHash: text("token_hash").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

export const oauthAccounts = sqliteTable(
	"oauth_accounts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		provider: text("provider", { enum: ["google", "github"] }).notNull(),
		providerUserId: text("provider_user_id").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [uniqueIndex("oauth_provider_user_idx").on(table.provider, table.providerUserId)]
);

export const template01 = sqliteTable("template01", {
	code: text("code").primaryKey(),
	desc: text("desc").notNull(),
	remark: text("remark"),
	itemAcct: text("item_acct").notNull(),
	dateValid: integer("date_valid", { mode: "timestamp" }),
	createdBy: text("created_by").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedBy: text("updated_by").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const template02 = sqliteTable(
	"template02",
	{
		documentDt: integer("document_dt", { mode: "timestamp" }).notNull(),
		code: text("code").notNull(),
		desc: text("desc").notNull(),
		remark: text("remark"),
		itemAcct: text("item_acct").notNull(),
		dateValid: integer("date_valid", { mode: "timestamp" }),
		createdBy: text("created_by").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: text("updated_by").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.documentDt, table.code] }),
	})
);

export const appSettings = sqliteTable("app_settings", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export const menus = sqliteTable("menus", {
	id: text("id").primaryKey(),
	type: text("type", { enum: ["folder", "link"] }).notNull(),
	name: text("name").notNull(),
	desc: text("desc"),
	path: text("path"),
	icon: text("icon"),
	role: text("role").notNull().default("[]"),
	sortOrder: integer("sort_order").notNull().default(0),
	parentId: text("parent_id").references((): AnySQLiteColumn => menus.id),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	prompt: text("prompt"),
	createdBy: text("created_by").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedBy: text("updated_by").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;

export const masterItem = sqliteTable("Master_Item", {
	itemCode: text("item_code").primaryKey(),
	itemDesc: text("item_desc").notNull(),
	itemSpec: text("item_spec"),
	itemUnit: text("item_unit"),
	stdPrice: real("std_price"),
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	itemRemark: text("item_remark"),
	itemAcct: text("item_acct").notNull(),
	createdBy: text("created_by").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
	updatedBy: text("updated_by").notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.$defaultFn(() => new Date()),
});

export type Template01 = typeof template01.$inferSelect;
export type NewTemplate01 = typeof template01.$inferInsert;

export type MasterItem = typeof masterItem.$inferSelect;
export type NewMasterItem = typeof masterItem.$inferInsert;

export const template03 = sqliteTable(
	"template03",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		documentDt: integer("document_dt", { mode: "timestamp" }).notNull(),
		code: text("code").notNull(),
		desc: text("desc").notNull(),
		remark: text("remark"),
		itemAcct: text("item_acct").notNull(),
		dateValid: integer("date_valid", { mode: "timestamp" }),
		createdBy: text("created_by").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedBy: text("updated_by").notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	}
);

export type Template02 = typeof template02.$inferSelect;
export type NewTemplate02 = typeof template02.$inferInsert;

export type Template03 = typeof template03.$inferSelect;
export type NewTemplate03 = typeof template03.$inferInsert;

export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
