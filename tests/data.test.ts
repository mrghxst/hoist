import { describe, expect, it } from 'vitest';
import countries from '../src/lib/data/countries.json' with { type: 'json' };
import flags from '../src/lib/data/flags.json' with { type: 'json' };
import type { Country, Flag } from '../src/lib/data/types.ts';

const all = countries as Country[];
const flagMap = flags as Record<string, Flag>;
const byId = (id: string) => all.find((c) => c.id === id)!;

describe('generated data', () => {
	it('has the 197 countries', () => {
		expect(all.filter((c) => c.pack === 'core')).toHaveLength(197);
	});

	it('passes the largest-city spot checks (PROMPT.md 8.3)', () => {
		const spot: Record<string, string> = {
			CN: 'Shanghai',
			IN: 'Mumbai',
			TR: 'Istanbul',
			AU: 'Sydney',
			CA: 'Toronto',
			BR: 'São Paulo',
			NG: 'Lagos',
			PK: 'Karachi',
			VN: 'Ho Chi Minh City',
			TZ: 'Dar es Salaam',
			KZ: 'Almaty',
			MA: 'Casablanca',
			CI: 'Abidjan',
			CH: 'Zürich',
			NZ: 'Auckland',
			US: 'New York City'
		};
		for (const [id, city] of Object.entries(spot)) expect(byId(id).largest.name, id).toBe(city);
	});

	it('uses the self-designations (7.4)', () => {
		expect(byId('TR').name).toBe('Türkiye');
		expect(byId('CI').name).toBe("Côte d'Ivoire");
		expect(byId('CV').name).toBe('Cabo Verde');
		expect(byId('CZ').name).toBe('Czechia');
		expect(byId('CI').names).toContain('Ivory Coast');
	});

	it('keeps true flag proportions', () => {
		expect(flagMap.NP!.ratio).toBeLessThan(1);
		expect(flagMap.QA!.ratio).toBeCloseTo(28 / 11, 2);
		expect(flagMap.CH!.ratio).toBe(1);
		expect(flagMap.VA!.ratio).toBe(1);
		expect(flagMap.GB!.ratio).toBe(2);
	});

	it("has Syria's 2025 flag", () => {
		expect(flagMap.SY!.source).toContain('2025');
	});

	it('frames France on the mainland', () => {
		const [lon, lat] = byId('FR').view.centre;
		expect(lon).toBeGreaterThan(-5);
		expect(lon).toBeLessThan(8);
		expect(lat).toBeGreaterThan(42);
		expect(lat).toBeLessThan(51);
	});

	it('never puts the answer in a flag URL', () => {
		for (const c of all) {
			expect(flagMap[c.id]!.svg).toMatch(/^\/flags\/[0-9a-f]{12}\.svg$/);
		}
	});

	it('marks split and disputed capitals with a note', () => {
		for (const id of ['IL', 'PS', 'BO', 'ZA', 'NL', 'SZ', 'MY', 'CI', 'BJ', 'ID']) {
			expect(byId(id).capital.note, id).toBeTruthy();
		}
	});
});
