/**
 * The Practice modes (PROMPT.md 2.4), as data for the `/practice` cards and
 * the `/practice/[mode]` sessions. Lookalikes and Speed run come with M5.
 */
import { REGIONS, scopeOf, title } from './scope.ts';
import type { CardMode } from '#lib/learn/types.ts';

export type Kind = 'review' | 'learn' | 'region' | 'capitals' | 'reverse' | 'easy';

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
}

export const PRACTICE: PracticeMode[] = [
	{ slug: 'review', kind: 'review', title: 'Review', line: 'What spaced repetition says is due.', card: 'flag' },
	{ slug: 'learn', kind: 'learn', title: 'Learn new', line: 'Five new flags: study them, then name them.', card: 'flag' },
	{ slug: 'capitals', kind: 'capitals', title: 'Capitals', line: 'See the flag and the name, type the capital.', card: 'capital' },
	{ slug: 'reverse', kind: 'reverse', title: 'Reverse', line: 'The globe shows a country, type its name.', card: 'reverse' },
	{ slug: 'easy', kind: 'easy', title: 'Easy mode', line: 'Pick from four flags or four names. Good for beginners.', card: 'flag' },
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
