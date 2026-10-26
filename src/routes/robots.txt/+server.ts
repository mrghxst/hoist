import { ORIGIN } from '#lib/brand.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

export const GET: RequestHandler = () =>
	new Response(`User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
