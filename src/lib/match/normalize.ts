/**
 * Normalising names for matching (PROMPT.md 5.1). Used at runtime by the
 * answer checker and at build time by the data audits, so both agree.
 *
 * `Côte d'Ivoire`, `cote divoire` and `Cote D'Ivoire` all become `cotedivoire`.
 */

// Letters that NFD does not split into a base letter plus a mark.
const FOLD: Record<string, string> = {
	ß: 'ss',
	æ: 'ae',
	œ: 'oe',
	ø: 'o',
	đ: 'd',
	ð: 'd',
	ł: 'l',
	þ: 'th',
	ı: 'i'
};

const FOLD_RE = new RegExp(`[${Object.keys(FOLD).join('')}]`, 'g');

export function normalize(input: string): string {
	return input
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(FOLD_RE, (c) => FOLD[c] ?? c)
		.replace(/&/g, ' and ')
		.replace(/(^|[\s\-.])st\.?(?=[\s\-]|$)/g, '$1saint')
		.replace(/\bthe\b/g, ' ')
		.replace(/[^\p{L}\p{N}]/gu, '');
}
