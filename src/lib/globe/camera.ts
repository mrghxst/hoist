/**
 * Camera maths for the globe (PROMPT.md 4.2). Pure functions, no DOM.
 *
 * A view is the point at the centre of the disc plus a zoom. The projection
 * rotation is [-lon, -lat, roll]; drags can add roll, flights remove it.
 */
import { geoDistance, geoInterpolate } from 'd3-geo';

export interface Camera {
	lon: number;
	lat: number;
	roll: number;
	zoom: number;
}

export const ZOOM_MIN = 0.9;
export const ZOOM_MAX = 4;

export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

export function cubicInOut(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** 700 ms for neighbours up to 1,400 ms across the world. */
export function flightDuration(from: Camera, to: { lon: number; lat: number }): number {
	const d = geoDistance([from.lon, from.lat], [to.lon, to.lat]);
	return Math.round(700 + 700 * Math.min(1, d / Math.PI));
}

/** Wraps an angle in degrees into (-180, 180]. */
export function wrap(deg: number): number {
	const x = ((((deg + 180) % 360) + 360) % 360) - 180;
	return x === -180 ? 180 : x;
}

/**
 * A flight from one camera to another: the centre follows the great circle,
 * and on long flights the zoom dips out in the middle so the player sees
 * where on the planet the country is.
 */
export function flightPath(from: Camera, to: Camera): (t: number) => Camera {
	const centre = geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);
	const d = geoDistance([from.lon, from.lat], [to.lon, to.lat]);
	// 0 for neighbours, 1 for a quarter of the planet or more.
	const dip = Math.min(1, d / (Math.PI / 2));
	const rollDelta = wrap(to.roll - from.roll);
	return (t: number) => {
		const e = cubicInOut(Math.min(1, Math.max(0, t)));
		const [lon, lat] = centre(e);
		const base = from.zoom + (to.zoom - from.zoom) * e;
		// Halfway, pull out toward the whole globe (zoom 1), never zoom in.
		const mid = Math.min(base, base + (1 - base) * dip);
		const zoom = Math.max(ZOOM_MIN, base + (mid - base) * Math.sin(Math.PI * e));
		return { lon, lat, roll: from.roll + rollDelta * e, zoom };
	};
}

/** Smooth step between edges, for cross-fades by zoom. */
export function smoothstep(a: number, b: number, x: number): number {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
}
