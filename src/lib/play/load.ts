/**
 * Quiz data is fetched, not bundled, so the play page's JavaScript stays
 * small (PROMPT.md 10). Vite gives the file a content hash, so it is cached
 * for a year like any other immutable asset.
 */
import gameUrl from '#lib/data/game.json?url';
import translationsUrl from '#lib/data/translations.json?url';
import type { GameData } from '#lib/data/types.ts';

let game: Promise<GameData> | undefined;
let translations: Promise<Record<string, Record<string, string[]>>> | undefined;

export const GAME_URL = gameUrl;

export function loadGame(): Promise<GameData> {
	game ??= fetch(gameUrl).then((r) => {
		if (!r.ok) throw new Error(`game data: ${r.status}`);
		return r.json() as Promise<GameData>;
	});
	return game;
}

export function loadTranslations(): Promise<Record<string, Record<string, string[]>>> {
	translations ??= fetch(translationsUrl).then((r) => {
		if (!r.ok) throw new Error(`translations: ${r.status}`);
		return r.json() as Promise<Record<string, Record<string, string[]>>>;
	});
	return translations;
}
