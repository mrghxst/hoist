/**
 * Everything the quiz needs once the page has painted, in one lazy chunk:
 * the game, the decks, the learner and the scheduler (ts-fsrs). Pages
 * import it with `import('#lib/play/engine.ts')` after first paint, so none
 * of it is in the initial JavaScript (PROMPT.md 10).
 */
import { Learner } from '#lib/learn/learner.ts';
import { Planner } from '#lib/learn/plan.ts';
import { LocalStore } from '#lib/learn/store.ts';
import { STORAGE_KEY } from '#lib/store/storage.ts';
import type { GameData } from '#lib/data/types.ts';

export { Game, ListDeck } from './game.svelte.ts';
export { DailyDeck, LearnDeck, MODES, SpeedDeck } from './decks.ts';
export { dailySet, utcDay } from '#lib/learn/daily.ts';
export { feedback } from './feedback.ts';
export { extraNames } from './languages.ts';
export { Learner, Planner };
// The parts of the play screen that only show once the quiz is running.
export { default as Reveal } from './Reveal.svelte';
export { default as Pick } from './Pick.svelte';
// Progress page actions.
export { emptyProgress } from '#lib/learn/schema.ts';
export { exportProgress, merge, parseImport, EXPORT_NAME } from '#lib/learn/transfer.ts';

export interface PlayContext {
	data: GameData;
	learner: Learner;
	planner: Planner;
}

let learner: Learner | undefined;

/** The one learner for this tab; follows saves from other tabs. */
export function getLearner(): Learner {
	if (learner) return learner;
	const l = (learner = new Learner(new LocalStore()));
	addEventListener('storage', (e) => {
		if (e.key === STORAGE_KEY) l.reload();
	});
	return l;
}

export function context(data: GameData): PlayContext {
	const l = getLearner();
	return { data, learner: l, planner: new Planner(data, l) };
}
