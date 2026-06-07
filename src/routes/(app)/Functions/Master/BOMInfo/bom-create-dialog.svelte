<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Textarea } from "$lib/components/ui/textarea/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import XIcon from "@lucide/svelte/icons/x";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import { parseFormatPattern } from "$lib/utils/format.js";
	import type { CodeValue } from "$lib/(user)/Common/DropdownLists.js";

	type Props = {
		open: boolean;
		formatQty: string;
		parentItemOptions: CodeValue[];
		childItemOptions: CodeValue[];
		presetParentId?: string;
	};

	let {
		open = $bindable(false),
		formatQty,
		parentItemOptions,
		childItemOptions,
		presetParentId = undefined,
	}: Props = $props();

	// ── Styling ───────────────────────────────────────────────────────────────
	const inputClasses = {
		required: "border-amber-400 focus-visible:ring-amber-400 focus:ring-2 focus:ring-amber-400",
		optional: "border-muted-foreground/20 focus:ring-2 focus:ring-muted-foreground/40 focus-visible:ring-muted-foreground/40",
	};

	// ── Local format Qty ─────────────────────────────────────────────────────
	function formatQtyLocal(value: number): string {
		const { decimalPlaces, useGrouping } = parseFormatPattern(formatQty);
		try {
			return new Intl.NumberFormat("en-US", {
				minimumFractionDigits: decimalPlaces,
				maximumFractionDigits: decimalPlaces,
				useGrouping,
			}).format(value);
		} catch {
			return value.toFixed(decimalPlaces);
		}
	}

	// ── Form State ────────────────────────────────────────────────────────────
	let formParentId = $state("");
	let formParentQty = $state(1);
	let formItem = $state("");
	let formItemQty = $state(1);
	let formRemark = $state("");

	let formParentQtyDisplay = $state("");
	let formItemQtyDisplay = $state("");

	function initQtyDisplay() {
		formParentQty = 1;
		formItemQty = 1;
		formParentQtyDisplay = formatQtyLocal(1);
		formItemQtyDisplay = formatQtyLocal(1);
	}

	function onParentQtyInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, "");
		formParentQty = raw ? Number(raw) : 1;
		formParentQtyDisplay = raw;
	}

	function onParentQtyBlur() {
		formParentQtyDisplay = formatQtyLocal(formParentQty);
	}

	function onItemQtyInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, "");
		formItemQty = raw ? Number(raw) : 1;
		formItemQtyDisplay = raw;
	}

	function onItemQtyBlur() {
		formItemQtyDisplay = formatQtyLocal(formItemQty);
	}

	function reset() {
		formParentId = "";
		formItem = "";
		formRemark = "";
		initQtyDisplay();
	}

	// ── Sync form state when dialog opens ────────────────────────────────────
	$effect(() => {
		if (open) {
			reset();
			if (presetParentId) {
				formParentId = presetParentId;
			}
		}
	});

	// ── Focus helper for server-side validation ──────────────────────────────
	function focusField(field: string) {
		const inputId =
			field === "BOM_item_qty" ? "create-child-qty"
			: field === "BOM_item_parent_qty" ? "create-parent-qty"
			: null;
		if (inputId) {
			const el = document.getElementById(inputId);
			if (el) {
				el.focus();
				el.style.outline = "2px solid #fbbf24";
				el.style.outlineOffset = "2px";
			}
		} else {
			const btn = document.querySelector(`#${field} button`) as HTMLElement | null;
			if (btn) {
				btn.focus();
				btn.style.outline = "2px solid #fbbf24";
				btn.style.outlineOffset = "2px";
			}
		}
	}

	// ── Clear outline when dropdown value changes ──────────────────────────
	$effect(() => {
		if (formItem) {
			const btn = document.querySelector("#BOM_item button") as HTMLElement | null;
			if (btn) btn.style.outline = "";
		}
	});
	$effect(() => {
		if (formParentId) {
			const btn = document.querySelector("#BOM_item_parent button") as HTMLElement | null;
			if (btn) btn.style.outline = "";
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>Add BOM Item</Dialog.Title>
			<Dialog.Description>Register a new child item in the BOM hierarchy.</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === "success" || result.type === "redirect") {
						open = false;
					} else if (result.type === "failure") {
						const data = result.data as Record<string, unknown>;
						if (data?.message) toast.error(data.message as string);
						if (data?.field) focusField(data.field as string);
						return; // handled — skip update() to prevent duplicate $effect
					}
					await update();
				};
			}}
		>
			<div class="grid gap-4 py-4">
				<!-- Parent Item -->
				<div id="BOM_item_parent" class="grid gap-2">
					<Label for="create-parent" class="text-muted-foreground">Parent Item (Optional)</Label>
					<SearchableSelect
						items={parentItemOptions}
						bind:value={formParentId}
						placeholder="Root level (no parent)"
						class={inputClasses.optional}
					/>
					<input type="hidden" name="BOM_item_parent" value={formParentId ?? ""} />
				</div>

				<!-- Parent Qty -->
				<div id="BOM_item_parent_qty" class="grid gap-2">
					<Label for="create-parent-qty" class="text-amber-600 dark:text-amber-400">Parent Qty *</Label>
					<input type="hidden" name="BOM_item_parent_qty" value={formParentQty} />
					<Input
						id="create-parent-qty"
						type="text"
						inputmode="decimal"
						value={formParentQtyDisplay}
						oninput={onParentQtyInput}
						onblur={onParentQtyBlur}
						required
						class={inputClasses.required}
					/>
				</div>

				<!-- Child Item -->
				<div id="BOM_item" class="grid gap-2">
					<Label for="create-child" class="text-amber-600 dark:text-amber-400">Child Item *</Label>
					<SearchableSelect
						items={childItemOptions}
						bind:value={formItem}
						placeholder="Select child item..."
						class={inputClasses.required}
					/>
					<input type="hidden" name="BOM_item" value={formItem} />
				</div>

				<!-- Child Qty -->
				<div id="BOM_item_qty" class="grid gap-2">
					<Label for="create-child-qty" class="text-amber-600 dark:text-amber-400">Child Qty *</Label>
					<input type="hidden" name="BOM_item_qty" value={formItemQty} />
					<Input
						id="create-child-qty"
						type="text"
						inputmode="decimal"
						value={formItemQtyDisplay}
						oninput={onItemQtyInput}
						onblur={onItemQtyBlur}
						required
						class={inputClasses.required}
					/>
				</div>

				<!-- Remark -->
				<div class="grid gap-2">
					<Label for="create-remark" class="text-muted-foreground">Remark</Label>
					<Textarea
						id="create-remark"
						name="BOM_remark"
						bind:value={formRemark}
						placeholder="Enter remark..."
						class={inputClasses.optional}
					/>
				</div>
			</div>

			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>
					<XIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<Button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
					<PlusIcon class="mr-2 size-4" />
					Add
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
