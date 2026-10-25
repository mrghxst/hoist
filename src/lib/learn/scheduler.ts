/**
 * FSRS scheduling (PROMPT.md 3.2): ts-fsrs with its default parameters and a
 * desired retention of 0.9. This file is the only one that knows ts-fsrs;
 * the rest of the app sees `StoredCard`.
 */
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import type { Rating } from './grade.ts';
import type { StoredCard } from './types.ts';

export const RETENTION = 0.9;
const DAY = 86_400_000;

const scheduler = fsrs({ request_retention: RETENTION });

function toFsrs(c: StoredCard): Card {
	return {
		due: new Date(c.due),
		stability: c.s,
		difficulty: c.d,
		elapsed_days: 0,
		scheduled_days: c.sched,
		learning_steps: c.step,
		reps: c.reps,
		lapses: c.lapses,
		state: c.state,
		last_review: c.reps > 0 ? new Date(c.last) : undefined
	};
}

function fromFsrs(c: Card, now: number): StoredCard {
	return {
		due: c.due.getTime(),
		s: round(c.stability),
		d: round(c.difficulty),
		reps: c.reps,
		lapses: c.lapses,
		state: c.state as StoredCard['state'],
		step: c.learning_steps,
		sched: c.scheduled_days,
		last: now
	};
}

/** Four decimals are plenty and keep the stored JSON short. */
const round = (x: number) => Math.round(x * 1e4) / 1e4;

/** Schedules one answer. `card` is undefined for a card never seen. */
export function review(card: StoredCard | undefined, rating: Rating, now: number): StoredCard {
	const input = card ? toFsrs(card) : createEmptyCard(new Date(now));
	const next = scheduler.next(input, new Date(now), rating as Grade, (r) => r.card);
	return fromFsrs(next, now);
}

export const isDue = (c: StoredCard, now: number) => c.due <= now;

/** Chance of recalling it now, 0–1. */
export function recall(c: StoredCard, now: number): number {
	if (c.reps === 0) return 0;
	return scheduler.get_retrievability(toFsrs(c), new Date(now), false);
}

/** Days until it is due again, as scheduled at the last review. */
export const intervalDays = (c: StoredCard) => (c.due - c.last) / DAY;

/**
 * How well a card is known, in the four steps of the mastery globe
 * (PROMPT.md 2.5): 0 untouched, 1 learning, 2 known, 3 mastered.
 * Mastered means in review with a stability of three weeks or more.
 */
export type Level = 0 | 1 | 2 | 3;
export const MASTERED_DAYS = 21;

export function level(c: StoredCard | undefined): Level {
	if (!c || c.reps === 0) return 0;
	if (c.state !== 2) return 1;
	return c.s >= MASTERED_DAYS ? 3 : 2;
}
