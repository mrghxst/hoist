<script lang="ts">
	import { BRAND, TAGLINE } from '#lib/brand.ts';
	import Placeholder from '#lib/ui/Placeholder.svelte';
</script>

<svelte:head>
	<title>{BRAND} · {TAGLINE}</title>
	<meta name="description" content="See a flag, type the country, and a glass globe flies there. Spaced repetition, a daily challenge, no account." />
</svelte:head>

<Placeholder title={BRAND} line={TAGLINE} />
