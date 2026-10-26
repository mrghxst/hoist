/**
 * Hints (PROMPT.md 3.3): Tab reveals the next letter of the answer, one per
 * press, at most half of the name's letters. Spaces and punctuation come for
 * free so the shape of the name shows.
 *
 * How many letters a round allows depends on the mode (owner, M8):
 *
 * - `half`: up to half the letters, any time (Practice)
 * - `one`: one letter, for a quarter of the points (Daily)
 * - `timed`: the first letter after 10 s, then one every 5 s, up to half (Speed run)
 * - `none`: no letters at all (Play's runs)
 */
export type HintRule = 'half' | 'one' | 'timed' | 'none';

export const TIMED_FIRST = 10_000;
export const TIMED_EVERY = 5_000;

const isLetter = (ch: string) => /\p{L}|\p{N}/u.test(ch);

export function maxHints(name: string): number {
	const letters = [...name].filter(isLetter).length;
	return Math.max(1, Math.floor(letters / 2));
}

/**
 * Ms until Tab may give the next letter: 0 now, `null` never (for this flag).
 * `given` letters were given so far, `elapsed` ms since the flag showed.
 */
export function hintWait(rule: HintRule, name: string, given: number, elapsed: number): number | null {
	const max = maxHints(name);
	const cap = rule === 'none' ? 0 : rule === 'one' ? Math.min(1, max) : max;
	if (given >= cap) return null;
	if (rule !== 'timed') return 0;
	return Math.max(0, TIMED_FIRST + TIMED_EVERY * given - elapsed);
}

/** The visible start of the name after `count` hints. */
export function hintText(name: string, count: number): string {
	const chars = [...name];
	let shown = 0;
	let out = '';
	for (const ch of chars) {
		if (isLetter(ch)) {
			if (shown >= count) break;
			shown++;
		}
		out += ch;
	}
	return out;
}
