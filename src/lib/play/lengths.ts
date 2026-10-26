/**
 * The run lengths on Play's bar (owner, M8): 20 is the default and the one
 * the charts open on. Apart from `run.ts` so that the bar and Progress can
 * have them without the rest, which loads with the quiz engine.
 */
export const RUN_LENGTHS = [10, 20, 30] as const;
export const DEFAULT_RUN = 20;
export const MIN_RUN = 3;
