import { describe, expect, it } from 'vitest';
import { hintText, hintWait, maxHints, TIMED_EVERY, TIMED_FIRST } from '../src/lib/match/hint.ts';

describe('hints (PROMPT.md 3.3, owner M8)', () => {
	it('gives up to half the letters, spaces for free', () => {
		expect(maxHints('Côte d’Ivoire')).toBe(5);
		expect(hintText('South Korea', 6)).toBe('South K');
	});

	it('Practice: any time, up to half', () => {
		expect(hintWait('half', 'France', 0, 0)).toBe(0);
		expect(hintWait('half', 'France', 3, 0)).toBeNull();
	});

	it('Daily: one letter only', () => {
		expect(hintWait('one', 'France', 0, 0)).toBe(0);
		expect(hintWait('one', 'France', 1, 60_000)).toBeNull();
	});

	it('Runs: none', () => {
		expect(hintWait('none', 'France', 0, 60_000)).toBeNull();
	});

	it('Speed run: the first after 10 s, then one every 5 s, up to half', () => {
		expect(hintWait('timed', 'Switzerland', 0, 0)).toBe(TIMED_FIRST);
		expect(hintWait('timed', 'Switzerland', 0, 9_000)).toBe(1_000);
		expect(hintWait('timed', 'Switzerland', 0, 10_000)).toBe(0);
		expect(hintWait('timed', 'Switzerland', 1, 10_000)).toBe(TIMED_EVERY);
		expect(hintWait('timed', 'Switzerland', 2, 20_000)).toBe(0);
		expect(hintWait('timed', 'Switzerland', 5, 999_000)).toBeNull();
	});
});
