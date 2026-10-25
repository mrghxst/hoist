import { error } from '@sveltejs/kit';
import { PRACTICE, modeOf } from '#lib/play/practice.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => PRACTICE.map((m) => ({ mode: m.slug }));

export const load: PageServerLoad = ({ params }) => {
	const mode = modeOf(params.mode);
	if (!mode) error(404, 'No such practice mode');
	return { mode };
};
