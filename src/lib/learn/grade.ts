/**
 * From one answer to an FSRS rating (PROMPT.md 3.2):
 *
 * | What happened                                         | Rating |
 * |-------------------------------------------------------|--------|
 * | Wrong, gave up, or a wrong pick in easy mode          | Again  |
 * | Right after a hint, or with an accepted typo          | Hard   |
 * | Right                                                 | Good   |
 * | Right, no typo, no hint, under 4 s from the flag shown | Easy   |
 *
 * Easy mode (picking from four) counts with less weight: a right pick is
 * Hard at best, so recognising never schedules like recalling.
 */

/** Same numbers as ts-fsrs's `Rating` (kept here so this file needs no import). */
export const AGAIN = 1;
export const HARD = 2;
export const GOOD = 3;
export const EASY = 4;
export type Rating = typeof AGAIN | typeof HARD | typeof GOOD | typeof EASY;

export const EASY_MS = 4000;

export interface Answer {
	correct: boolean;
	gaveUp?: boolean;
	typo?: boolean;
	hints?: number;
	/** From when the flag appeared to the answer. */
	ms: number;
	/** Picked from four (easy mode) rather than typed. */
	picked?: boolean;
}

export function rate(a: Answer): Rating {
	if (!a.correct || a.gaveUp) return AGAIN;
	if (a.picked) return HARD;
	if (a.typo || (a.hints ?? 0) > 0) return HARD;
	if (a.ms < EASY_MS) return EASY;
	return GOOD;
}

export const isRight = (r: Rating) => r !== AGAIN;
