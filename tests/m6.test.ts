import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { proportions } from '../src/lib/flags.ts';
import { extraNames } from '../src/lib/play/languages.ts';
import { buildIndex, check } from '../src/lib/match/match.ts';
import { wrap } from '../src/lib/server/og.ts';
import type { GameData } from '../src/lib/data/types.ts';

const data = JSON.parse(readFileSync('src/lib/data/game.json', 'utf8')) as GameData;
const translations = JSON.parse(readFileSync('src/lib/data/translations.json', 'utf8')) as Record<string, Record<string, string[]>>;

describe('flag proportions', () => {
	it.each([
		[1.5, '2:3'],
		[2, '1:2'],
		[1.9, '10:19'],
		[2.5455, '11:28'],
		[1, '1:1'],
		[1.1538, '13:15'],
		[1.4286, '7:10']
	])('%f → %s', (ratio, text) => expect(proportions(ratio)).toBe(text));
});

describe('also accept names in other languages (PROMPT.md 5.2)', () => {
	const index = (codes: string[]) => buildIndex(data.countries, data.ambiguous, extraNames(translations, codes, data.countries));

	it('accepts German and French names when turned on', () => {
		const de = index(['deu']);
		expect(check('Deutschland', 'DE', de)).toMatchObject({ kind: 'right' });
		expect(check('Schweiz', 'CH', de)).toMatchObject({ kind: 'right' });
		const fr = index(['fra']);
		expect(check('Allemagne', 'DE', fr)).toMatchObject({ kind: 'right' });
	});

	it('does not accept them when off', () => {
		expect(check('Deutschland', 'DE', index([]))).toMatchObject({ kind: 'wrong' });
	});

	it('never lets a translation take another country’s English name', () => {
		const pl = index(['pol']);
		expect(check('Sudan', 'SS', pl)).toMatchObject({ kind: 'wrong' });
		expect(check('Sudan', 'SD', pl)).toMatchObject({ kind: 'right' });
	});
});

describe('OG image text', () => {
	it('wraps long names onto two lines', () => {
		expect(wrap('Saint Vincent and the Grenadines', 16)).toEqual(['Saint Vincent', 'and the Grenadines']);
		expect(wrap('Japan', 16)).toEqual(['Japan']);
	});
});
