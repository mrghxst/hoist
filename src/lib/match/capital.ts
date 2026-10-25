/**
 * Checking typed capitals (the Capitals mode, PROMPT.md 2.4), with the same
 * rules as country names: accents and case ignored, typos allowed by
 * length, and a near-miss that is another country's capital is wrong.
 *
 * Accepted: the capital, its listed alternatives (La Paz for Bolivia, Cape
 * Town and Bloemfontein for South Africa, ...), and for "… City" capitals
 * the name without "City" (Mexico, Kuwait, Panama).
 */
import { buildIndex, check, type MatchResult, type NameIndex, type Nameable } from './match.ts';
import type { Capital } from '#lib/data/types.ts';

export function capitalNames(capital: Capital): string[] {
	const names = [capital.name, ...(capital.alts ?? [])];
	for (const n of [...names]) {
		const short = n.replace(/\s+City$/i, '');
		if (short !== n && short.length >= 4) names.push(short);
	}
	return names;
}

export function capitalIndex(countries: readonly { id: string; capital: Capital }[]): NameIndex {
	const entries: Nameable[] = countries.map((c) => ({ id: c.id, name: c.capital.name, names: capitalNames(c.capital) }));
	return buildIndex(entries, {});
}

export function checkCapital(answer: string, target: string, index: NameIndex): MatchResult {
	return check(answer, target, index);
}
