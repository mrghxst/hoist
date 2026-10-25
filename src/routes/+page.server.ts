import game from '#lib/data/game.json';
import type { GameData } from '#lib/data/types.ts';

// Prerendered: the first flag of the starter round is in the initial HTML,
// so it shows without JavaScript (PROMPT.md 10). Its name is not.
export function load() {
	const data = game as unknown as GameData;
	const first = data.countries.find((c) => c.id === data.starter[0])!;
	return { first: { flag: first.flag, ratio: first.ratio } };
}
