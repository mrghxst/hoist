/**
 * Hints (PROMPT.md 3.3): Tab reveals the next letter of the answer, one per
 * press, at most half of the name's letters. Spaces and punctuation come for
 * free so the shape of the name shows.
 */

const isLetter = (ch: string) => /\p{L}|\p{N}/u.test(ch);

export function maxHints(name: string): number {
	const letters = [...name].filter(isLetter).length;
	return Math.max(1, Math.floor(letters / 2));
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
