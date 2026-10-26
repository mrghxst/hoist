import { error } from '@sveltejs/kit';
import { byId, countries, flags, listed, lookalikes } from '#lib/server/catalog.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => countries.map((c) => ({ slug: c.slug }));

export const load: PageServerLoad = ({ params }) => {
	const country = countries.find((c) => c.slug === params.slug);
	if (!country) error(404, 'No such flag');
	const groups = lookalikes
		.filter((g) => g.members.includes(country.id))
		.map((g) => ({ id: g.id, tip: g.tip, members: g.members.filter((id) => id !== country.id).map((id) => listed(byId.get(id)!)) }));
	return { country, flag: flags[country.id]!, image: listed(country).flag, groups };
};
