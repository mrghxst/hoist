<script lang="ts">
	import { page } from '$app/state';
	import { BRAND, REPO } from '#lib/brand.ts';
	import ThemeToggle from './ThemeToggle.svelte';

	const links = [
		{ href: '/', label: 'Play' },
		{ href: '/daily', label: 'Daily' },
		{ href: '/practice', label: 'Practice' },
		{ href: '/progress', label: 'Progress' },
		{ href: '/flags', label: 'Flags' }
	];

	let open = $state(false);

	function isActive(href: string) {
		const p = page.url.pathname;
		return p === href || (href !== '/' && p.startsWith(href + '/'));
	}

	$effect(() => {
		// Close the phone menu after navigating.
		void page.url.pathname;
		open = false;
	});
</script>

<header class="bar">
	<div class="inner glass">
		<a class="wordmark" href="/" aria-label="{BRAND}, play">
			<svg class="mark" viewBox="0 0 20 20" aria-hidden="true">
				<rect x="3" y="2" width="1.6" height="16" rx="0.8" fill="currentColor" />
				<path d="M5.5 3h10.2l-2.4 3.6 2.4 3.6H5.5z" fill="currentColor" opacity="0.9" />
			</svg>
			{BRAND}
		</a>

		<nav aria-label="Main" class="links">
			{#each links as l (l.href)}
				<a href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</a>
			{/each}
		</nav>

		<div class="end">
			<!-- The mark is a CSS mask: as markup it would weigh on every page's JavaScript. -->
			<a class="repo" href={REPO} rel="noopener" aria-label="Source code on GitHub" title="Source code on GitHub"><span class="mark-gh"></span></a>
			<ThemeToggle />
			<button
				class="menu-btn"
				aria-expanded={open}
				aria-controls="phone-menu"
				aria-label={open ? 'Close menu' : 'Open menu'}
				onclick={() => (open = !open)}
			>
				<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
					<path
						d={open ? 'M5 5l10 10M15 5L5 15' : 'M3 7h14M3 13h14'}
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			</button>
		</div>
	</div>

	{#if open}
		<nav id="phone-menu" aria-label="Main" class="sheet glass">
			{#each links as l (l.href)}
				<a href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}</a>
			{/each}
			<a href="/about" aria-current={isActive('/about') ? 'page' : undefined}>About</a>
		</nav>
	{/if}
</header>

<style>
	.bar {
		position: fixed;
		inset: 0 0 auto 0;
		z-index: 50;
		padding: 10px 16px 0;
		padding-top: max(10px, env(safe-area-inset-top));
		pointer-events: none;
	}

	.inner {
		pointer-events: auto;
		max-width: 1200px;
		margin: 0 auto;
		height: 48px;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		padding: 0 8px 0 16px;
		border-radius: 999px;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		justify-self: start;
		font-weight: 600;
		font-size: var(--t16);
		letter-spacing: -0.02em;
		text-decoration: none;
		border-radius: var(--r-btn);
	}

	.mark {
		width: 18px;
		height: 18px;
	}

	.links {
		display: flex;
		gap: 2px;
	}

	.links a,
	.sheet a {
		position: relative;
		padding: 6px 12px;
		border-radius: 999px;
		color: var(--muted);
		text-decoration: none;
		font-size: var(--t14);
		transition:
			color 150ms var(--ease),
			background-color 150ms var(--ease);
	}

	.links a:hover,
	.sheet a:hover {
		color: var(--fg);
	}

	.links a[aria-current='page'],
	.sheet a[aria-current='page'] {
		color: var(--fg);
		background: var(--overlay);
	}

	:global(:root[data-theme='dark']) .links a[aria-current='page'],
	:global(:root[data-theme='dark']) .sheet a[aria-current='page'] {
		background: rgba(255, 255, 255, 0.1);
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .links a[aria-current='page'],
		:global(:root:not([data-theme='light'])) .sheet a[aria-current='page'] {
			background: rgba(255, 255, 255, 0.1);
		}
	}

	.end {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.repo {
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--muted);
		border-radius: 999px;
		transition: color 150ms var(--ease);
	}

	.repo:hover {
		color: var(--fg);
	}

	.mark-gh {
		width: 17px;
		height: 17px;
		background: currentColor;
		mask: url('/icons/github.svg') center / contain no-repeat;
	}

	.menu-btn {
		display: none;
		width: 36px;
		height: 36px;
		align-items: center;
		justify-content: center;
		border: 0;
		background: transparent;
		border-radius: 999px;
		cursor: pointer;
	}

	.sheet {
		pointer-events: auto;
		display: none;
		flex-direction: column;
		gap: 2px;
		max-width: 1200px;
		margin: 8px auto 0;
		padding: 8px;
		animation: drop 180ms var(--ease);
	}

	.sheet a {
		padding: 10px 12px;
		border-radius: 10px;
		font-size: var(--t16);
	}

	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	@media (max-width: 720px) {
		.inner {
			grid-template-columns: 1fr auto;
		}
		.links {
			display: none;
		}
		.menu-btn {
			display: inline-flex;
		}
		.sheet {
			display: flex;
		}
	}
</style>
