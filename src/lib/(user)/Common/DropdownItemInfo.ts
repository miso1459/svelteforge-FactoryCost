/**
 * Server-side only — this file imports from $lib/server/db.
 * Use `getItemInfo()` in +page.server.ts load functions.
 */

import { db } from "$lib/server/db/index.js";
import { masterItem } from "$lib/server/db/schema.js";
import { asc, eq } from "drizzle-orm";
import { ITEM_ACCT } from "$lib/(user)/Common/DropdownLists.js";

export type CodeValue = {
  code: string;
  value: string;
  stdPrice?: number;
};

export type CodeValueGroup = {
  title: string;
  list: CodeValue[];
};

function padField(str: string): string {
  return str.padEnd(20, " ");
}

/** ITEM_ACCT code → display name lookup (built from DropdownLists.ts) */
const ACCT_NAME_MAP: Record<string, string> = Object.fromEntries(
  ITEM_ACCT.list.map((item) => [item.code, item.value])
);

function resolveAcctName(code: string): string {
  return ACCT_NAME_MAP[code] || code;
}

/**
 * Fetch ITEM_INFO from the Master_Item DB table (active only).
 * Value = Item_Acct 명칭 + Item_Desc + Item_Spec + Item_Unit,
 * each field padded to 20 chars (left-aligned).
 *
 * Call this in your +page.server.ts load function and pass
 * the result to the page via `data`.
 */
export async function getItemInfo(): Promise<CodeValueGroup> {
  const records = await db
    .select()
    .from(masterItem)
    .orderBy(asc(masterItem.itemAcct), asc(masterItem.itemCode));

  return {
    title: "ITEM_INFO / 품목 정보",
    list: records.map((r) => ({
      code: r.itemCode,
      value:
        padField(resolveAcctName(r.itemAcct)) +
        padField(r.itemDesc) +
        padField(r.itemSpec ?? "") +
        padField(r.itemUnit ?? ""),
      stdPrice: r.stdPrice ?? 0,
    })),
  };
}

/**
 * Fetch ALL items (active + inactive) from Master_Item.
 * Used when a row's saved item may be inactive — it must still appear
 * in the dropdown alongside all active items.
 */
export async function getAllItemInfo(): Promise<CodeValueGroup> {
  const records = await db
    .select()
    .from(masterItem)
    .orderBy(asc(masterItem.itemAcct), asc(masterItem.itemCode));

  return {
    title: "ALL_ITEM_INFO",
    list: records.map((r) => ({
      code: r.itemCode,
      value:
        padField(resolveAcctName(r.itemAcct)) +
        padField(r.itemDesc) +
        padField(r.itemSpec ?? "") +
        padField(r.itemUnit ?? ""),
      stdPrice: r.stdPrice ?? 0,
    })),
  };
}

export type ItemInfoMap = Map<string, { value: string; stdPrice: number }>;

/**
 * Returns a Map keyed by itemCode for fast lookup.
 * Useful in +page.svelte for per-row dropdown augmentation.
 */
export async function getAllItemInfoMap(): Promise<ItemInfoMap> {
  const records = await db
    .select()
    .from(masterItem)
    .orderBy(asc(masterItem.itemAcct), asc(masterItem.itemCode));

  const map: ItemInfoMap = new Map();
  for (const r of records) {
    map.set(r.itemCode, {
      value:
        padField(resolveAcctName(r.itemAcct)) +
        padField(r.itemDesc) +
        padField(r.itemSpec ?? "") +
        padField(r.itemUnit ?? ""),
      stdPrice: r.stdPrice ?? 0,
    });
  }
  return map;
}
