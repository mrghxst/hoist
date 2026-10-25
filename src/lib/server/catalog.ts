/**
 * The full country and flag data, for pages prerendered at build time
 * (`/flags`, `/flags/[slug]`, `/lookalikes`, the OG images, the sitemap).
 * Server only: none of this reaches the browser as JavaScript.
 */
import countriesJson from '#lib/data/countries.json';
import flagsJson from '#lib/data/flags.json';
import lookalikesJson from '#lib/data/lookalikes.json';
import gameJson from '#lib/data/game.json';
import type { Country, Flag, GameData, LookalikeGroup } from '#lib/data/types.ts';

export const countries = countriesJson as unknown as Country[];
export const flags = flagsJson as unknown as Record<string, Flag>;
export const lookalikes = lookalikesJson as unknown as LookalikeGroup[];
const game = gameJson as unknown as GameData;

/** Flags most people know, in order (data/starter.json). */
export const familiar = game.familiar;

export const byId = new Map(countries.map((c) => [c.id, c]));
export const bySlug = new Map(countries.map((c) => [c.slug, c]));

/** The image the quiz shows: the WebP fallback for big SVGs, else the SVG. */
const quizFlag = new Map(game.countries.map((c) => [c.id, c.flag]));
export const flagImage = (id: string) => quizFlag.get(id) ?? flags[id]!.svg;

/** A country in a list: enough for a card with its flag. */
export interface Listed {
	id: string;
	slug: string;
	name: string;
	region: Country['region'];
	pack: Country['pack'];
	flag: string;
	ratio: number;
}

export function listed(c: Country): Listed {
	return { id: c.id, slug: c.slug, name: c.name, region: c.region, pack: c.pack, flag: flagImage(c.id), ratio: flags[c.id]!.ratio };
}

/** Countries sorted by English name (territories after the 197). */
export const sorted = [...countries].sort((a, b) => (a.pack === b.pack ? a.name.localeCompare(b.name, 'en') : a.pack === 'core' ? -1 : 1));
