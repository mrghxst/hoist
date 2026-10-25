<script lang="ts">
	import { BRAND, ORIGIN } from '#lib/brand.ts';
	import FlagImage from '#lib/ui/FlagImage.svelte';
	import { NOT_RECTANGULAR, proportions } from '#lib/flags.ts';
	import { scopeOf, title } from '#lib/play/scope.ts';

	let { data } = $props();
	let c = $derived(data.country);
	let others = $derived(c.names.filter((n) => n !== c.name && n !== c.official));
	let region = $derived(c.pack === 'core' ? title(scopeOf(c.region).label) : `${title(scopeOf(c.region).label)} (territory)`);
	let description = $derived(
		`The flag of ${c.name}: capital ${c.capital.name}, largest city ${c.largest.name}, ${region}. Learn it with ${BRAND}.`
	);
	const number = (n: number) => n.toLocaleString('en');
</script>

<svelte:head>
	<title>Flag of {c.name} · {BRAND}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href="{ORIGIN}/flags/{c.slug}" />
	<meta property="og:type" content="article" />
	<meta property="og:title" content="Flag of {c.name}" />
	<meta property="og:description" content={description} />
	<meta property="og:url" content="{ORIGIN}/flags/{c.slug}" />
	<meta property="og:image" content="{ORIGIN}/flags/{c.slug}/og.png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content="The flag of {c.name}, with a small globe showing where it is" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<article class="page">
	<nav class="crumbs" aria-label="Breadcrumb"><a href="/flags">All flags</a> <span aria-hidden="true">/</span> {c.name}</nav>

	<div class="hero glass">
		<div class="flag">
			<FlagImage src={data.image} ratio={data.flag.ratio} alt="Flag of {c.name}" maxWidth={520} maxHeight={320} eager />
		</div>
	</div>

	<header class="title">
		<h1>{c.name}</h1>
		{#if c.official !== c.name}<p class="muted">{c.official}</p>{/if}
	</header>

	<div class="body">
		<dl class="facts glass">
			<div>
				<dt>Capital</dt>
				<dd>
					{c.capital.name}
					{#if c.capital.note}<span class="note">{c.capital.note}</span>{/if}
				</dd>
			</div>
			<div>
				<dt>Largest city</dt>
				<dd>
					{c.same ? `${c.largest.name} (also the capital)` : c.largest.name}
					{#if c.largest.pop}<span class="note">About {number(c.largest.pop)} people (GeoNames)</span>{/if}
				</dd>
			</div>
			<div>
				<dt>Region</dt>
				<dd>{region}<span class="note">{c.subregion}</span></dd>
			</div>
			<div>
				<dt>Proportions</dt>
				<dd>
					{proportions(data.flag.ratio)}
					<span class="note">{NOT_RECTANGULAR[c.id] ?? 'Height to width.'}</span>
				</dd>
			</div>
			{#if others.length}
				<div class="wide">
					<dt>Also accepted</dt>
					<dd class="names">{others.join(', ')}</dd>
				</div>
			{/if}
			{#if c.flagNote}
				<div class="wide">
					<dt>About this flag</dt>
					<dd class="names">{c.flagNote}</dd>
				</div>
			{/if}
		</dl>

		<figure class="where glass">
			<img class="globe light" src="/globes/{c.slug}-light.svg" width="240" height="240" alt="Globe showing where {c.name} is" loading="lazy" />
			<img class="globe dark" src="/globes/{c.slug}-dark.svg" width="240" height="240" alt="Globe showing where {c.name} is" loading="lazy" />
			<figcaption class="muted">Where it is</figcaption>
		</figure>
	</div>

	{#if data.groups.length}
		<section class="lookalikes" aria-labelledby="mixup">
			<h2 id="mixup">Easy to mix up with</h2>
			{#each data.groups as g (g.id)}
				<div class="group glass">
					<ul>
						{#each g.members as m (m.id)}
							<li>
								<a href="/flags/{m.slug}">
									<FlagImage src={m.flag} ratio={m.ratio} alt="" maxWidth={96} maxHeight={60} />
									<span>{m.name}</span>
								</a>
							</li>
						{/each}
					</ul>
					<p><span class="muted">How to tell:</span> {g.tip}</p>
				</div>
			{/each}
		</section>
	{/if}

	<div class="actions">
		<a class="chip primary" href="/practice/drill?ids={c.id}">Practise this flag</a>
		<a class="chip" href="/flags">All flags</a>
	</div>

	<footer class="source muted">
		Flag image: {data.flag.author || 'Wikimedia Commons contributors'}, {data.flag.licence}, via
		<a href={data.flag.source} rel="noopener">Wikimedia Commons</a>.
	</footer>
</article>

<style>
	.page {
		width: min(880px, 100%);
		margin: 0 auto;
		padding: 16px 16px 64px;
		display: grid;
		gap: 20px;
	}

	.crumbs {
		font-size: var(--t13);
		color: var(--muted);
	}

	.crumbs a {
		color: var(--muted);
	}

	.hero {
		border-radius: var(--r-glass);
		padding: 40px 24px;
		display: grid;
		place-items: center;
	}

	.flag {
		--flag-w: 520px;
		--flag-h: 320px;
		width: 100%;
		display: grid;
		place-items: center;
	}

	.title {
		text-align: center;
		display: grid;
		gap: 4px;
	}

	h1 {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	.body {
		display: grid;
		grid-template-columns: 1fr 260px;
		gap: 16px;
		align-items: start;
	}

	.facts {
		margin: 0;
		padding: 20px;
		border-radius: var(--r-glass);
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px 24px;
	}

	.facts .wide {
		grid-column: 1 / -1;
	}

	dt {
		color: var(--muted);
		font-size: var(--t13);
	}

	dd {
		margin: 2px 0 0;
		font-size: var(--t16);
		font-weight: 500;
	}

	.names {
		font-size: var(--t14);
		font-weight: 400;
	}

	.note {
		display: block;
		font-size: var(--t13);
		font-weight: 400;
		color: var(--muted);
	}

	.where {
		margin: 0;
		padding: 10px;
		border-radius: var(--r-glass);
		display: grid;
		justify-items: center;
		gap: 4px;
		font-size: var(--t13);
	}

	.globe {
		width: 240px;
		height: 240px;
	}

	/* The globe in the page's theme (the toggle wins over the system). */
	.globe.dark {
		display: none;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .globe.light {
			display: none;
		}
		:global(:root:not([data-theme='light'])) .globe.dark {
			display: block;
		}
	}

	:global(:root[data-theme='dark']) .globe.light {
		display: none;
	}

	:global(:root[data-theme='dark']) .globe.dark {
		display: block;
	}

	h2 {
		font-size: var(--t14);
		font-weight: 500;
		color: var(--muted);
		margin-bottom: 8px;
	}

	.lookalikes {
		display: grid;
		gap: 12px;
	}

	.group {
		border-radius: var(--r-glass);
		padding: 16px 20px;
		display: grid;
		gap: 12px;
		font-size: var(--t14);
	}

	.group ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.group a {
		display: grid;
		justify-items: center;
		gap: 6px;
		color: var(--fg);
		text-decoration: none;
		font-size: var(--t13);
	}

	.group a:hover span {
		text-decoration: underline;
	}

	.actions {
		display: flex;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.source {
		text-align: center;
		font-size: var(--t13);
	}

	.source a {
		color: var(--muted);
	}

	@media (max-width: 699px) {
		h1 {
			font-size: var(--t24);
		}

		.hero {
			padding: 24px 12px;
		}

		.flag {
			--flag-w: 320px;
			--flag-h: 200px;
		}

		.body {
			grid-template-columns: 1fr;
		}

		.facts {
			grid-template-columns: 1fr;
		}
	}
</style>
