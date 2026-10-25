// Shapes of the generated data in src/lib/data (written by scripts/data).

export type Continent = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania';

/** Practice regions (PROMPT.md 2.4): the Americas split three ways. */
export type Region =
	| 'europe'
	| 'africa'
	| 'asia'
	| 'north-america'
	| 'south-america'
	| 'caribbean'
	| 'oceania';

export interface City {
	name: string;
	lat: number;
	lon: number;
	pop?: number;
}

export interface Capital extends City {
	/** Short neutral note for split or disputed capitals (PROMPT.md 7.4). */
	note?: string;
	/** Other names accepted in the capitals mode. */
	alts?: string[];
}

export interface View {
	/** [longitude, latitude] the globe centres on. */
	centre: [number, number];
	zoom: number;
	/** Angular radius of the framed area, in degrees. */
	radius: number;
}

export interface Country {
	id: string;
	cca3: string;
	slug: string;
	name: string;
	official: string;
	/** Every English name accepted as right (display, official, aliases). */
	names: string[];
	continent: Continent;
	region: Region;
	subregion: string;
	pack: 'core' | 'territories';
	capital: Capital;
	largest: City;
	/** The capital is also the largest city. */
	same: boolean;
	view: View;
	/** Smaller than about 20 px on screen even at full zoom: draw a ring. */
	tiny: boolean;
	/** 1 easy, 2 medium, 3 hard (estimated, see docs/decisions.md). */
	difficulty: 1 | 2 | 3;
	/** Neutral note about the flag itself, shown on the flag page. */
	flagNote?: string;
	/** Dominant flag colours, for interleaving the queue by colour. */
	colours: string[];
}

export interface Flag {
	/** Hashed file name under /flags/, so the URL does not leak the answer. */
	svg: string;
	/** 960 px WebP for flags whose SVG is over the size budget. */
	webp?: string;
	/** Width / height from the viewBox. */
	ratio: number;
	bytes: number;
	licence: string;
	author: string;
	source: string;
	revised: string;
	sha1: string;
}

export interface LookalikeGroup {
	id: string;
	members: string[];
	tip: string;
}
