<script lang="ts">
	import { BRAND, ORIGIN } from '#lib/brand.ts';
	import FlagImage from '#lib/ui/FlagImage.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Lookalikes · {BRAND}</title>
	<meta name="description" content="Flags that are easy to confuse, side by side, with one sentence on how to tell them apart." />
	<link rel="canonical" href="{ORIGIN}/lookalikes" />
</svelte:head>

<section class="page">
	<header class="intro">
		<h1>Lookalikes</h1>
		<p class="muted">Flags that are easy to mix up, side by side, and how to tell them apart.</p>
		<p><a class="chip primary" href="/practice/lookalikes">Drill them</a></p>
	</header>

	<ul class="groups">
		{#each data.groups as g (g.id)}
			<li class="group glass">
				<ul class="members">
					{#each g.members as m (m.id)}
						<li>
							<a href="/flags/{m.slug}">
								<span class="frame"><FlagImage src={m.flag} ratio={m.ratio} alt="Flag of {m.name}" maxWidth={150} maxHeight={96} /></span>
								<span class="name">{m.name}</span>
							</a>
						</li>
					{/each}
				</ul>
				<p class="tip">{g.tip}</p>
				<a class="drill" href="/practice/drill?ids={g.members[0]?.id}">Drill this group</a>
			</li>
		{/each}
	</ul>
</section>

<style>
	.page {
		width: min(960px, 100%);
		margin: 0 auto;
		padding: 24px 16px 64px;
		display: grid;
		gap: 20px;
	}

	.intro {
		text-align: center;
		display: grid;
		gap: 8px;
		justify-items: center;
	}

	h1 {
		font-size: var(--t40);
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.groups {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 12px;
	}

	.group {
		border-radius: var(--r-glass);
		padding: 20px;
		display: grid;
		gap: 14px;
	}

	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 20px;
	}

	.members a {
		display: grid;
		justify-items: center;
		gap: 8px;
		color: var(--fg);
		text-decoration: none;
	}

	.frame {
		height: 96px;
		display: grid;
		place-items: center;
	}

	.name {
		font-size: var(--t13);
		font-weight: 500;
	}

	.members a:hover .name {
		text-decoration: underline;
	}

	.tip {
		text-align: center;
		font-size: var(--t14);
		max-width: 64ch;
		margin: 0 auto;
	}

	.drill {
		justify-self: center;
		font-size: var(--t13);
		color: var(--muted);
	}

	@media (max-width: 599px) {
		h1 {
			font-size: var(--t24);
		}

		.members {
			gap: 12px;
		}
	}
</style>
