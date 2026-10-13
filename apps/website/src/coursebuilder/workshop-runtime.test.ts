import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { it } from 'node:test';

it('loads and sanitizes workshop Markdown without CommonJS require(ESM) support', () => {
	// Netlify's runtime rejected sanitize-html requiring ESM-only htmlparser2.
	// Spawn even on newer local Node versions so require(ESM) cannot mask it.
	const result = spawnSync(
		process.execPath,
		[
			'--no-experimental-require-module',
			'--input-type=module',
			'-e',
			`
				import assert from 'node:assert/strict';
				import { createRequire } from 'node:module';
				import { renderWorkshopBody } from './src/coursebuilder/workshop-page.ts';
				const require = createRequire(import.meta.url);
				const sanitizerRequire = createRequire(require.resolve('sanitize-html'));
				assert.match(sanitizerRequire.resolve('htmlparser2'), /dist\\/commonjs\\/index\\.js$/);
				const sections = renderWorkshopBody('## Sample\\n\\nSafe <script>unsafe()</script>');
				assert.equal(sections[0].headingHtml, 'Sample');
				assert.equal(sections[0].bodyHtml, '<p>Safe </p>\\n');
			`,
		],
		{ cwd: new URL('../../', import.meta.url), encoding: 'utf8' },
	);
	assert.equal(result.status, 0, result.stderr || result.stdout);
});
