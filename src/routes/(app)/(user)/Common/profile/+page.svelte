<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";
import { enhance } from "$app/forms";
import { toast } from "svelte-sonner";

let { data, form } = $props();

$effect(() => {
if (form?.message) toast.error(form.message);
if (form?.success) {
const messages: Record<string, string> = {
profile: "Profile updated",
};
toast.success(messages[form.action as string] ?? "Saved");
}
});
</script>

<svelte:head>
<title>Profile - SvelteForge Factory Cost</title>
</svelte:head>

<div class="space-y-6">
<div>
<h1 class="text-3xl font-bold tracking-tight">Profile</h1>
<p class="text-muted-foreground">Update your profile information.</p>
</div>

<Card.Root>
<Card.Header>
<Card.Title>Profile Information</Card.Title>
<Card.Description>Update your name and email address.</Card.Description>
</Card.Header>
<Card.Content>
<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
<div class="grid gap-2">
<Label for="name">Name</Label>
<Input id="name" name="name" value={data.profile.name} required />
</div>
<div class="grid gap-2">
<Label for="email">Email</Label>
<Input id="email" name="email" type="email" value={data.profile.email} readonly />
<p class="text-muted-foreground text-xs">Email is read-only.</p>
</div>
<Button type="submit">Save Profile</Button>
</form>
</Card.Content>
</Card.Root>
</div>
