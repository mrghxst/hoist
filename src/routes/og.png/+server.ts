import { byId, familiar, flags } from '#lib/server/catalog.ts';
import { siteImage } from '#lib/server/og.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

/** The site's Open Graph image: well-known flags and the tagline. */
export const GET: RequestHandler = () => {
	const picks = familiar.filter((id) => byId.has(id)).slice(0, 12);
	return new Response(siteImage(picks.map((id) => flags[id]!)), { headers: { 'content-type': 'image/png' } });
};
