<script lang="ts">
	import { FileText, Sparkles, Calendar, ArrowRight, BookOpen } from "@lucide/svelte";
	import { resolve } from "$app/paths";

	// Svelte 5 Runes Props
	let { data } = $props();

	// Format last updated date
	function formatDate(dateInput: string | undefined) {
		if (!dateInput) return "";
		const d = new Date(dateInput);
		return d.toLocaleDateString("ko-KR", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
</script>

<svelte:head>
	<title>home - SvelteForge Factory Cost</title>
</svelte:head>

<div
	class="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-start overflow-hidden bg-slate-50 font-sans dark:bg-slate-950"
>
	<!-- Premium background glow elements -->
	<div
		class="pointer-events-none absolute top-1/4 left-1/2 z-0 h-125 w-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-linear-to-tr from-indigo-500/10 to-purple-500/10 blur-3xl dark:from-indigo-500/5 dark:to-purple-500/5"
	></div>
	<div
		class="pointer-events-none absolute right-10 bottom-10 z-0 h-72 w-72 rounded-full bg-linear-to-br from-emerald-500/5 to-teal-500/5 blur-2xl"
	></div>

	<!-- Main Wrapper -->
	<div class="z-10 flex w-full max-w-none flex-col gap-8">
		{#if data.document}
			<!-- Main Article Card -->
			<article
				class="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-100 transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-none"
			>
				<!-- Article Accent Bar -->
				<div
					class="h-1.5 w-full bg-linear-to-r from-indigo-500 via-purple-500 to-emerald-500"
				></div>

				<!-- Content Area -->
				<div class="p-8 sm:p-12">
					<!-- Title -->
					<h1
						class="mb-8 border-b border-slate-100 pb-6 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:border-slate-800 dark:text-white"
					>
						{data.document.title}
					</h1>

					<!-- TipTap Styled Read-Only Content -->
					<div
						class="prose prose-indigo dark:prose-invert prose-lg max-w-none"
					>
						{@html data.document.content}
					</div>
				</div>
			</article>

			{#if data.user?.role == "admin"}
				<!-- Quick Editor Action (Floating Button style) -->
				<div class="mt-2 flex justify-center">
					<a
						href={resolve("/Common/ContentsEditor")}
						class="inline-flex transform cursor-pointer items-center gap-2 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/10 transition-all duration-300 hover:scale-[1.02] hover:bg-slate-800 dark:bg-slate-800 dark:shadow-none dark:hover:bg-slate-700"
					>
						<span>대표 문서 수정하기</span>
						<ArrowRight class="h-4 w-4 text-indigo-400" />
					</a>
				</div>
			{/if}
		{:else}
			<!-- Empty State / No Document Configured -->
			<div
				class="mx-auto my-12 flex max-w-2xl flex-col items-center justify-center gap-6 rounded-3xl border border-slate-200/80 bg-white/60 p-12 text-center shadow-xl backdrop-blur-md transition-all duration-300 dark:border-slate-800/80 dark:bg-slate-900/40"
			>
				<div class="relative">
					<div
						class="flex h-20 w-20 animate-pulse items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-400"
					>
						<FileText class="h-10 w-10 stroke-[1.2]" />
					</div>
					<Sparkles class="absolute -top-1.5 -right-1.5 h-5 w-5 animate-bounce text-purple-400" />
				</div>

				<div class="space-y-2">
					<h2 class="text-2xl font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
						홈페이지 대표 문서가 없습니다
					</h2>
					<p class="mx-auto max-w-md text-sm leading-relaxed text-slate-400 dark:text-slate-500">
						현재 홈페이지에 게시하도록 지정된 대표 문서가 없습니다. 문서 관리 에디터에서 TipTap
						에디터로 문서를 작성하고,
						<strong>'홈페이지 대표로 지정'</strong>을 눌러 여기에 노출되도록 설정해 보세요.
					</p>
				</div>

				<div class="mt-2 flex flex-col gap-3 sm:flex-row">
					<a
						href={resolve("/Common/ContentsEditor")}
						class="inline-flex transform cursor-pointer items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-indigo-500/10 transition-all duration-300 hover:scale-[1.02] hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/20"
					>
						<span>문서 편집기 바로가기</span>
						<ArrowRight class="h-4 w-4 text-indigo-200" />
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Make sure embedded HTML styled nicely */
	:global(.prose) {
		line-height: 1.75;
	}
	:global(.prose h1, .prose h2, .prose h3) {
		font-weight: 800;
		letter-spacing: -0.025em;
		margin-top: 1.5em;
		margin-bottom: 0.5em;
	}
	:global(.prose p) {
		margin-bottom: 1.25em;
	}
	:global(.prose blockquote) {
		font-style: italic;
		border-left-width: 4px;
		border-left-color: #6366f1;
		padding-left: 1.25em;
		margin: 1.5em 0;
		color: #4b5563;
	}
	:global(.dark .prose blockquote) {
		color: #9ca3af;
	}
	:global(.prose ul) {
		list-style-type: disc;
		padding-left: 1.5em;
		margin-bottom: 1.25em;
	}
	:global(.prose ol) {
		list-style-type: decimal;
		padding-left: 1.5em;
		margin-bottom: 1.25em;
	}
	:global(.prose code) {
		background-color: #f1f5f9;
		padding: 0.2em 0.4em;
		border-radius: 0.375rem;
		font-size: 0.875em;
		font-family: monospace;
	}
	:global(.dark .prose code) {
		background-color: #1e293b;
	}
	:global(.prose pre) {
		background-color: #0f172a;
		color: #f8fafc;
		padding: 1em 1.5em;
		border-radius: 0.75rem;
		overflow-x: auto;
		margin: 1.5em 0;
	}
</style>
