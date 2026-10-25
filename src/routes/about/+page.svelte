<script lang="ts">
	import { BRAND, ORIGIN } from '#lib/brand.ts';

	let { data } = $props();

	const KEYS: [string, string][] = [
		['Enter', 'Check the answer, then go to the next flag'],
		['Tab', 'Reveal the next letter (counts as a hint)'],
		['Esc', 'Give up and see the answer'],
		['1 – 4', 'Pick a choice ("Which one?", easy mode)'],
		['← → ↑ ↓', 'Turn the globe when it has focus'],
		['+ −', 'Zoom the globe'],
		['?', 'Show the keys']
	];

	const DATA: { what: string; source: string; href: string; licence: string; licenceHref: string }[] = [
		{
			what: 'Country names, other names, translations, regions',
			source: 'mledoze/countries 5.1.0',
			href: 'https://github.com/mledoze/countries',
			licence: 'ODbL 1.0',
			licenceHref: 'https://opendatacommons.org/licenses/odbl/1-0/'
		},
		{
			what: 'Flags',
			source: 'Wikimedia Commons',
			href: 'https://commons.wikimedia.org/',
			licence: 'Mostly public domain; each flag’s author and licence are on its page',
			licenceHref: '/flags'
		},
		{
			what: 'Capitals and largest cities',
			source: 'GeoNames',
			href: 'https://www.geonames.org/',
			licence: 'CC BY 4.0',
			licenceHref: 'https://creativecommons.org/licenses/by/4.0/'
		},
		{
			what: 'Country shapes (made with Natural Earth)',
			source: 'Natural Earth 5.1.2',
			href: 'https://www.naturalearthdata.com/',
			licence: 'Public domain',
			licenceHref: 'https://www.naturalearthdata.com/about/terms-of-use/'
		}
	];

	const SOFTWARE: { name: string; href: string; licence: string }[] = [
		{ name: 'Geist and Geist Mono (fonts, Vercel)', href: 'https://vercel.com/font', licence: 'SIL Open Font License 1.1' },
		{ name: 'Svelte and SvelteKit', href: 'https://svelte.dev/', licence: 'MIT' },
		{ name: 'd3-geo', href: 'https://github.com/d3/d3-geo', licence: 'ISC' },
		{ name: 'topojson-client', href: 'https://github.com/topojson/topojson-client', licence: 'ISC' },
		{ name: 'versor', href: 'https://github.com/d3/versor', licence: 'ISC' },
		{ name: 'ts-fsrs (spaced repetition)', href: 'https://github.com/open-spaced-repetition/ts-fsrs', licence: 'MIT' }
	];
</script>

<svelte:head>
	<title>About · {BRAND}</title>
	<meta name="description" content="What {BRAND} is, how it helps you remember every flag, and where its data comes from." />
	<link rel="canonical" href="{ORIGIN}/about" />
</svelte:head>

<article class="page">
	<header class="intro">
		<h1>About {BRAND}</h1>
		<p class="muted">Learn every flag of the world, and where each country is.</p>
	</header>

	<section class="card glass">
		<h2>What it is</h2>
		<p>
			{BRAND} shows you a flag; you type the country. A glass globe then flies there and marks the capital and the largest city, so
			each flag gets a place on the map, not only a name. There is no account and nothing to install: your progress stays in this
			browser, and you can export it to a file.
		</p>
	</section>

	<section class="card glass">
		<h2>How it helps you remember</h2>
		<p>
			Typing the name makes you recall it, which sticks far better than recognising it among choices. Flags come back just before
			you would forget them, with longer gaps each time you know them (spaced repetition, using FSRS). New flags come five at a time,
			shown first, then asked straight away. Flags that are easy to mix up are practised side by side so you learn the difference.
			When you miss one, you see the right answer, and what you named instead, at once.
		</p>
	</section>

	<section class="card glass">
		<h2>Which countries</h2>
		<p>
			The {data.core} countries are the 193 member states of the United Nations, the two observer states (Vatican City and
			Palestine), Kosovo and Taiwan. Names follow what each country calls itself in English, and other common names are accepted.
		</p>
		<p class="muted small">
			An optional set of {data.territories.length} territories with their own flags can be turned on in Practice:
			{#each data.territories as t, i (t.slug)}<a href="/flags/{t.slug}">{t.name}</a>{i < data.territories.length - 1 ? ', ' : '.'}{/each}
		</p>
	</section>

	<section class="card glass">
		<h2>Keys</h2>
		<dl class="keys">
			{#each KEYS as [k, what] (k)}
				<div>
					<dt><kbd>{k}</kbd></dt>
					<dd>{what}</dd>
				</div>
			{/each}
		</dl>
	</section>

	<section class="card glass">
		<h2>Credits</h2>
		<h3>Data</h3>
		<ul class="credits">
			{#each DATA as d (d.what)}
				<li>
					<span>{d.what}</span>
					<span class="muted"><a href={d.href} rel="noopener">{d.source}</a>, <a href={d.licenceHref} rel="noopener">{d.licence}</a></span>
				</li>
			{/each}
		</ul>
		<p class="muted small">
			The country data in {BRAND} is a derived database of mledoze/countries, available under the ODbL 1.0. Corrections, each with its
			source, are listed in the project’s <code>data/overrides.json</code>.
		</p>
		<h3>Fonts and software</h3>
		<ul class="credits">
			{#each SOFTWARE as s (s.name)}
				<li>
					<span><a href={s.href} rel="noopener">{s.name}</a></span>
					<span class="muted">{s.licence}</span>
				</li>
			{/each}
		</ul>
		<p class="muted small">No tracking, no cookies, no ads. The site makes no requests to other services.</p>
	</section>
</article>

<style>
	.page {
		width: min(760px, 100%);
		margin: 0 auto;
		padding: 24px 16px 64px;
		display: grid;
		gap: 16px;
	}

	.intro {
		text-align: center;
		display: grid;
		gap: 6px;
		margin-bottom: 8px;
	}

	h1 {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.card {
		border-radius: var(--r-glass);
		padding: 20px 24px;
		display: grid;
		gap: 10px;
	}

	h2 {
		font-size: var(--t16);
		font-weight: 600;
	}

	h3 {
		margin-top: 6px;
		font-size: var(--t14);
		font-weight: 500;
		color: var(--muted);
	}

	p {
		line-height: 1.6;
	}

	.small {
		font-size: var(--t13);
	}

	a {
		color: inherit;
	}

	.keys {
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.keys div {
		display: grid;
		grid-template-columns: 96px 1fr;
		align-items: center;
	}

	.keys dd {
		margin: 0;
		font-size: var(--t14);
	}

	.credits {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}

	.credits li {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 10px 0;
		font-size: var(--t14);
	}

	.credits li + li {
		border-top: 1px solid var(--border);
	}

	.credits li > span:last-child {
		text-align: right;
	}

	code {
		font-family: var(--mono);
		font-size: 0.92em;
	}

	@media (max-width: 599px) {
		h1 {
			font-size: var(--t24);
		}

		.credits li {
			flex-direction: column;
			gap: 2px;
		}

		.credits li > span:last-child {
			text-align: left;
		}
	}
</style>
