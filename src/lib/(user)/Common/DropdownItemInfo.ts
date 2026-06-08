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
 * Fetch ITEM_INFO from the Master_Item DB table.
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
    .where(eq(masterItem.isActive, true))
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
