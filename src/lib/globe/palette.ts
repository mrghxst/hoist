/**
 * Globe colours, derived from the page tokens so light and dark both look
 * deliberate: black ink on white, white ink on black, one accent (4.1).
 */
export interface Palette {
	bg: string;
	fg: string;
	muted: string;
	accent: string;
	font: string;
	transparent: string;
	halo: string;
	bodyLight: string;
	bodyMid: string;
	bodyEdge: string;
	farLand: string;
	farTarget: string;
	graticule: string;
	dot: string;
	land: string;
	border: string;
	targetFill: string;
	rim: string;
	learning1: string;
	learning2: string;
	mastered: string;
}

function parse(colour: string): [number, number, number] {
	const c = colour.trim();
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
	if (hex) {
		const h = hex[1]!.length === 3 ? [...hex[1]!].map((x) => x + x).join('') : hex[1]!;
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}
	const m = /rgba?\(([^)]+)\)/.exec(c);
	if (m) {
		const [r, g, b] = m[1]!.split(/[\s,/]+/).map(Number);
		return [r ?? 0, g ?? 0, b ?? 0];
	}
	return [0, 0, 0];
}

const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r}, ${g}, ${b}, ${a})`;

export function makePalette(vars: { bg: string; fg: string; muted: string; accent: string; font: string }): Palette {
	const bg = parse(vars.bg);
	const fg = parse(vars.fg);
	const accent = parse(vars.accent);
	const dark = bg[0] + bg[1] + bg[2] < 384;
	return {
		bg: rgba(bg, 1),
		fg: rgba(fg, 1),
		muted: vars.muted,
		accent: rgba(accent, 1),
		font: vars.font,
		transparent: rgba(fg, 0),
		halo: rgba(fg, dark ? 0.07 : 0.035),
		bodyLight: rgba(fg, dark ? 0.1 : 0),
		bodyMid: rgba(fg, dark ? 0.045 : 0.012),
		bodyEdge: rgba(fg, dark ? 0.03 : 0.045),
		farLand: rgba(fg, dark ? 0.05 : 0.035),
		farTarget: rgba(accent, 0.2),
		graticule: rgba(fg, dark ? 0.07 : 0.06),
		dot: rgba(fg, dark ? 0.92 : 0.82),
		land: rgba(fg, dark ? 0.17 : 0.12),
		border: rgba(bg, dark ? 0.85 : 0.9),
		targetFill: rgba(accent, 0.28),
		rim: rgba(fg, dark ? 0.28 : 0.16),
		learning1: rgba(fg, dark ? 0.2 : 0.14),
		learning2: rgba(fg, dark ? 0.4 : 0.3),
		mastered: rgba(accent, 0.7)
	};
}

export function readPalette(): Palette {
	if (typeof document === 'undefined') {
		return makePalette({ bg: '#fff', fg: '#000', muted: '#666', accent: '#0070f3', font: 'sans-serif' });
	}
	const s = getComputedStyle(document.documentElement);
	return makePalette({
		bg: s.getPropertyValue('--bg') || '#fff',
		fg: s.getPropertyValue('--fg') || '#000',
		muted: s.getPropertyValue('--muted') || '#666',
		accent: s.getPropertyValue('--accent') || '#0070f3',
		font: s.getPropertyValue('--sans') || 'sans-serif'
	});
}
