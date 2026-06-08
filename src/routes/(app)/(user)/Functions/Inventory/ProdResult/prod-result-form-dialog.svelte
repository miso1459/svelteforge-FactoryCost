<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import type { CodeValue } from "$lib/(user)/Common/DropdownLists.js";
	import { toast } from "svelte-sonner";
	import { enhance } from "$app/forms";
	import XIcon from "@lucide/svelte/icons/x";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { parseFormatPattern, formatStdPrice } from "$lib/utils/format.js";

	type Props = {
		open: boolean;
		mode: "create" | "edit";
		data?: {
			id?: number;
			documentDt: string;
			tranType: string;
			tranItem: string;
			tranQty: number | null;
			tranPrice: number | null;
			tranAmount: number | null;
			tranRemark: string | null;
		} | null;
		formatQty?: string;
		itemInfo?: { title: string; list: { code: string; value: string; stdPrice?: number }[] };
		defaultDt?: string;
	};

	let {
		open = $bindable(false),
		mode,
		data = null,
		formatQty = "#,##0.00",
		itemInfo = { title: "", list: [] },
		defaultDt = "",
	}: Props = $props();

	const title = $derived(mode === "create" ? "생산입고 추가" : "생산입고 편집");
	const action = $derived(mode === "create" ? "?/create" : "?/update");

	const tranItemItems: CodeValue[] = $derived(itemInfo.list);

	const inputClasses = {
		required: "border-amber-400 focus-visible:ring-amber-400 focus:ring-2 focus:ring-amber-400",
		optional: "border-muted-foreground/20 focus-visible:ring-muted-foreground/40 focus:ring-2 focus:ring-muted-foreground/40",
	};

	let documentDtStr = $state("");
	let tranItem = $state("");
	let tranQtyRaw = $state<number | null>(null);
	let tranQtyDisplay = $state("");

	function focusField(field: string) {
		if (field === "Tran_item") {
			const btn = document.querySelector("#Tran_item button") as HTMLElement | null;
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

	function handleSubmit(e: SubmitEvent) {
		if (!documentDtStr.trim()) {
			e.preventDefault();
			toast.error("Document Dt is required");
			focusField("Document_dt");
			return;
		}
		if (!tranItem.trim()) {
			e.preventDefault();
			toast.error("Tran Item is required");
			focusField("Tran_item");
			return;
		}
		if (tranQtyRaw === null || isNaN(tranQtyRaw)) {
			e.preventDefault();
			toast.error("Tran Qty is required and must be a number");
			focusField("Tran_qty");
			return;
		}
	}

	$effect(() => {
		if (tranItem) {
			const btn = document.querySelector("#Tran_item button") as HTMLElement | null;
			if (btn) btn.style.outline = "";
		}
	});

	function onTranQtyInput(e: Event) {
		const raw = (e.target as HTMLInputElement).value.replace(/[^0-9.\-]/g, "");
		tranQtyRaw = raw ? Number(raw) : null;
		tranQtyDisplay = raw;
	}

	function onTranQtyBlur() {
		if (tranQtyRaw !== null) {
			const { decimalPlaces } = parseFormatPattern(formatQty);
			tranQtyRaw = Number(tranQtyRaw.toFixed(decimalPlaces));
			tranQtyDisplay = formatStdPrice(tranQtyRaw, formatQty);
		} else {
			tranQtyDisplay = "";
		}
	}

	$effect(() => {
		if (open) {
			if (data) {
				documentDtStr = data.documentDt;
				tranItem = data.tranItem;
				const { decimalPlaces } = parseFormatPattern(formatQty);
				tranQtyRaw = data.tranQty != null ? Number(Number(data.tranQty).toFixed(decimalPlaces)) : null;
				tranQtyDisplay = data.tranQty != null ? formatStdPrice(data.tranQty, formatQty) : "";
			} else {
				documentDtStr = defaultDt;
				tranItem = "";
				tranQtyRaw = null;
				tranQtyDisplay = "";
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
					? "새로운 생산입고 기록을 생성합니다."
					: "생산입고 기록을 수정합니다."}
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
					}
					await update();
				};
			}}
		>
			{#if mode === "edit" && data}
				<input type="hidden" name="id" value={data.id} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="Document_dt" class="font-medium text-amber-600 dark:text-amber-400">Document Dt *</Label>
					<Input
						id="Document_dt"
						name="Document_dt"
						type="date"
						value={documentDtStr}
						oninput={(e) => (documentDtStr = e.currentTarget.value)}
						required
						class={inputClasses.required}
					/>
				</div>
				<div class="grid gap-2">
					<Label class="font-medium text-amber-600 dark:text-amber-400">Tran Type</Label>
					<input type="hidden" name="Tran_type" value="R03" />
					<div class="flex h-10 items-center rounded-md border border-muted-foreground/20 bg-muted/30 px-3 text-sm">
						생산입고 (R03)
					</div>
				</div>
				<div class="grid gap-2 relative">
					<Label for="Tran_item" class="font-medium text-amber-600 dark:text-amber-400">Tran Item *</Label>
					<div id="Tran_item" class="relative rounded-md">
						<input type="hidden" name="Tran_item" value={tranItem} />
						<SearchableSelect
							items={tranItemItems}
							bind:value={tranItem}
							placeholder="Search tran item..."
							class={inputClasses.required}
						/>
					</div>
				</div>
				<div class="grid gap-2">
					<Label for="Tran_qty" class="font-medium text-amber-600 dark:text-amber-400">Tran Qty *</Label>
					<input type="hidden" name="Tran_qty" value={tranQtyRaw ?? ""} />
					<Input
						id="Tran_qty"
						type="text"
						inputmode="decimal"
						value={tranQtyDisplay}
						oninput={onTranQtyInput}
						onblur={onTranQtyBlur}
						class={inputClasses.required}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="Tran_remark" class="text-muted-foreground">Tran Remark</Label>
					<textarea
						id="Tran_remark"
						name="Tran_remark"
						rows="3"
						class="border-muted-foreground/20 focus-visible:ring-muted-foreground/40 flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>{data?.tranRemark ?? ""}</textarea>
				</div>
			</div>
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (open = false)}>
					<XIcon class="mr-2 size-4" />
					Cancel
				</Button>
				<Button type="submit" class="bg-amber-600 hover:bg-amber-700 text-white">
					<PlusIcon class="mr-2 size-4" />
					{mode === "create" ? "Add" : "Save"}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
