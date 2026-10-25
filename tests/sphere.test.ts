import { describe, expect, it } from 'vitest';
import { geoOrthographic } from 'd3-geo';
import { frameOf, project, shapeOf, trace } from '../src/lib/globe/sphere.ts';

describe('sphere renderer', () => {
	it('matches d3 orthographic, including roll', () => {
		for (const [lon, lat, roll] of [
			[0, 0, 0],
			[139, 36, 0],
			[-50, -10, 25],
			[12, 41, -70]
		] as const) {
			const d3 = geoOrthographic().rotate([-lon, -lat, roll]).scale(300).translate([400, 300]);
			const f = frameOf(lon, lat, roll, 300, 400, 300);
			for (const p of [
				[lon + 10, lat + 5],
				[lon - 30, lat - 20],
				[lon + 60, lat + 10]
			] as [number, number][]) {
				const a = d3(p)!;
				const b = project(f, p[0], p[1], -1)!;
				expect(b[0]).toBeCloseTo(a[0], 6);
				expect(b[1]).toBeCloseTo(a[1], 6);
			}
		}
	});

	it('far side lands where the reflected projection puts it (4.3)', () => {
		const [lon, lat, roll] = [20, 30, 0];
		const back = geoOrthographic()
			.rotate([-lon + 180, lat, -roll])
			.reflectX(true)
			.scale(300)
			.translate([400, 300]);
		const f = frameOf(lon, lat, roll, 300, 400, 300);
		const p: [number, number] = [-150, -20];
		const a = back(p)!;
		const b = project(f, p[0], p[1], -2)!;
		expect(b[0]).toBeCloseTo(a[0], 6);
		expect(b[1]).toBeCloseTo(a[1], 6);
	});

	it('closes clipped rings along the rim', () => {
		const calls: string[] = [];
		const ctx = {
			moveTo: () => calls.push('M'),
			lineTo: () => calls.push('L'),
			arc: () => calls.push('A'),
			closePath: () => calls.push('Z')
		} as unknown as CanvasRenderingContext2D;
		// A band that straddles the horizon when looking at 0,0.
		const ring: [number, number][] = [];
		for (let lon = 60; lon <= 120; lon += 5) ring.push([lon, -10]);
		for (let lon = 120; lon >= 60; lon -= 5) ring.push([lon, 10]);
		ring.push(ring[0]!);
		trace(ctx, shapeOf([{ type: 'Polygon', coordinates: [ring] }]), frameOf(0, 0, 0, 100, 0, 0));
		expect(calls[0]).toBe('M');
		expect(calls).toContain('A');
		expect(calls[calls.length - 1]).toBe('Z');
	});
});
