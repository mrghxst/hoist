// Lighthouse CI: every category must score 100 (PROMPT.md 10).
module.exports = {
	ci: {
		collect: {
			staticDistDir: './build',
			url: ['http://localhost/index.html'],
			numberOfRuns: 1,
			settings: { chromeFlags: '--headless=new' }
		},
		assert: {
			assertions: {
				'categories:performance': ['error', { minScore: 1 }],
				'categories:accessibility': ['error', { minScore: 1 }],
				'categories:best-practices': ['error', { minScore: 1 }],
				'categories:seo': ['error', { minScore: 1 }],
				'largest-contentful-paint': ['error', { maxNumericValue: 1500 }],
				'cumulative-layout-shift': ['error', { maxNumericValue: 0 }]
			}
		},
		upload: { target: 'filesystem', outputDir: '.lighthouseci' }
	}
};
