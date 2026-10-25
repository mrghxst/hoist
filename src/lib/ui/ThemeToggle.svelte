<script lang="ts">
	import { theme } from '#lib/store/theme.svelte.ts';

	const labels = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' };
</script>

<button
	class="toggle"
	onclick={() => theme.cycle()}
	aria-label="{labels[theme.pref]}. Change theme"
	title={labels[theme.pref]}
>
	<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
		{#if theme.pref === 'system'}
			<circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
			<path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" />
		{:else if theme.pref === 'light'}
			<circle cx="10" cy="10" r="3.5" fill="none" stroke="currentColor" stroke-width="1.5" />
			<path
				d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
			/>
		{:else}
			<path
				d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linejoin="round"
			/>
		{/if}
	</svg>
</button>

<style>
	.toggle {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 0;
		background: transparent;
		color: var(--muted);
		border-radius: 999px;
		cursor: pointer;
		transition: color 150ms var(--ease);
	}

	.toggle:hover {
		color: var(--fg);
	}
</style>
