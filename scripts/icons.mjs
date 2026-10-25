// App icons for the web manifest and home screens (PWA), rendered from the
// same mark as the favicon: a flag on a pole, white on black.
// node scripts/icons.mjs   (writes static/icons/*.png; commit the output)
import { mkdirSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

// The favicon's mark (static/favicon.svg), in a 32 × 32 box.
const MARK = '<rect x="6" y="3" width="2.6" height="26" rx="1.3"/><path d="M10 5h16l-3.8 5.7L26 16.4H10z"/>';

/**
 * @param {number} size output size in px
 * @param {number} scale how much of the icon the mark fills (maskable icons
 *   keep it inside the central safe zone)
 * @param {number} radius corner radius as a share of the size (0 for maskable)
 */
function icon(size, scale, radius) {
	const k = (size * scale) / 32;
	const offset = (size - 32 * k) / 2;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
		<rect width="${size}" height="${size}" rx="${size * radius}" fill="#000"/>
		<g fill="#fff" transform="translate(${offset} ${offset}) scale(${k})">${MARK}</g>
	</svg>`;
	return new Resvg(svg).render().asPng();
}

mkdirSync('static/icons', { recursive: true });
writeFileSync('static/icons/icon-192.png', icon(192, 0.62, 0.22));
writeFileSync('static/icons/icon-512.png', icon(512, 0.62, 0.22));
writeFileSync('static/icons/maskable-512.png', icon(512, 0.5, 0));
writeFileSync('static/icons/apple-touch-icon.png', icon(180, 0.62, 0));
console.log('icons: static/icons/');
