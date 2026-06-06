<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import { ITEM_ACCT, type CodeValue } from "$lib/(user)/Common/DropdownLists.js";
	import { enhance } from "$app/forms";

	type MasterItemData = {
		itemCode: string;
		itemDesc: string;
		itemSpec: string | null;
		itemRemark: string | null;
		itemAcct: string;
	};

	type Props = {
		open: boolean;
		mode: "create" | "edit";
		data?: MasterItemData | null;
	};

	let { open = $bindable(false), mode, data = null }: Props = $props();

	const title = $derived(mode === "create" ? "Add Record" : "Edit Record");
	const action = $derived(mode === "create" ? "?/create" : "?/update");

	// Flat list from ITEM_ACCT group
	const acctItems: CodeValue[] = $derived(ITEM_ACCT.list);

	const isReadonly = $derived(mode === "edit");

	const inputClasses = {
		pk: "border-blue-400 focus-visible:ring-blue-400",
		required: "border-amber-400 focus-visible:ring-amber-400",
		optional: "border-muted-foreground/20 focus-visible:ring-muted-foreground/40",
		purple:
			"border-purple-400 focus-visible:ring-purple-400",
		readonly:
			"border-black dark:border-white border-2 bg-muted/60 dark:bg-zinc-800 pointer-events-none",
		readonlyPurple:
			"border-purple-400 border-2 bg-muted/60 dark:bg-zinc-800 pointer-events-none",
	};

	let itemAcct = $state("");

	$effect(() => {
		if (open) {
			if (data) {
				itemAcct = data.itemAcct;
			} else {
				itemAcct = "";
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
					? "Create a new master item record."
					: "Update master item record details."}
			</Dialog.Description>
		</Dialog.Header>
		<form
			method="POST"
			{action}
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
				<input type="hidden" name="itemCode" value={data.itemCode} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="grid gap-2 relative">
					<Label for="itemAcct" class="font-semibold text-purple-600 dark:text-purple-400">Item Acct * <span class="text-xs font-normal text-muted-foreground">(cannot be changed after save)</span></Label>
					<!-- form submit 시 itemAcct가 비어있으면 SearchableSelect 위치에 브라우저 네이티브 "이 입력란을 작성하세요" 메시지 표시 -->
					<div class="relative">
						<!-- 다른 input과 동일하게 입력란 가운데 아래에 validation 말풍선이 뜨도록 SearchableSelect 전체 영역을 덮는 투명 input -->
						<input
							type="text"
							class="absolute inset-0 opacity-0 pointer-events-none cursor-default"
							required
							value={itemAcct}
							tabindex="-1"
							aria-hidden="true"
						/>
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
						required
						class={isReadonly ? inputClasses.readonly : inputClasses.pk}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="itemDesc" class="font-medium text-amber-600 dark:text-amber-400">Item Desc *</Label>
					<Input id="itemDesc" name="itemDesc" value={data?.itemDesc ?? ""} required class={inputClasses.required} />
				</div>
				<div class="grid gap-2">
					<Label for="itemSpec" class="text-muted-foreground">Item Spec</Label>
					<Input id="itemSpec" name="itemSpec" value={data?.itemSpec ?? ""} class={inputClasses.optional} />
				</div>
				<div class="grid gap-2">
					<Label for="itemRemark" class="text-muted-foreground">Item Remark</Label>
					<Input id="itemRemark" name="itemRemark" value={data?.itemRemark ?? ""} class={inputClasses.optional} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="submit">{mode === "create" ? "Create" : "Save Changes"}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>