/**
 * What a session covers: all 197, a continent (the first-visit choice,
 * PROMPT.md 2.2) or one of the seven practice regions (2.4). The
 * territories pack joins only when it is turned on (7.1).
 */
import type { GameCountry, GameData } from '#lib/data/types.ts';

export interface Scope {
	id: string;
	label: string;
	test: (c: GameCountry) => boolean;
}

export const SCOPES: Scope[] = [
	{ id: 'all', label: 'All flags', test: () => true },
	{ id: 'europe', label: 'Europe', test: (c) => c.region === 'europe' },
	{ id: 'africa', label: 'Africa', test: (c) => c.region === 'africa' },
	{ id: 'asia', label: 'Asia', test: (c) => c.region === 'asia' },
	{ id: 'americas', label: 'Americas', test: (c) => c.continent === 'Americas' },
	{ id: 'north-america', label: 'North America', test: (c) => c.region === 'north-america' },
	{ id: 'south-america', label: 'South America', test: (c) => c.region === 'south-america' },
	{ id: 'caribbean', label: 'the Caribbean', test: (c) => c.region === 'caribbean' },
	{ id: 'oceania', label: 'Oceania', test: (c) => c.region === 'oceania' }
];

/** The choice after the starter round. */
export const FIRST_CHOICE = ['all', 'europe', 'africa', 'asia', 'americas', 'oceania'];
/** The Region cards on Practice. */
export const REGIONS = ['europe', 'africa', 'asia', 'north-america', 'south-america', 'oceania', 'caribbean'];

export function scopeOf(id: string | undefined): Scope {
	return SCOPES.find((s) => s.id === id) ?? SCOPES[0]!;
}

export function scopeIds(data: GameData, scope: string | undefined, territories = false): string[] {
	const s = scopeOf(scope);
	return data.countries.filter((c) => (territories || c.pack === 'core') && s.test(c)).map((c) => c.id);
}

/** "Europe", "All flags", "the Caribbean" → capitalised for a heading. */
export const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
