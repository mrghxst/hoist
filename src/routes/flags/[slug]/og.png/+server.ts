import { error } from '@sveltejs/kit';
import { bySlug, countries, flags } from '#lib/server/catalog.ts';
import { flagImage } from '#lib/server/og.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => countries.map((c) => ({ slug: c.slug }));

export const GET: RequestHandler = ({ params }) => {
	const c = bySlug.get(params.slug);
	if (!c) error(404, 'No such flag');
	return new Response(flagImage(c, flags[c.id]!), { headers: { 'content-type': 'image/png' } });
};
