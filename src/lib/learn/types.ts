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
	/** A soft tick and a low tone, off by default (PROMPT.md 6.2). */
	sound?: boolean;
	/** A 10 ms vibration on a right answer, on by default. */
	haptics?: boolean;
	/** Show a new flag (name, capital, globe) before asking it. Off by default (owner, M8). */
	introduce?: boolean;
	/** Flags in Play's runs: 10, 20 (the default), 30 or a custom number. */
	runLength?: number;
}

/** One finished daily challenge (PROMPT.md 2.3). */
export interface DailyResult {
	right: number;
	/** From the first flag to the last answer. */
	ms: number;
	/** One letter per flag: G right, Y right with a typo or a hint, R wrong. */
	marks: string;
}

/** A finished speed run, the best one kept per scope (PROMPT.md 2.4). */
export interface SpeedResult {
	right: number;
	total: number;
	ms: number;
	/** When it was run, ms since epoch. */
	at: number;
}

/** One finished run on Play (owner, M8). */
export interface RunResult {
	/** Flags in the run. */
	n: number;
	right: number;
	ms: number;
	/** When it was run, ms since epoch. */
	at: number;
	/** One letter per flag: G right, R wrong. */
	marks: string;
	/** The seed of its order, so it can be played again (`run.ts`). */
	seed: number;
}

export interface Progress {
	/** Schema version. */
	v: 3;
	settings: Settings;
	cards: Record<string, StoredCard>;
	/** Keyed by local date, `YYYY-MM-DD`. */
	days: Record<string, DayLog>;
	/** Daily challenges, keyed by UTC date (everyone's daily is the same). */
	daily: Record<string, DailyResult>;
	/** Best speed run per scope (`all`, `europe`, ...). */
	best: Record<string, SpeedResult>;
	/** Play's runs, oldest first, the last `MAX_RUNS` kept. */
	runs: RunResult[];
	/** Last change, ms since epoch (import merges by most recent). */
	updated: number;
}
