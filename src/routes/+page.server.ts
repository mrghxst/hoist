import game from '#lib/data/game.json';
import type { GameData } from '#lib/data/types.ts';
import { runPool } from '#lib/play/run.ts';

// Prerendered. The run's first flag is filled in by an inline script
// (`#lib/server/first-flag.ts`); the page only needs the pool's size.
export function load() {
	return { pool: runPool(game as unknown as GameData).length };
}
