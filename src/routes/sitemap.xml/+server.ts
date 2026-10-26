import { ORIGIN } from '#lib/brand.ts';
import { countries } from '#lib/server/catalog.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

/** Every page worth finding in a search engine (PROMPT.md 2.6). */
const PAGES = ['/', '/daily', '/practice', '/flags', '/lookalikes', '/about'];

export const GET: RequestHandler = () => {
	const urls = [...PAGES, ...countries.map((c) => `/flags/${c.slug}`)];
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `\t<url><loc>${ORIGIN}${u === '/' ? '/' : u}</loc></url>`).join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'content-type': 'application/xml' } });
};
