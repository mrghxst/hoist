import { describe, expect, it } from 'vitest';
import countries from '../src/lib/data/countries.json' with { type: 'json' };
import aliases from '../data/aliases.json' with { type: 'json' };
import translations from '../src/lib/data/translations.json' with { type: 'json' };
import { allowance, buildIndex, check, distance, type MatchResult } from '../src/lib/match/match.ts';
import { normalize } from '../src/lib/match/normalize.ts';
import type { Country } from '../src/lib/data/types.ts';

const core = (countries as Country[]).filter((c) => c.pack === 'core');
const index = buildIndex(core, aliases.ambiguous);

type Expect = 'right' | 'typo' | 'ambiguous' | `wrong` | `wrong:${string}`;

function outcome(r: MatchResult): string {
	switch (r.kind) {
		case 'right':
			return r.typo ? 'typo' : 'right';
		case 'wrong':
			return r.id ? `wrong:${r.id}` : 'wrong';
		default:
			return r.kind;
	}
}

// [flag shown, what the player typed, expected outcome]
const cases: [string, string, Expect][] = [
	// Exact names, any case, accents, punctuation
	['JP', 'Japan', 'right'],
	['JP', 'japan', 'right'],
	['JP', '  JAPAN  ', 'right'],
	['CI', "Côte d'Ivoire", 'right'],
	['CI', 'cote divoire', 'right'],
	['CI', "Cote D'Ivoire", 'right'],
	['CI', 'Côte-d’Ivoire', 'right'],
	['CI', 'Ivory Coast', 'right'],
	['ST', 'São Tomé and Príncipe', 'right'],
	['ST', 'Sao Tome and Principe', 'right'],
	['ST', 'sao tome & principe', 'right'],
	['KN', 'Saint Kitts and Nevis', 'right'],
	['KN', 'St Kitts and Nevis', 'right'],
	['KN', 'St. Kitts & Nevis', 'right'],
	['LC', 'St Lucia', 'right'],
	['LC', 'Saint Lucia', 'right'],
	['VC', 'St Vincent and the Grenadines', 'right'],
	['VC', 'Saint Vincent', 'right'],
	['GM', 'The Gambia', 'right'],
	['GM', 'Gambia', 'right'],
	['BS', 'The Bahamas', 'right'],
	['BS', 'bahamas', 'right'],
	['GW', 'Guinea-Bissau', 'right'],
	['GW', 'guinea bissau', 'right'],
	['TL', 'Timor-Leste', 'right'],
	['TL', 'timor leste', 'right'],
	['BA', 'Bosnia & Herzegovina', 'right'],
	['AG', 'Antigua & Barbuda', 'right'],
	['TT', 'Trinidad & Tobago', 'right'],
	['PG', 'Papua New Guinea', 'right'],
	['GQ', 'Equatorial Guinea', 'right'],
	['NL', 'The Netherlands', 'right'],
	['PH', 'The Philippines', 'right'],

	// Names from the brief's table (5.2)
	['TR', 'Türkiye', 'right'],
	['TR', 'Turkey', 'right'],
	['TR', 'Turkiye', 'right'],
	['CZ', 'Czechia', 'right'],
	['CZ', 'Czech Republic', 'right'],
	['SZ', 'Eswatini', 'right'],
	['SZ', 'Swaziland', 'right'],
	['MM', 'Myanmar', 'right'],
	['MM', 'Burma', 'right'],
	['CV', 'Cabo Verde', 'right'],
	['CV', 'Cape Verde', 'right'],
	['TL', 'East Timor', 'right'],
	['MK', 'North Macedonia', 'right'],
	['MK', 'Macedonia', 'right'],
	['GB', 'United Kingdom', 'right'],
	['GB', 'UK', 'right'],
	['GB', 'Great Britain', 'right'],
	['GB', 'Britain', 'right'],
	['US', 'United States', 'right'],
	['US', 'USA', 'right'],
	['US', 'US', 'right'],
	['US', 'U.S.A.', 'right'],
	['US', 'America', 'right'],
	['US', 'United States of America', 'right'],
	['AE', 'United Arab Emirates', 'right'],
	['AE', 'UAE', 'right'],
	['AE', 'Emirates', 'right'],
	['VA', 'Vatican City', 'right'],
	['VA', 'Holy See', 'right'],
	['VA', 'Vatican', 'right'],
	['BA', 'Bosnia', 'right'],
	['CD', 'Democratic Republic of the Congo', 'right'],
	['CD', 'DR Congo', 'right'],
	['CD', 'DRC', 'right'],
	['CD', 'Congo-Kinshasa', 'right'],
	['CG', 'Republic of the Congo', 'right'],
	['CG', 'Congo-Brazzaville', 'right'],
	['BR', 'Brazil', 'right'],
	['BR', 'Brasil', 'right'],

	// Other common alternatives
	['NL', 'Holland', 'right'],
	['KR', 'South Korea', 'right'],
	['KR', 'Republic of Korea', 'right'],
	['KP', 'North Korea', 'right'],
	['KP', 'DPRK', 'right'],
	['CN', 'China', 'right'],
	['CN', "People's Republic of China", 'right'],
	['TW', 'Taiwan', 'right'],
	['TW', 'Republic of China', 'right'],
	['PS', 'Palestine', 'right'],
	['PS', 'State of Palestine', 'right'],
	['XK', 'Kosovo', 'right'],
	['RU', 'Russia', 'right'],
	['RU', 'Russian Federation', 'right'],
	['LA', 'Laos', 'right'],
	['VN', 'Vietnam', 'right'],
	['VN', 'Viet Nam', 'right'],
	['IR', 'Iran', 'right'],
	['IR', 'Persia', 'right'],
	['LK', 'Sri Lanka', 'right'],
	['LK', 'Ceylon', 'right'],
	['FM', 'Micronesia', 'right'],
	['FM', 'Federated States of Micronesia', 'right'],
	['IE', 'Ireland', 'right'],
	['IE', 'Eire', 'right'],
	['SY', 'Syria', 'right'],
	['GN', 'Guinea', 'right'],
	['SS', 'South Sudan', 'right'],
	['SD', 'Sudan', 'right'],
	['NE', 'Niger', 'right'],
	['NG', 'Nigeria', 'right'],
	['DM', 'Dominica', 'right'],
	['DO', 'Dominican Republic', 'right'],

	// Must-pass confusions (5.3): another country's name is wrong
	['NE', 'Nigeria', 'wrong:NG'],
	['NG', 'Niger', 'wrong:NE'],
	['DM', 'Dominican Republic', 'wrong:DO'],
	['DO', 'Dominica', 'wrong:DM'],
	['AT', 'Australia', 'wrong:AU'],
	['AU', 'Austria', 'wrong:AT'],
	['IR', 'Iraq', 'wrong:IQ'],
	['IQ', 'Iran', 'wrong:IR'],
	['ML', 'Malawi', 'wrong:MW'],
	['MW', 'Mali', 'wrong:ML'],
	['SI', 'Slovakia', 'wrong:SK'],
	['SK', 'Slovenia', 'wrong:SI'],
	['GN', 'Guinea-Bissau', 'wrong:GW'],
	['GW', 'Equatorial Guinea', 'wrong:GQ'],
	['GQ', 'Papua New Guinea', 'wrong:PG'],
	['PG', 'Guinea-Bissau', 'wrong:GW'],
	['SD', 'South Sudan', 'wrong:SS'],
	['SS', 'Sudan', 'wrong:SD'],
	['RO', 'Chad', 'wrong:TD'],
	['TD', 'Romania', 'wrong:RO'],
	['ID', 'Monaco', 'wrong:MC'],
	['IE', 'Ivory Coast', 'wrong:CI'],
	['NO', 'Iceland', 'wrong:IS'],
	['NZ', 'Australia', 'wrong:AU'],
	['JP', 'China', 'wrong:CN'],
	['CG', 'DR Congo', 'wrong:CD'],
	['CD', 'Congo-Brazzaville', 'wrong:CG'],
	['GE', 'Georgia', 'right'],
	['ZM', 'Zimbabwe', 'wrong:ZW'],

	// Typos accepted as Hard: 1 for 5–8 letters, 2 for 9+
	['PH', 'Phillipines', 'typo'],
	['PH', 'Philipines', 'typo'],
	['CO', 'Columbia', 'typo'],
	['AR', 'Argentinia', 'typo'],
	['KG', 'Kyrgystan', 'typo'],
	['KZ', 'Kazakstan', 'typo'],
	['LI', 'Lichtenstein', 'typo'],
	['MG', 'Madagaskar', 'typo'],
	['PT', 'Portgual', 'typo'],
	['DE', 'Germnay', 'typo'],
	['BR', 'Brazill', 'typo'],
	['VE', 'Venezuala', 'typo'],
	['MZ', 'Mozambiqe', 'typo'],
	['BD', 'Bangaldesh', 'typo'],
	['ZW', 'Zimbabwi', 'typo'],
	['CH', 'Switzerlnd', 'typo'],
	['SE', 'Swedn', 'typo'],
	['NO', 'Norwy', 'typo'],
	['FI', 'Finlnd', 'typo'],
	['SI', 'Slovnia', 'typo'],
	['SK', 'Slovakai', 'typo'],
	['MV', 'Maldivs', 'typo'],
	['TR', 'Turky', 'typo'],
	['UZ', 'Uzbekistn', 'typo'],
	['ER', 'Eritria', 'typo'],
	['MR', 'Mauritanía', 'right'],
	['MU', 'Mauritus', 'typo'],
	['NL', 'Netherland', 'typo'],
	['BA', 'Bosnia Herzegovina', 'right'],
	['SC', 'Seychells', 'typo'],
	['LU', 'Luxemburg', 'typo'],

	// Too far, or too short for typos
	['PH', 'Phlpns', 'wrong'],
	['FR', 'Frnce', 'typo'],
	['FR', 'Frace', 'typo'],
	['CU', 'Cuab', 'wrong'],
	['PE', 'Peur', 'wrong'],
	['TG', 'Tgo', 'wrong'],
	['OM', 'Omn', 'wrong'],
	['FJ', 'Fjii', 'wrong'],
	['DE', 'Grmny', 'wrong'],

	// A typo that is as close to another country goes to the other country
	['NE', 'Nigera', 'wrong:NG'],
	['AT', 'Austrlia', 'wrong:AU'],
	['SI', 'Slovaki', 'wrong:SK'],
	['ML', 'Malaw', 'wrong:MW'],

	// Ambiguous answers: chips when the flag is one of them
	['CD', 'Congo', 'ambiguous'],
	['CG', 'Congo', 'ambiguous'],
	['KR', 'Korea', 'ambiguous'],
	['KP', 'Korea', 'ambiguous'],
	['GW', 'Guinea', 'ambiguous'],
	['GQ', 'Guinea', 'ambiguous'],
	['PG', 'Guinea', 'ambiguous'],
	['JP', 'Korea', 'wrong'],
	['GA', 'Congo', 'wrong'],

	// Not a country at all
	['JP', 'Atlantis', 'wrong'],
	['JP', 'England', 'wrong'],
	['GB', 'England', 'wrong'],
	['JP', 'asdfgh', 'wrong']
];

describe('answer matching (PROMPT.md 5)', () => {
	it('has at least 150 cases', () => {
		expect(cases.length).toBeGreaterThanOrEqual(150);
	});

	for (const [target, typed, expected] of cases) {
		it(`${target} ← "${typed}" is ${expected}`, () => {
			expect(outcome(check(typed, target, index))).toBe(expected);
		});
	}

	it('treats empty input as empty', () => {
		expect(check('   ', 'JP', index)).toEqual({ kind: 'empty' });
	});

	it('accepts names in other languages only when turned on', () => {
		expect(outcome(check('Deutschland', 'DE', index))).toBe('wrong');
		const tr = translations as Record<string, Record<string, string[]>>;
		const withGerman = buildIndex(core, aliases.ambiguous, tr.deu);
		expect(outcome(check('Deutschland', 'DE', withGerman))).toBe('right');
		expect(outcome(check('Schweiz', 'CH', withGerman))).toBe('right');
	});
});

describe('helpers', () => {
	it('normalises names', () => {
		expect(normalize("Côte d'Ivoire")).toBe('cotedivoire');
		expect(normalize('St. Lucia')).toBe('saintlucia');
		expect(normalize('Trinidad & Tobago')).toBe('trinidadandtobago');
		expect(normalize('The Gambia')).toBe('gambia');
	});

	it('computes Damerau–Levenshtein distance', () => {
		expect(distance('abc', 'abc')).toBe(0);
		expect(distance('ab', 'ba')).toBe(1);
		expect(distance('kitten', 'sitting')).toBe(3);
		expect(distance('philippines', 'phillipines')).toBe(2);
		expect(distance('abcdef', 'zzzzzz', 2)).toBe(3);
	});

	it('allows typos by length', () => {
		expect(allowance(4)).toBe(0);
		expect(allowance(5)).toBe(1);
		expect(allowance(8)).toBe(1);
		expect(allowance(9)).toBe(2);
	});
});
