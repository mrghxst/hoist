/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			adapter: adapter({ pages: 'build', assets: 'build', fallback: '404.html', strict: true }),
			prerender: {
				entries: ['*'],
				handleHttpError: 'fail'
			},
			inlineStyleThreshold: 16384
		})
	],
	build: {
		target: 'es2022',
		assetsInlineLimit: 0,
		rolldownOptions: {
			output: {
				// One chunk for the code that every page needs at first paint (the
				// Svelte runtime, layout): fewer requests on a cold load. Code used
				// by one page stays with it; the globe stays a lazy chunk.
				// SvelteKit finds its runtime by that chunk, so it stays apart.
				codeSplitting: {
					groups: [{ name: 'app', tags: ['$initial'], minShareCount: 2, test: (id) => !/kit[\\/]src[\\/]runtime[\\/]client[\\/]/.test(id) }]
				}
			}
		}
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
