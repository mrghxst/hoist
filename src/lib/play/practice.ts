/**
 * The Practice modes (PROMPT.md 2.4), as data for the `/practice` cards and
 * the `/practice/[mode]` sessions.
 */
import { REGIONS, scopeOf, title } from './scope.ts';
import type { CardMode } from '#lib/learn/types.ts';

export type Kind = 'review' | 'learn' | 'region' | 'capitals' | 'reverse' | 'easy' | 'lookalikes' | 'speed' | 'drill';

export interface PracticeMode {
	slug: string;
	kind: Kind;
	title: string;
	/** One line of text on the card. */
	line: string;
	/** The card this mode schedules (and counts on its card). */
	card: CardMode;
	/** Region id for Region modes. */
	region?: string;
	/** Not listed on /practice (reached from elsewhere). */
	hidden?: boolean;
}

export const PRACTICE: PracticeMode[] = [
	{ slug: 'review', kind: 'review', title: 'Review', line: 'Flags due for another look, just before you would forget them.', card: 'flag' },
	{ slug: 'learn', kind: 'learn', title: 'Learn new', line: 'Five new flags: study them, then name them.', card: 'flag' },
	{ slug: 'capitals', kind: 'capitals', title: 'Capitals', line: 'See the flag and the name, type the capital.', card: 'capital' },
	{ slug: 'reverse', kind: 'reverse', title: 'Reverse', line: 'The globe shows a country, type its name.', card: 'reverse' },
	{ slug: 'lookalikes', kind: 'lookalikes', title: 'Lookalikes', line: 'Flags that are easy to mix up, back to back, with how to tell them apart.', card: 'flag' },
	{ slug: 'speed', kind: 'speed', title: 'Speed run', line: 'All 197, or one region, against the clock.', card: 'flag' },
	{ slug: 'easy', kind: 'easy', title: 'Easy mode', line: 'Pick from four flags or four names. Good for beginners.', card: 'flag' },
	{ slug: 'drill', kind: 'drill', title: 'Drill', line: 'Practise a few flags and their lookalikes.', card: 'flag', hidden: true },
	...REGIONS.map(
		(r): PracticeMode => ({
			slug: r,
			kind: 'region',
			title: title(scopeOf(r).label),
			line: `Flags of ${scopeOf(r).label}.`,
			card: 'flag',
			region: r
		})
	)
];

export const modeOf = (slug: string) => PRACTICE.find((m) => m.slug === slug);
