import { sorted } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	core: sorted.filter((c) => c.pack === 'core').length,
	territories: sorted.filter((c) => c.pack === 'territories').map((c) => ({ name: c.name, slug: c.slug }))
});
