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
			output: { bundleStrategy: 'single' },
			inlineStyleThreshold: 8192
		})
	],
	build: {
		target: 'es2022',
		assetsInlineLimit: 0
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node'
	}
});
