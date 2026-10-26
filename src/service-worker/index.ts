/**
 * Offline after the first visit (PROMPT.md 1.3, M6).
 *
 * On install it caches what playing needs: the code, the main pages, the
 * fonts, the overview geometry and land dots, and every flag the quiz shows
 * (read from the quiz data, so the big SVGs that only feed the OG images
 * stay out). Flag pages, static globes and the detailed geometry are cached
 * as they are visited.
 *
 * Pages are fetched network-first, so a new version shows up when online;
 * everything with a hashed or versioned name is served from the cache.
 */
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';
import { self } from '$app/service-worker';
import gameUrl from '#lib/data/game.json?url';

const SHELL = `hoist-shell-${version}`;
const VISITED = 'hoist-visited';

/**
 * The pages people play on (not the 216 flag pages, the images or the XML).
 * The prerendered list leaves out the home page, so it is added here.
 */
const PAGES = [
	'/',
	...prerendered.map((p) => p.path as string).filter((p) => p !== '/' && !p.startsWith('/flags/') && !/\.(png|xml|txt|js)$/.test(p))
];
const STATIC = assets
	.map((a) => a.path as string)
	.filter((p) => p.startsWith('/fonts/') || p.startsWith('/icons/') || p === '/geo/overview.topo.json' || p === '/geo/land-dots.bin' || p === '/manifest.webmanifest');

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL);
			await cache.addAll([...immutable.map((f) => f.path), ...PAGES, ...STATIC]);
			// The flags the quiz shows, from the quiz data just cached.
			const game = await (await cache.match(gameUrl))?.json();
			const flags: string[] = (game?.countries ?? []).map((c: { flag: string }) => c.flag);
			await cache.addAll([...new Set(flags)]);
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) if (key.startsWith('hoist-shell-') && key !== SHELL) await caches.delete(key);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;
	const url = new URL(req.url);
	if (url.origin !== self.location.origin) return;

	if (req.mode === 'navigate') {
		event.respondWith(page(req, url));
		return;
	}
	event.respondWith(asset(req));
});

/** Pages: the network first (new versions), the cache when offline. */
async function page(req: Request, url: URL): Promise<Response> {
	try {
		const res = await fetch(req);
		if (res.ok) {
			const copy = res.clone();
			caches.open(VISITED).then((c) => c.put(url.pathname, copy));
		}
		return res;
	} catch {
		const hit = (await caches.match(url.pathname)) ?? (await caches.match('/'));
		return hit ?? new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
	}
}

/** Everything else: the cache first; what is fetched is kept for next time. */
async function asset(req: Request): Promise<Response> {
	// Static same-origin files: a `Vary: Origin` header (module scripts send
	// an Origin) must not turn a cached file into a miss.
	const hit = await caches.match(req, { ignoreVary: true });
	if (hit) return hit;
	const res = await fetch(req);
	if (res.ok && res.type === 'basic') {
		const copy = res.clone();
		caches.open(VISITED).then((c) => c.put(req, copy));
	}
	return res;
}
