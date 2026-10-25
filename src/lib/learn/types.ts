/**
 * The progress store's shapes (PROMPT.md 3.4). Everything a player has done
 * lives in one versioned JSON object under `hoist:v1`.
 */

/**
 * What a card asks. Each country has one card per scheduling mode
 * (PROMPT.md 3.2): flag → name is the main card; capital and reverse are
 * separate. Easy mode feeds the main card with less weight.
 */
export type CardMode = 'flag' | 'capital' | 'reverse';

/** `flag:JP`, `capital:JP`, `reverse:JP`. */
export type CardKey = `${CardMode}:${string}`;

/** FSRS state, kept short: 197 countries × 3 modes must stay well under 200 KB. */
export interface StoredCard {
	/** Due, ms since epoch. */
	due: number;
	/** Stability (days). */
	s: number;
	/** Difficulty (1–10). */
	d: number;
	reps: number;
	lapses: number;
	/** 0 New, 1 Learning, 2 Review, 3 Relearning (ts-fsrs `State`). */
	state: 0 | 1 | 2 | 3;
	/** Learning step index within the (re)learning steps. */
	step: number;
	/** Days scheduled at the last review. */
	sched: number;
	/** Last review, ms since epoch. */
	last: number;
}

/** One local calendar day of practice, for the calendar strip and limits. */
export interface DayLog {
	/** Answers given. */
	n: number;
	/** Answers right (Hard, Good or Easy). */
	right: number;
	/** New cards introduced per mode (each mode has its own daily limit). */
	fresh: Partial<Record<CardMode, number>>;
}

export type Theme = 'light' | 'dark' | 'system';

export interface Settings {
	theme?: Theme;
	/** What Play drills: 'all' or a region id. Unset until the starter round. */
	scope?: string;
	/** New cards per day (PROMPT.md 3.2): 5, 10, 20 or 30. */
	newPerDay?: 5 | 10 | 20 | 30;
	/** Include the territories pack (PROMPT.md 7.1). */
	territories?: boolean;
	/** Extra languages whose names are accepted (M6). */
	languages?: string[];
	sound?: boolean;
	haptics?: boolean;
}

export interface Progress {
	/** Schema version. */
	v: 1;
	settings: Settings;
	cards: Record<string, StoredCard>;
	/** Keyed by local date, `YYYY-MM-DD`. */
	days: Record<string, DayLog>;
	/** Last change, ms since epoch (import merges by most recent). */
	updated: number;
}
