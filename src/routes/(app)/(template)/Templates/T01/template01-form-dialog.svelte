<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import SearchableSelect from "$lib/components/searchable-select.svelte";
	import { ITEM_ACCT, type CodeValue } from "$lib/(user)/Common/DropdownLists.js";
	import { enhance } from "$app/forms";

	type Template01Data = {
		code: string;
		desc: string;
		remark: string | null;
		itemAcct: string;
		dateValid: Date | null;
	};

	type Props = {
		open: boolean;
		mode: "create" | "edit";
		data?: Template01Data | null;
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
		readonly: "border-black dark:border-white border-2 bg-muted/30 pointer-events-none",
	};

	let itemAcct = $state("");
	let dateValidStr = $state("");

	function toDateInputValue(date: Date): string {
		const d = new Date(date);
		return d.toISOString().slice(0, 10);
	}

	$effect(() => {
		if (open) {
			if (data) {
				itemAcct = data.itemAcct;
				dateValidStr = data.dateValid ? toDateInputValue(data.dateValid) : "";
			} else {
				itemAcct = "";
				dateValidStr = "";
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
					? "Create a new template record."
					: "Update template record details."}
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
				<input type="hidden" name="code" value={data.code} />
			{/if}
			<div class="grid gap-4 py-4">
				<div class="grid gap-2">
					<Label for="code" class="font-semibold text-blue-600 dark:text-blue-400">Code (PK)</Label>
					<Input
						id="code"
						name="code"
						value={data?.code ?? ""}
						required
						class={isReadonly ? inputClasses.readonly : inputClasses.pk}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="desc" class="font-medium text-amber-600 dark:text-amber-400">Desc *</Label>
					<Input id="desc" name="desc" value={data?.desc ?? ""} required class={inputClasses.required} />
				</div>
				<div class="grid gap-2">
					<Label for="remark" class="text-muted-foreground">Remark</Label>
					<Input id="remark" name="remark" value={data?.remark ?? ""} class={inputClasses.optional} />
				</div>
				<div class="grid gap-2">
					<Label for="itemAcct" class="font-medium text-amber-600 dark:text-amber-400">Item Acct *</Label>
					<input type="hidden" name="itemAcct" value={itemAcct} />
					<SearchableSelect
						items={acctItems}
						bind:value={itemAcct}
						placeholder="Search item acct..."
						class={inputClasses.required}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="dateValid" class="text-muted-foreground">Date Valid</Label>
					<Input id="dateValid" name="dateValid" type="date" bind:value={dateValidStr} class={inputClasses.optional} />
				</div>
			</div>
			<Dialog.Footer>
				<Button type="submit">{mode === "create" ? "Create" : "Save Changes"}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
