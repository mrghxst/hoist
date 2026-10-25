/**
 * Small facts about flags for the flag pages (PROMPT.md 2.6).
 */

/**
 * A flag's proportions as height:width with small whole numbers, the way
 * flags are usually described: 1.5 → "2:3", 2.545 → "11:28" (Qatar),
 * 1 → "1:1" (Switzerland, Vatican City).
 */
export function proportions(ratio: number): string {
	for (let h = 1; h <= 40; h++) {
		const w = Math.round(ratio * h);
		if (w > 0 && Math.abs(w / h - ratio) < 0.006) return `${h}:${w}`;
	}
	return `1:${ratio.toFixed(2)}`;
}

/** Flags that are not rectangles, with a short note (PROMPT.md 6.2). */
export const NOT_RECTANGULAR: Record<string, string> = {
	NP: "Not a rectangle: Nepal's flag is two stacked pennants, the only national flag that is not four-sided."
};
