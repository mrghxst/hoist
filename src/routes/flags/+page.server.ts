import { listed, sorted } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ flags: sorted.map(listed) });
