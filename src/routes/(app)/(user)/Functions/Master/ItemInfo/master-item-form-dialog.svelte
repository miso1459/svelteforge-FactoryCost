<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Switch } from "$lib/components/ui/switch/index.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import { ITEM_ACCT, UNIT, type CodeValue } from "$lib/(user)/Common/DropdownLists.js";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import XIcon from "@lucide/svelte/icons/x";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import PencilIcon from "@lucide/svelte/icons/pencil";
	import { parseFormatPattern, formatStdPrice } from "$lib/utils/format.js";

	type MasterItemData = {
		itemCode: string;
		itemDesc: string;
		itemSpec: string | null;
		itemUnit: string | null;
		stdPrice: number | null;
		isActive: boolean;
		itemRemark: string | null;
		itemAcct: string;
	};

	type Props = {
		open: boolean;
		mode: "create" | "edit";
		data?: MasterItemData | null;
		formatPrice?: string;
	};

	let { open = $bindable(false), mode, data = null, formatPrice = "#,##0.00" }: Props = $props();

	const title = $derived(mode === "create" ? "Add Item" : "Edit Item");
	const action = $derived(mode === "create" ? "?/create" : "?/update");

	// Flat list from ITEM_ACCT group
	const acctItems: CodeValue[] = $derived(ITEM_ACCT.list);
	// Flat list from UNIT group
	const unitItems: CodeValue[] = $derived(UNIT.list);

	const isReadonly = $derived(mode === "edit");

	const inputClasses = {
		pk: "border-blue-400 focus-visible:ring-blue-400 focus:ring-2 focus:ring-blue-400",
		required: "border-amber-400 focus-visible:ring-amber-400 focus:ring-2 focus:ring-amber-400",
		optional: "border-muted-foreground/20 focus-visible:ring-muted-foreground/40 focus:ring-2 focus:ring-muted-foreground/40",
		purple:
			"border-purple-400 focus-visible:ring-purple-400 focus:ring-2 focus:ring-purple-400",
		readonly:
			"border-black dark:border-white border-2 bg-muted/60 dark:bg-zinc-800 pointer-events-none",
		readonlyPurple:
			"border-purple-400 border-2 bg-muted/60 dark:bg-zinc-800 pointer-events-none",
	};

	let isActive = $state(true);
	let itemAcct = $state("");
	let itemUnit = $state("");
	let stdPriceRaw = $state<number | null>(null);
	let stdPriceDisplay = $state("");

	// ── Focus / Outline ─────────────────────────────────────────────────────
	function focusField(field: string) {
		if (field === "itemAcct") {
			// Purple outline to match label + inputClasses.purple
			const btn = document.querySelector(`#${field} button`) as HTMLElement | null;
			if (btn) {
				btn.focus();
				btn.style.outline = "2px solid #a855f7";
				btn.style.outlineOffset = "2px";
			}
		} else if (field === "itemUnit") {
			const btn = document.querySelector(`#${field} button`) as HTMLElement | null;
			if (btn) {
				btn.focus();
				btn.style.outline = "2px solid #fbbf24";
				btn.style.outlineOffset = "2px";
			}
		} else {
			const el = document.getElementById(field);
			if (el) el.focus();
		}
	}

	// ── Client-side pre-validation (one field at a time) ────────────────────
	function handleSubmit(e: SubmitEvent) {
		if (!itemAcct.trim()) {
			e.preventDefault();
			toast.error("Item Acct is required");
			focusField("itemAcct");
			return;
		}
		const descEl = document.getElementById("itemDesc") as HTMLInputElement | null;
		if (!descEl?.value?.trim()) {
			e.preventDefault();
			toast.error("Item Desc is required (1-255 characters)");
			focusField("itemDesc");
			return;
		}
		if (!itemUnit.trim()) {
			e.preventDefault();
			toast.error("Item Unit is required");
			focusField("itemUnit");
			return;
		}
	}

	// ── Clear outline when dropdown value changes ──────────────────────────
	$effect(() => {
		if (itemAcct) {
			const btn = document.querySelector("#itemAcct button") as HTMLElement | null;
			if (btn) btn.style.outline = "";
		}
	});
	$effect(() => {
		if (itemUnit) {
			const btn = document.querySelector("#itemUnit button") as HTMLElement | null;
			if (btn) btn.style.outline = "";
		}
	});

	function onStdPriceInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, "");
		stdPriceRaw = raw ? Number(raw) : null;
		stdPriceDisplay = raw;
	}

	function onStdPriceBlur() {
		if (stdPriceRaw !== null) {
			const { decimalPlaces } = parseFormatPattern(formatPrice);
			stdPriceRaw = Number(stdPriceRaw.toFixed(decimalPlaces));
			stdPriceDisplay = formatStdPrice(stdPriceRaw, formatPrice);
		} else {
			stdPriceDisplay = "";
		}
	}

	$effect(() => {
		if (open) {
			if (data) {
				isActive = data.isActive;
				itemAcct = data.itemAcct;
				itemUnit = data.itemUnit ?? "";
				const { decimalPlaces } = parseFormatPattern(formatPrice);
				stdPriceRaw = data.stdPrice != null ? Number(Number(data.stdPrice).toFixed(decimalPlaces)) : null;
				stdPriceDisplay = data.stdPrice != null ? formatStdPrice(data.stdPrice, formatPrice) : "";
			} else {
				isActive = true;
				itemAcct = "";
				itemUnit = "";
				stdPriceRaw = null;
				stdPriceDisplay = "";
			}
		}
	});

</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[450px]">
		<Dialog.Header>
			<Dialog.Title>{title}</Dialog.Title>
			<Dialog.Description>
				{mode === "create"
					? "Create a new master item."
					: "Update master item details."}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			{action}
			onsubmit={handleSubmit}
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						open = false;
					} else if (result.type === "failure") {
						const data = result.data as { message?: string; field?: string } | undefined;
						if (data?.message) toast.error(data.message);
						if (data?.field) focusField(data.field);
					}
					await update();
				};
			}}
		>
			{#if mode === "edit" && data}
				<input type="hidden" name="itemCode" value={data.itemCode} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="grid gap-2 relative">
					<Label for="itemAcct" class="font-semibold text-purple-600 dark:text-purple-400">Item Acct * <span class="text-xs font-normal text-muted-foreground">(cannot be changed after save)</span></Label>
					<div id="itemAcct" class="relative rounded-md">
						<input type="hidden" name="itemAcct" value={itemAcct} />
						<SearchableSelect
							items={acctItems}
							bind:value={itemAcct}
							placeholder="Search item acct..."
							class={isReadonly ? inputClasses.readonlyPurple : inputClasses.purple}
							disabled={isReadonly}
						/>
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="itemCode" class="font-semibold text-blue-600 dark:text-blue-400">Item Code (PK)</Label>
					<Input
						id="itemCode"
						name="itemCode"
						value={data?.itemCode ?? ""}
						required={isReadonly}
						placeholder={mode === "create" ? "Auto-generated if empty" : ""}
						class={isReadonly ? inputClasses.readonly : inputClasses.pk}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="itemDesc" class="font-medium text-amber-600 dark:text-amber-400">Item Desc *</Label>
					<Input id="itemDesc" name="itemDesc" value={data?.itemDesc ?? ""} class={inputClasses.required} />
				</div>
				<div class="grid gap-2">
					<Label for="itemSpec" class="text-muted-foreground">Item Spec</Label>
					<Input id="itemSpec" name="itemSpec" value={data?.itemSpec ?? ""} class={inputClasses.optional} />
				</div>
				<div class="grid gap-2 relative">
					<Label for="itemUnit" class="font-medium text-amber-600 dark:text-amber-400">Item Unit *</Label>
					<div id="itemUnit" class="relative rounded-md">
						<input type="hidden" name="itemUnit" value={itemUnit} />
						<SearchableSelect
							items={unitItems}
							bind:value={itemUnit}
							placeholder="Search unit..."
							class={inputClasses.required}
						/>
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="stdPrice" class="text-muted-foreground">Std Price</Label>
					<input type="hidden" name="stdPrice" value={stdPriceRaw ?? ""} />
					<Input
						id="stdPrice"
						type="text"
						inputmode="decimal"
						value={stdPriceDisplay}
						oninput={onStdPriceInput}
						onblur={onStdPriceBlur}
						class={inputClasses.optional}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="isActive" class="text-muted-foreground">Is Active</Label>
					<div class="flex items-center gap-3">
						<input type="hidden" name="isActive" value={String(isActive)} />
						<Switch bind:checked={isActive} />
						<span class="text-sm {isActive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
							{isActive ? 'Active' : 'Inactive'}
						</span>
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="itemRemark" class="text-muted-foreground">Item Remark</Label>
					<textarea
						id="itemRemark"
						name="itemRemark"
						rows="3"
						class="border-muted-foreground/20 focus-visible:ring-muted-foreground/40 flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>{data?.itemRemark ?? ""}</textarea>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>
					<XIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<Button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
					{#if mode === "edit"}
						<PencilIcon class="mr-2 size-4" />
						Edit
					{:else}
						<PlusIcon class="mr-2 size-4" />
						Add
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>