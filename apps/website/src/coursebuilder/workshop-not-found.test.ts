import assert from 'node:assert/strict';
import {
	mkdtemp,
	mkdir,
	readFile,
	writeFile,
	rm,
	symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it } from 'node:test';
import { dev } from 'astro';
import react from '@astrojs/react';

it('renders workshop sales copy and SEO, keeps the empty-body fallback, and rewrites missing workshops to 404', async () => {
	// Exercise the real Astro pages and rewrite handler without database or Clerk
	// credentials. Only external data and the surrounding layout are stubbed.
	const root = await mkdtemp(join(tmpdir(), 'codetv-workshop-404-'));
	async function fixture(path: string, content: string) {
		const target = join(root, path);
		await mkdir(join(target, '..'), { recursive: true });
		await writeFile(target, content);
	}
	let server: Awaited<ReturnType<typeof dev>> | undefined;
	try {
		await symlink(
			fileURLToPath(new URL('../../node_modules', import.meta.url)),
			join(root, 'node_modules'),
			'dir',
		);
		const workshopPage = await readFile(
			new URL('../pages/workshops/[slug].astro', import.meta.url),
			'utf8',
		);
		await fixture('src/pages/workshops/[slug].astro', workshopPage);
		await fixture(
			'src/pages/404.astro',
			await readFile(new URL('../pages/404.astro', import.meta.url), 'utf8'),
		);
		await fixture(
			'src/layouts/default.astro',
			'---\nconst {title, description} = Astro.props;\n---\n<html><head><title>{title}</title><meta name="description" content={description} /></head><body><slot /></body></html>',
		);
		await fixture(
			'src/components/design-system/block.astro',
			await readFile(
				new URL('../components/design-system/block.astro', import.meta.url),
				'utf8',
			),
		);
		await fixture(
			'src/components/workshops/workshop-pricing.tsx',
			await readFile(
				new URL(
					'../components/workshops/workshop-pricing.tsx',
					import.meta.url,
				),
				'utf8',
			),
		);
		await fixture(
			'src/coursebuilder/workshop-price.ts',
			'export const getDefaultWorkshopPrice = async () => ({unitPrice: 500, fullPrice: 500, calculatedPrice: 300});',
		);
		await fixture(
			'src/coursebuilder/request-country.ts',
			"export const getTrustedCountry = () => 'US';",
		);
		await fixture(
			'src/coursebuilder/users.ts',
			'export const getCourseBuilderUserForClerkUser = async () => null;',
		);
		await fixture(
			'src/coursebuilder/workshop-page.ts',
			await readFile(new URL('./workshop-page.ts', import.meta.url), 'utf8'),
		);
		await fixture(
			'src/coursebuilder/workshops.ts',
			`
			export const getWorkshopForSale = async (slug) => slug === 'does-not-exist' ? null : ({
				id: 'fixture', slug, title: 'Sample workshop', description: 'Sample description',
				seoTitle: slug === 'sample' ? 'Sample SEO title' : null,
				seoDescription: slug === 'sample' ? 'Sample SEO description' : null,
				body: slug === 'sample' ? 'Intro **text**.\\n\\n## Sample section\\n\\n- Sample item\\n\\n## FAQ\\n\\nSample answer. <script>unsafe()</script>' : ' ',
				outline: [], ticket: slug === 'sample' ? {
					productId: 'ticket', enrollment: {state: 'open', opensAt: null, closesAt: null},
				} : null,
			});
			export const getTicketPurchase = async () => { throw new Error('Unexpected ticket lookup'); };
			export const resolveCouponCode = async () => null;
		`,
		);
		server = await dev({
			root,
			configFile: false,
			output: 'server',
			integrations: [react()],
			vite: { ssr: { noExternal: ['@astrojs/react'] } },
			server: { host: '127.0.0.1', port: 0 },
			logLevel: 'silent',
		});
		const response = await fetch(
			`http://127.0.0.1:${server.address.port}/workshops/does-not-exist`,
		);
		assert.equal(response.status, 404);
		const html = await response.text();
		assert.match(html, /Page Not Found/);
		assert.match(html, /The page you requested was not found/);
		assert.match(html, /open an issue/);
		assert.doesNotMatch(html, /Get a ticket/);

		const sample = await fetch(
			`http://127.0.0.1:${server.address.port}/workshops/sample`,
		);
		assert.equal(sample.status, 200);
		const sampleHtml = await sample.text();
		assert.match(sampleHtml, /<title>Sample SEO title<\/title>/);
		assert.match(sampleHtml, /content="Sample SEO description"/);
		assert.match(sampleHtml, /<strong>text<\/strong>/);
		assert.match(sampleHtml, /<h2[^>]*>Sample section<\/h2>/);
		assert.match(sampleHtml, /<h2[^>]*>FAQ<\/h2>/);
		assert.match(sampleHtml, /id="ticket"/);
		assert.match(sampleHtml, /href="#ticket"/);
		assert.match(sampleHtml, /Buy a ticket/);
		assert.match(sampleHtml, /\$300/);
		assert.match(
			sampleHtml,
			/<form[^>]*action="\/api\/coursebuilder\/checkout\/stripe\?/,
		);
		assert.match(sampleHtml, /<form[^>]*method="post"/i);
		assert.doesNotMatch(
			sampleHtml,
			/Sign in to buy|Sign in or create a free CodeTV account/,
		);
		assert.doesNotMatch(sampleHtml, /What’s included|unsafe\(\)/);
		assert.ok(
			sampleHtml.indexOf('Sample section') < sampleHtml.indexOf('id="ticket"'),
		);

		const fallback = await fetch(
			`http://127.0.0.1:${server.address.port}/workshops/empty`,
		);
		const fallbackHtml = await fallback.text();
		assert.match(
			fallbackHtml,
			/<title>Sample workshop \| CodeTV Workshop<\/title>/,
		);
		assert.match(fallbackHtml, /What’s included/);
		assert.match(
			fallbackHtml,
			/Lifetime access to the Workshop recordings and materials/,
		);
	} finally {
		await server?.stop();
		await rm(root, { recursive: true, force: true });
	}
});
