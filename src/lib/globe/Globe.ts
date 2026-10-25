/**
 * The glass globe (PROMPT.md 4). Canvas 2D and d3-geo, one camera, drawn
 * only when something changes. Page components talk to it through the small
 * API at the bottom of the class; no globe code lives in pages.
 */
import { geoOrthographic, type GeoProjection } from 'd3-geo';
import type { Feature, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import versor from 'versor';
import { clampZoom, flightDuration, flightPath, smoothstep, wrap, ZOOM_MAX, ZOOM_MIN, type Camera } from './camera.ts';
import type { GlobeData } from './data.ts';
import { readPalette, type Palette } from './palette.ts';
import { frameOf, graticuleShape, project, shapeOf, trace, type Frame, type Shape } from './sphere.ts';

export interface Place {
	name: string;
	lat: number;
	lon: number;
}

export interface Markers {
	capital: Place;
	/** Omitted when the capital is also the largest city. */
	largest?: Place;
}

export interface Target {
	id: string;
	centre: [number, number];
	zoom: number;
}

export interface GlobeOptions {
	/** Turn slowly before the first answer; stops on interaction (2.1). */
	autoRotate?: boolean;
	interactive?: boolean;
	/** Fixed starting view, for stable screenshots. */
	view?: { lon: number; lat: number; zoom?: number };
	onViewChange?: (camera: Camera) => void;
	onInteract?: () => void;
	/** Element that receives arrow and +/− keys (defaults to the canvas). */
	keyTarget?: HTMLElement;
}

type Mastery = Map<string, 0 | 1 | 2 | 3>;

const DPR_CAP = 2;
const AUTO_SPEED = 3 / 1000; // degrees per ms
/**
 * Idle rotation is decoration: if a frame takes longer than this even at its
 * quickest (a slow phone, or Chrome without a GPU, which uploads the canvas
 * on the main thread), the globe stays still until the player moves it, so
 * the page stays responsive and the device cool (PROMPT.md 4.2, 10).
 *
 * A frame's cost is the drawing plus the rendering Chrome does after it
 * (paint and commit): a message posted at the end of the frame callback only
 * runs once that is done. With a GPU that part is about 0.2 ms; without one
 * it is about 11 ms for a phone-sized canvas.
 */
const IDLE_FRAME_BUDGET = 12;
const IDLE_SAMPLES = 3;
const IDLE_RESUME = 8000;
const PULSE_MS = 1100;
const PULSES = 2;
const RING_PX = 14;
const TINY_PX = 20;

const reducedMotion = () =>
	typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Globe {
	readonly canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private data: GlobeData | null = null;
	private palette: Palette;
	private opts: GlobeOptions;

	private cam: Camera = { lon: 10, lat: 20, roll: 0, zoom: 1 };
	private width = 0;
	private height = 0;
	private dpr = 1;
	/** Radius of the globe at zoom 1, in CSS px. */
	private baseRadius = 100;
	/** Vertical offset of the globe centre, so content can sit below it. */
	private offsetY = 0;

	// No adaptive resampling: the geometry's segments are already short, and
	// resampling was the largest cost per frame.
	// d3 is only used to invert pointer positions for dragging.
	private front: GeoProjection = geoOrthographic().clipAngle(90).precision(0);
	private fr: Frame = frameOf(0, 0, 0, 1, 0, 0);
	private graticule = graticuleShape();
	private shapes = new Map<string, Shape>();
	private detailShapes = new Map<string, Shape>();

	private target: Target | null = null;
	private markers: Markers | null = null;
	private markersAt = 0;
	private mastery: Mastery | null = null;

	private flight: { start: number; duration: number; path: (t: number) => Camera; resolve: () => void } | null = null;
	private fade: { start: number; image: HTMLCanvasElement } | null = null;
	private inertia: { vLon: number; vLat: number; last: number } | null = null;
	private autoRotate: boolean;
	private lastInteraction = -Infinity;
	private idleTimer: ReturnType<typeof setTimeout> | 0 = 0;
	private frame = 0;
	private lastFrame = 0;
	private destroyed = false;
	private frameTimes: number[] = [];
	private idleFrames: number[] = [];
	private idleTooSlow = false;
	private frameProbe: MessageChannel | null = null;
	/** Per-layer timings when profiling (dev tool). */
	profile: Record<string, number> | null = null;
	private mark(name: string, t: number): number {
		const now = performance.now();
		if (this.profile) this.profile[name] = (this.profile[name] ?? 0) + now - t;
		return now;
	}

	private pointers = new Map<number, { x: number; y: number }>();
	private drag: {
		v0: [number, number, number, number];
		r0: [number, number, number];
		p0: [number, number, number];
		samples: { t: number; lon: number; lat: number }[];
	} | null = null;
	private pinch: { d0: number; z0: number } | null = null;
	private cleanup: (() => void)[] = [];

	constructor(canvas: HTMLCanvasElement, opts: GlobeOptions = {}) {
		this.canvas = canvas;
		const ctx = canvas.getContext('2d', { alpha: true });
		if (!ctx) throw new Error('Canvas 2D is not available');
		this.ctx = ctx;
		this.opts = opts;
		this.autoRotate = !!opts.autoRotate && !reducedMotion();
		if (opts.view) this.cam = { lon: opts.view.lon, lat: opts.view.lat, roll: 0, zoom: opts.view.zoom ?? 1 };
		this.palette = readPalette();
		if (opts.interactive !== false) this.bindInput();
		this.resize();
	}

	// ---------------------------------------------------------------- API

	setData(data: GlobeData) {
		this.data = data;
		this.shapes.clear();
		this.invalidate();
	}

	/** Swap in finer shapes for the target and borders when zoomed in. */
	setDetail(detail: GlobeData['countries']) {
		if (!this.data) return;
		this.data = { ...this.data, detail };
		this.detailShapes.clear();
		this.invalidate();
	}

	get camera(): Camera {
		return { ...this.cam };
	}

	get targetId(): string | null {
		return this.target?.id ?? null;
	}

	/**
	 * Fly to a country. A new flight cancels the one in progress and starts
	 * from wherever the camera is now (4.2).
	 */
	flyTo(target: Target): Promise<void> {
		this.target = target;
		this.autoRotate = false;
		this.inertia = null;
		const to: Camera = { lon: target.centre[0], lat: target.centre[1], roll: 0, zoom: clampZoom(target.zoom) };
		this.flight?.resolve();
		this.flight = null;
		if (reducedMotion()) return this.jump(to);
		return new Promise((resolve) => {
			this.flight = {
				start: performance.now(),
				duration: flightDuration(this.cam, to),
				path: flightPath(this.cam, to),
				resolve
			};
			this.invalidate();
		});
	}

	/** Show the target without moving (used when a view is restored). */
	setTarget(target: Target | null) {
		this.target = target;
		this.invalidate();
	}

	showMarkers(markers: Markers | null) {
		this.markers = markers;
		this.markersAt = performance.now();
		this.invalidate();
	}

	setMastery(map: Mastery | null) {
		this.mastery = map;
		this.invalidate();
	}

	setAutoRotate(on: boolean) {
		this.autoRotate = on && !reducedMotion();
		this.invalidate();
	}

	/** Re-read the colours from CSS after a theme change. */
	setTheme() {
		this.palette = readPalette();
		this.invalidate();
	}

	/** Set the layout: size from the element, and an optional centre offset. */
	resize(offsetY = this.offsetY) {
		const rect = this.canvas.getBoundingClientRect();
		this.width = Math.max(1, rect.width);
		this.height = Math.max(1, rect.height);
		this.offsetY = offsetY;
		this.dpr = Math.min(DPR_CAP, globalThis.devicePixelRatio || 1);
		this.canvas.width = Math.round(this.width * this.dpr);
		this.canvas.height = Math.round(this.height * this.dpr);
		// At zoom 2.5 the globe just fits, so its edge stays in view (4.2).
		this.baseRadius = (Math.min(this.width, this.height) / 2) * 0.4;
		this.invalidate();
	}

	zoomBy(factor: number) {
		this.stopMotion();
		this.animateZoom(clampZoom(this.cam.zoom * factor));
	}

	rotateBy(dLon: number, dLat: number) {
		this.stopMotion();
		this.cam.lon = wrap(this.cam.lon + dLon);
		this.cam.lat = Math.max(-89, Math.min(89, this.cam.lat + dLat));
		this.changed();
	}

	/** Frame durations of recent frames, in ms (for the performance test). */
	takeFrameTimes(): number[] {
		const t = this.frameTimes;
		this.frameTimes = [];
		return t;
	}

	destroy() {
		this.destroyed = true;
		cancelAnimationFrame(this.frame);
		this.frameProbe?.port1.close();
		if (this.idleTimer) clearTimeout(this.idleTimer);
		for (const off of this.cleanup) off();
		this.flight?.resolve();
	}

	// ---------------------------------------------------------- animation

	private invalidate() {
		if (this.destroyed || this.frame) return;
		this.frame = requestAnimationFrame((t) => {
			this.frame = 0;
			this.tick(t);
		});
	}

	private tick(now: number) {
		const dt = this.lastFrame ? Math.min(64, now - this.lastFrame) : 16;
		this.lastFrame = now;
		let moving = false;
		let idle = false;

		if (this.flight) {
			const t = (now - this.flight.start) / this.flight.duration;
			this.cam = this.flight.path(Math.min(1, t));
			if (t >= 1) {
				this.flight.resolve();
				this.flight = null;
			} else moving = true;
			this.opts.onViewChange?.(this.camera);
		} else if (this.inertia) {
			const decay = Math.exp(-dt / 320);
			this.inertia.vLon *= decay;
			this.inertia.vLat *= decay;
			this.cam.lon = wrap(this.cam.lon + this.inertia.vLon * dt);
			this.cam.lat = Math.max(-89, Math.min(89, this.cam.lat + this.inertia.vLat * dt));
			if (Math.hypot(this.inertia.vLon, this.inertia.vLat) < 0.002) this.inertia = null;
			else moving = true;
		} else if (this.autoRotate && !this.idleTooSlow && !this.drag) {
			if (now - this.lastInteraction > IDLE_RESUME) {
				this.cam.lon = wrap(this.cam.lon + AUTO_SPEED * dt);
				moving = true;
				idle = true;
			} else if (!this.idleTimer) {
				// Wake up again when the idle time is over.
				this.idleTimer = setTimeout(() => {
					this.idleTimer = 0;
					this.invalidate();
				}, IDLE_RESUME - (now - this.lastInteraction) + 16);
			}
		}

		const t0 = performance.now();
		this.draw(now);
		const spent = performance.now() - t0;
		if (moving || this.drag) this.frameTimes.push(spent);
		if (idle && this.data && this.idleFrames.length < IDLE_SAMPLES) this.measureFrame(spent);
		if (this.frameTimes.length > 600) this.frameTimes.splice(0, 300);

		const pulsing = !!this.markers && !reducedMotion() && now - this.markersAt < PULSE_MS * PULSES;
		if (moving || pulsing || this.fade) this.invalidate();
		else this.lastFrame = 0;
	}

	/** Adds the rendering after this frame to its drawing time (see IDLE_FRAME_BUDGET). */
	private measureFrame(drawing: number) {
		if (typeof MessageChannel === 'undefined') return;
		if (!this.frameProbe) {
			this.frameProbe = new MessageChannel();
			this.frameProbe.port1.onmessage = (e: MessageEvent<[number, number]>) => {
				const [draw, end] = e.data;
				this.idleFrames.push(draw + performance.now() - end);
				if (this.idleFrames.length === IDLE_SAMPLES && Math.min(...this.idleFrames) > IDLE_FRAME_BUDGET) {
					this.idleTooSlow = true;
				}
			};
		}
		this.frameProbe.port2.postMessage([drawing, performance.now()]);
	}

	private jump(to: Camera): Promise<void> {
		// Reduced motion: a 150 ms cross-fade to the final view.
		const snap = document.createElement('canvas');
		snap.width = this.canvas.width;
		snap.height = this.canvas.height;
		snap.getContext('2d')?.drawImage(this.canvas, 0, 0);
		this.fade = { start: performance.now(), image: snap };
		this.cam = to;
		this.invalidate();
		return new Promise((r) => setTimeout(r, 150));
	}

	private animateZoom(z: number) {
		const to = { ...this.cam, zoom: z };
		if (reducedMotion()) {
			this.cam = to;
			this.changed();
			return;
		}
		this.flight = {
			start: performance.now(),
			duration: 220,
			path: (t) => ({ ...this.cam, zoom: this.cam.zoom + (z - this.cam.zoom) * Math.min(1, t * 1.6) }),
			resolve: () => {}
		};
		this.invalidate();
	}

	private stopMotion() {
		this.flight?.resolve();
		this.flight = null;
		this.inertia = null;
		this.autoRotate = this.opts.autoRotate === true && !reducedMotion() && this.autoRotate;
		this.lastInteraction = performance.now();
		this.opts.onInteract?.();
	}

	private changed() {
		this.opts.onViewChange?.(this.camera);
		this.invalidate();
	}

	// ------------------------------------------------------------ drawing

	private get radius() {
		return this.baseRadius * this.cam.zoom;
	}

	private get cx() {
		return this.width / 2;
	}

	private get cy() {
		return this.height / 2 + this.offsetY;
	}

	private setupProjections() {
		const { lon, lat, roll } = this.cam;
		const r = this.radius;
		this.front.rotate([-lon, -lat, roll]).scale(r).translate([this.cx, this.cy]);
		this.fr = frameOf(lon, lat, roll, r, this.cx, this.cy);
	}

	private draw(now: number) {
		const ctx = this.ctx;
		const p = this.palette;
		const { width: w, height: h, dpr } = this;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		this.setupProjections();

		const r = this.radius;
		const cx = this.cx;
		const cy = this.cy;
		const z = this.cam.zoom;
		const solid = smoothstep(1.6, 2.2, z); // dots → solid land
		const farSide = 1 - smoothstep(1.3, 2, z); // far side fades by zoom 2
		const data = this.data;
		const countries = data?.countries;

		let t = performance.now();
		// Halo: from 1.0 to 1.08 times the radius.
		const halo = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.08);
		halo.addColorStop(0, p.halo);
		halo.addColorStop(1, p.transparent);
		ctx.fillStyle = halo;
		ctx.beginPath();
		ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
		ctx.fill();

		// Body: a soft radial gradient lit from the upper left.
		const body = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r);
		body.addColorStop(0, p.bodyLight);
		body.addColorStop(0.55, p.bodyMid);
		body.addColorStop(1, p.bodyEdge);
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();

		if (data && countries) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.clip();

			t = this.mark('body', t);
			// Far side, seen through the glass.
			if (farSide > 0.01) {
				ctx.globalAlpha = farSide;
				ctx.fillStyle = p.farLand;
				ctx.beginPath();
				const movingFar = !!(this.flight || this.drag || this.inertia);
				trace(ctx, movingFar ? data.shapes.farLandFast : data.shapes.farLand, this.fr, -1);
				ctx.fill('evenodd');
				const ts = this.target && this.shapeFor(this.target.id);
				if (ts) {
					ctx.fillStyle = p.farTarget;
					ctx.beginPath();
					trace(ctx, ts, this.fr, -1);
					ctx.fill('evenodd');
				}
				ctx.globalAlpha = 1;
			}

			t = this.mark('far', t);
			// Graticule.
			ctx.strokeStyle = p.graticule;
			ctx.lineWidth = 0.5;
			ctx.beginPath();
			trace(ctx, this.graticule, this.fr);
			ctx.stroke();

			t = this.mark('graticule', t);
			// Land: dots, cross-fading to solid land with hairline borders.
			if (solid < 0.99) this.drawDots(1 - solid);
			t = this.mark('dots', t);
			if (solid > 0.01) {
				ctx.globalAlpha = solid;
				ctx.fillStyle = p.land;
				ctx.beginPath();
				const moving = !!(this.flight || this.drag || this.inertia);
				trace(ctx, moving ? data.shapes.landFast : data.shapes.land, this.fr);
				ctx.fill('evenodd');
				ctx.strokeStyle = p.border;
				ctx.lineWidth = 0.5;
				ctx.beginPath();
				trace(ctx, moving ? data.shapes.bordersFast : data.shapes.borders, this.fr);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}

			if (this.mastery) this.drawMastery(this.mastery);

			t = this.mark('land', t);
			// Target country.
			if (this.target) {
				const ts = this.shapeFor(this.target.id, z > 1.8 && !this.flight);
				if (ts) {
					ctx.fillStyle = p.targetFill;
					ctx.beginPath();
					trace(ctx, ts, this.fr);
					ctx.fill('evenodd');
					ctx.strokeStyle = p.accent;
					ctx.lineWidth = 1.25;
					ctx.lineJoin = 'round';
					ctx.stroke();
				}
			}
			ctx.restore();

			t = this.mark('target', t);
			if (this.target) this.drawTinyRing(this.target);
			if (this.markers) this.drawMarkers(this.markers, now);
		}

		t = this.mark('markers', t);
		// Rim light.
		ctx.strokeStyle = p.rim;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
		ctx.stroke();

		if (this.fade) {
			const a = 1 - (now - this.fade.start) / 150;
			if (a <= 0) this.fade = null;
			else {
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.globalAlpha = a;
				ctx.drawImage(this.fade.image, 0, 0);
				ctx.globalAlpha = 1;
			}
		}
	}

	private drawDots(alpha: number) {
		const data = this.data;
		if (!data) return;
		const ctx = this.ctx;
		const { xs, ys, zs } = data.dots;
		const n = xs.length;
		// Same maths as sphere.ts, inlined for the hot loop.
		const { vx, vy, vz, ex, ey, ux, uy, uz, cg, sg, r, cx, cy } = this.fr;
		const size = Math.max(1.1, Math.min(2.4, r / 190));
		const half = size / 2;
		// Bucket by facing, so dots fade toward the edge of the disc with only a
		// few fill changes, and fill each bucket as one path.
		const BUCKETS = 6;
		const paths: Path2D[] = Array.from({ length: BUCKETS }, () => new Path2D());
		const used = new Uint8Array(BUCKETS);
		const w = this.width;
		const h = this.height;
		for (let i = 0; i < n; i++) {
			const px = xs[i]!;
			const py = ys[i]!;
			const pz = zs[i]!;
			const d = px * vx + py * vy + pz * vz;
			if (d <= 0.02) continue;
			const a = px * ex + py * ey;
			const b = px * ux + py * uy + pz * uz;
			const sx = cx + r * (a * cg - b * sg) - half;
			const sy = cy - r * (a * sg + b * cg) - half;
			if (sx < -2 || sy < -2 || sx > w || sy > h) continue;
			const k = d >= 1 ? BUCKETS - 1 : (d * BUCKETS) | 0;
			paths[k]!.rect(sx, sy, size, size);
			used[k] = 1;
		}
		ctx.fillStyle = this.palette.dot;
		for (let k = 0; k < BUCKETS; k++) {
			if (!used[k]) continue;
			const facing = (k + 0.5) / BUCKETS;
			ctx.globalAlpha = alpha * (0.18 + 0.82 * facing ** 1.4);
			ctx.fill(paths[k]!);
		}
		ctx.globalAlpha = 1;
	}

	private drawMastery(map: Mastery) {
		const countries = this.data?.countries;
		if (!countries) return;
		const ctx = this.ctx;
		const p = this.palette;
		for (const [id, level] of map) {
			if (!level) continue;
			const shape = this.shapeFor(id);
			if (!shape) continue;
			ctx.fillStyle = level === 3 ? p.mastered : level === 2 ? p.learning2 : p.learning1;
			ctx.beginPath();
			trace(ctx, shape, this.fr);
			ctx.fill('evenodd');
		}
	}

	private visible(lon: number, lat: number): [number, number] | null {
		return project(this.fr, lon, lat, 0.05);
	}

	/** A country's shape as unit vectors, cached; detail when asked and loaded. */
	private shapeFor(id: string, detail = false): Shape | undefined {
		const data = this.data;
		if (!data) return undefined;
		if (detail && data.detail) {
			let s = this.detailShapes.get(id);
			const f = data.detail.get(id);
			if (!s && f) this.detailShapes.set(id, (s = shapeOf([f])));
			if (s) return s;
		}
		let s = this.shapes.get(id);
		const f = data.countries.get(id);
		if (!s && f) this.shapes.set(id, (s = shapeOf([f])));
		return s;
	}

	/** Largest on-screen extent of the visible part of a shape, in px. */
	private extent(shape: Shape): number {
		const { xyz } = shape;
		const { vx, vy, vz, ex, ey, ux, uy, uz, r } = this.fr;
		let x0 = Infinity;
		let x1 = -Infinity;
		let y0 = Infinity;
		let y1 = -Infinity;
		for (let o = 0; o < xyz.length; o += 3) {
			const px = xyz[o]!;
			const py = xyz[o + 1]!;
			const pz = xyz[o + 2]!;
			if (px * vx + py * vy + pz * vz <= 0) continue;
			const a = px * ex + py * ey;
			const b = px * ux + py * uy + pz * uz;
			x0 = Math.min(x0, a);
			x1 = Math.max(x1, a);
			y0 = Math.min(y0, b);
			y1 = Math.max(y1, b);
		}
		return x1 < x0 ? 0 : r * Math.max(x1 - x0, y1 - y0);
	}

	private drawTinyRing(target: Target) {
		const shape = this.shapeFor(target.id);
		if (!shape) return;
		if (this.extent(shape) >= TINY_PX) return;
		const pt = this.visible(target.centre[0], target.centre[1]);
		if (!pt) return;
		const ctx = this.ctx;
		ctx.strokeStyle = this.palette.accent;
		ctx.lineWidth = 1.25;
		ctx.beginPath();
		ctx.arc(pt[0], pt[1], RING_PX, 0, Math.PI * 2);
		ctx.stroke();
	}

	private drawMarkers(m: Markers, now: number) {
		const ctx = this.ctx;
		const p = this.palette;
		const cap = this.visible(m.capital.lon, m.capital.lat);
		const big = m.largest ? this.visible(m.largest.lon, m.largest.lat) : null;

		// Largest city: small hollow dot.
		if (big) {
			ctx.strokeStyle = p.fg;
			ctx.fillStyle = p.bg;
			ctx.lineWidth = 1.25;
			ctx.beginPath();
			ctx.arc(big[0], big[1], 2.5, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		// Capital: solid dot with a ring in the background colour and two pulses.
		if (cap) {
			const age = now - this.markersAt;
			if (!reducedMotion() && age < PULSE_MS * PULSES) {
				const t = (age % PULSE_MS) / PULSE_MS;
				ctx.strokeStyle = p.accent;
				ctx.globalAlpha = (1 - t) * 0.8;
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.arc(cap[0], cap[1], 4 + t * 16, 0, Math.PI * 2);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			ctx.fillStyle = p.bg;
			ctx.beginPath();
			ctx.arc(cap[0], cap[1], 6, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = p.fg;
			ctx.beginPath();
			ctx.arc(cap[0], cap[1], 4, 0, Math.PI * 2);
			ctx.fill();
		}

		// Labels, on opposite sides when the two would collide.
		ctx.font = `500 12px ${p.font}`;
		ctx.textBaseline = 'middle';
		ctx.lineJoin = 'round';
		const capText = m.largest ? `★ ${m.capital.name}` : `★ ${m.capital.name} · capital and largest city`;
		let capSide: 1 | -1 = 1;
		let bigSide: 1 | -1 = 1;
		if (cap && big) {
			const close = Math.hypot(cap[0] - big[0], cap[1] - big[1]) < 24 + 60;
			if (close) {
				capSide = cap[0] <= big[0] ? -1 : 1;
				bigSide = -capSide as 1 | -1;
			}
		}
		if (cap) {
			// On narrow screens the long form breaks onto a second, quieter line.
			const fits = this.fits(capText, cap, 10);
			if (fits || m.largest) this.label(capText, cap, capSide, p.fg, 10);
			else {
				this.label(`★ ${m.capital.name}`, cap, capSide, p.fg, 10, -7);
				ctx.font = `400 11px ${p.font}`;
				this.label('capital and largest city', cap, capSide, p.muted, 10, 7);
				ctx.font = `500 12px ${p.font}`;
			}
		}
		if (big && m.largest) this.label(m.largest.name, big, bigSide, p.muted, 8);
	}

	private fits(text: string, at: [number, number], gap: number): boolean {
		const w = this.ctx.measureText(text).width;
		return at[0] + gap + w <= this.width - 8 || at[0] - gap - w >= 8;
	}

	private label(text: string, at: [number, number], side: 1 | -1, colour: string, gap: number, dy = 0) {
		const ctx = this.ctx;
		const w = ctx.measureText(text).width;
		// Keep labels on screen: flip when they would run off the edge.
		let s = side;
		if (s === 1 && at[0] + gap + w > this.width - 8) s = -1;
		if (s === -1 && at[0] - gap - w < 8) s = 1;
		const x = s === 1 ? at[0] + gap : at[0] - gap - w;
		ctx.lineWidth = 3;
		ctx.strokeStyle = this.palette.bg;
		ctx.strokeText(text, x, at[1] + dy);
		ctx.fillStyle = colour;
		ctx.fillText(text, x, at[1] + dy);
	}

	// -------------------------------------------------------------- input

	private bindInput() {
		const c = this.canvas;
		const on = <K extends keyof HTMLElementEventMap>(
			type: K,
			fn: (e: HTMLElementEventMap[K]) => void,
			opts?: AddEventListenerOptions
		) => {
			c.addEventListener(type, fn, opts);
			this.cleanup.push(() => c.removeEventListener(type, fn, opts));
		};

		on('pointerdown', (e) => {
			c.setPointerCapture(e.pointerId);
			this.pointers.set(e.pointerId, this.local(e));
			this.stopMotion();
			if (this.pointers.size === 1) this.startDrag(this.local(e));
			else if (this.pointers.size === 2) {
				this.drag = null;
				const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
				this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: this.cam.zoom };
			}
		});
		on('pointermove', (e) => {
			if (!this.pointers.has(e.pointerId)) return;
			this.pointers.set(e.pointerId, this.local(e));
			if (this.pinch && this.pointers.size >= 2) {
				const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
				const d = Math.hypot(a.x - b.x, a.y - b.y);
				this.zoomAt(clampZoom((this.pinch.z0 * d) / this.pinch.d0), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
			} else if (this.drag) this.moveDrag(this.local(e));
		});
		const end = (e: PointerEvent) => {
			this.pointers.delete(e.pointerId);
			if (this.pointers.size < 2) this.pinch = null;
			if (this.pointers.size === 0 && this.drag) this.endDrag();
			this.lastInteraction = performance.now();
		};
		on('pointerup', end);
		on('pointercancel', end);
		on(
			'wheel',
			(e) => {
				e.preventDefault();
				this.stopMotion();
				const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
				this.zoomAt(clampZoom(this.cam.zoom * k), this.local(e));
			},
			{ passive: false }
		);
		on('dblclick', (e) => {
			this.stopMotion();
			this.zoomAt(clampZoom(this.cam.zoom * 1.6), this.local(e));
		});
		const keyTarget = this.opts.keyTarget ?? c;
		const onKey = (e: KeyboardEvent) => {
			const step = 10 / this.cam.zoom;
			const keys: Record<string, () => void> = {
				ArrowLeft: () => this.rotateBy(-step, 0),
				ArrowRight: () => this.rotateBy(step, 0),
				ArrowUp: () => this.rotateBy(0, step),
				ArrowDown: () => this.rotateBy(0, -step),
				'+': () => this.zoomBy(1.4),
				'=': () => this.zoomBy(1.4),
				'-': () => this.zoomBy(1 / 1.4)
			};
			const fn = keys[e.key];
			if (fn) {
				e.preventDefault();
				fn();
			}
		};
		keyTarget.addEventListener('keydown', onKey);
		this.cleanup.push(() => keyTarget.removeEventListener('keydown', onKey));
	}

	private local(e: { clientX: number; clientY: number }) {
		const r = this.canvas.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	private startDrag(pt: { x: number; y: number }) {
		this.setupProjections();
		const geo = this.front.invert?.([pt.x, pt.y]);
		if (!geo || !Number.isFinite(geo[0])) return;
		const r0 = this.front.rotate() as [number, number, number];
		this.drag = {
			r0,
			v0: versor(r0),
			p0: versor.cartesian(geo),
			samples: [{ t: performance.now(), lon: this.cam.lon, lat: this.cam.lat }]
		};
	}

	private moveDrag(pt: { x: number; y: number }) {
		const d = this.drag;
		if (!d) return;
		// Standard versor drag: the point grabbed stays under the pointer.
		const geo = this.front.rotate(d.r0).invert?.([pt.x, pt.y]);
		if (!geo || !Number.isFinite(geo[0])) return;
		const q = versor.multiply(d.v0, versor.delta(d.p0, versor.cartesian(geo)));
		const [l, ph, g] = versor.rotation(q);
		this.cam.lon = wrap(-l);
		this.cam.lat = Math.max(-89, Math.min(89, -ph));
		this.cam.roll = g;
		const now = performance.now();
		d.samples.push({ t: now, lon: this.cam.lon, lat: this.cam.lat });
		while (d.samples.length > 2 && now - d.samples[0]!.t > 80) d.samples.shift();
		this.changed();
	}

	private endDrag() {
		const d = this.drag;
		this.drag = null;
		if (!d || reducedMotion()) return;
		const a = d.samples[0]!;
		const b = d.samples[d.samples.length - 1]!;
		const dt = b.t - a.t;
		if (dt <= 0 || performance.now() - b.t > 60) return;
		this.inertia = { vLon: wrap(b.lon - a.lon) / dt, vLat: (b.lat - a.lat) / dt, last: b.t };
		this.invalidate();
	}

	/** Zoom so the point under `pt` stays under it. */
	private zoomAt(zoom: number, pt: { x: number; y: number }) {
		this.setupProjections();
		const before = this.front.invert?.([pt.x, pt.y]);
		this.cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
		this.setupProjections();
		const after = this.front.invert?.([pt.x, pt.y]);
		if (before && after && Number.isFinite(before[0]) && Number.isFinite(after[0])) {
			this.cam.lon = wrap(this.cam.lon + (before[0] - after[0]));
			this.cam.lat = Math.max(-89, Math.min(89, this.cam.lat + (before[1] - after[1])));
		}
		this.changed();
	}
}

export type { Feature, MultiLineString, MultiPolygon, Polygon };
