import { byId, listed, lookalikes } from '#lib/server/catalog.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	groups: lookalikes.map((g) => ({ id: g.id, tip: g.tip, members: g.members.map((id) => listed(byId.get(id)!)) }))
});
