/**
 * "Also accept names in …" (PROMPT.md 5.2): country names in other languages
 * the player can turn on. English is always accepted.
 */
import { normalize } from '#lib/match/normalize.ts';

export const LANGUAGES: { code: string; name: string }[] = [
	{ code: 'ara', name: 'Arabic' },
	{ code: 'zho', name: 'Chinese' },
	{ code: 'hrv', name: 'Croatian' },
	{ code: 'ces', name: 'Czech' },
	{ code: 'nld', name: 'Dutch' },
	{ code: 'est', name: 'Estonian' },
	{ code: 'fin', name: 'Finnish' },
	{ code: 'fra', name: 'French' },
	{ code: 'deu', name: 'German' },
	{ code: 'hun', name: 'Hungarian' },
	{ code: 'ita', name: 'Italian' },
	{ code: 'jpn', name: 'Japanese' },
	{ code: 'kor', name: 'Korean' },
	{ code: 'per', name: 'Persian' },
	{ code: 'pol', name: 'Polish' },
	{ code: 'por', name: 'Portuguese' },
	{ code: 'rus', name: 'Russian' },
	{ code: 'srp', name: 'Serbian' },
	{ code: 'slk', name: 'Slovak' },
	{ code: 'spa', name: 'Spanish' },
	{ code: 'swe', name: 'Swedish' },
	{ code: 'tur', name: 'Turkish' },
	{ code: 'urd', name: 'Urdu' }
];

/**
 * The names to accept per country for the chosen languages. A translation
 * that is another country's English name is left out: English always wins
 * (Polish lists "Sudan" for South Sudan).
 */
export function extraNames(
	translations: Record<string, Record<string, string[]>>,
	codes: readonly string[],
	countries: readonly { id: string; names: string[] }[]
): Record<string, string[]> {
	const english = new Map<string, string>();
	for (const c of countries) for (const n of c.names) english.set(normalize(n), c.id);
	const out: Record<string, string[]> = {};
	for (const code of codes) {
		for (const [id, names] of Object.entries(translations[code] ?? {})) {
			for (const name of names) {
				const owner = english.get(normalize(name));
				if (!owner || owner === id) (out[id] ??= []).push(name);
			}
		}
	}
	return out;
}
