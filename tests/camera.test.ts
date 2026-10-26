import { describe, expect, it } from 'vitest';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import { readFileSync } from 'node:fs';
import type { FeatureCollection } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { clampZoom, cubicInOut, flightDuration, flightPath, focusZoom, SOLID_ZOOM, wrap } from '../src/lib/globe/camera.ts';
import { decodeDots } from '../src/lib/globe/data.ts';
import countries from '../src/lib/data/countries.json' with { type: 'json' };
import type { Country } from '../src/lib/data/types.ts';

describe('camera', () => {
	it('eases in and out', () => {
		expect(cubicInOut(0)).toBe(0);
		expect(cubicInOut(1)).toBe(1);
		expect(cubicInOut(0.5)).toBeCloseTo(0.5);
	});

	it('takes 700 ms for neighbours and 1,400 ms across the world', () => {
		expect(flightDuration({ lon: 0, lat: 0, roll: 0, zoom: 1 }, { lon: 0, lat: 0 })).toBe(700);
		expect(flightDuration({ lon: 0, lat: 0, roll: 0, zoom: 1 }, { lon: 180, lat: 0 })).toBe(1400);
	});

	it('flies along the great circle and lands exactly', () => {
		const path = flightPath({ lon: 139, lat: 36, roll: 10, zoom: 2.5 }, { lon: -50, lat: -10, roll: 0, zoom: 1.5 });
		const end = path(1);
		expect(end.lon).toBeCloseTo(-50);
		expect(end.lat).toBeCloseTo(-10);
		expect(end.roll).toBeCloseTo(0);
		expect(end.zoom).toBeCloseTo(1.5);
	});

	it('pulls out in the middle of long flights only', () => {
		const long = flightPath({ lon: 139, lat: 36, roll: 0, zoom: 3 }, { lon: -50, lat: -10, roll: 0, zoom: 3 });
		expect(long(0.5).zoom).toBeLessThan(1.5);
		const short = flightPath({ lon: 6, lat: 46, roll: 0, zoom: 3 }, { lon: 8, lat: 47, roll: 0, zoom: 3 });
		expect(short(0.5).zoom).toBeGreaterThan(2.9);
	});

	it('clamps zoom and wraps longitude', () => {
		expect(clampZoom(10)).toBe(4);
		expect(clampZoom(0.1)).toBe(0.9);
		expect(wrap(190)).toBe(-170);
		expect(wrap(-190)).toBe(170);
		expect(wrap(180)).toBe(180);
	});

	it('a country in focus is never shown as dots: at least the solid-land zoom', () => {
		expect(focusZoom(0.9)).toBe(SOLID_ZOOM); // Russia
		expect(focusZoom(1.99)).toBe(SOLID_ZOOM); // DR Congo
		expect(focusZoom(3.5)).toBe(3.5);
		expect(focusZoom(9)).toBe(4);
	});
});

describe('geometry helpers', () => {
	it('decodes land dots as unit vectors', () => {
		const raw = new Int16Array([0, 0, 9000, 0, 0, 9000]);
		const d = decodeDots(raw.buffer);
		expect(d.lons[1]).toBe(90);
		expect(d.xs[0]).toBeCloseTo(1);
		expect(d.ys[1]).toBeCloseTo(1);
		expect(d.zs[2]).toBeCloseTo(1);
	});

	it('puts every view centre inside its country', () => {
		const topo = JSON.parse(readFileSync('static/geo/detail.topo.json', 'utf8')) as Topology;
		const fc = feature(topo, topo.objects.countries as GeometryCollection) as FeatureCollection;
		for (const c of countries as Country[]) {
			const f = fc.features.find((x) => x.id === c.id);
			expect(f, c.id).toBeTruthy();
			expect(geoContains(f!, c.view.centre), c.id).toBe(true);
		}
	});
});
