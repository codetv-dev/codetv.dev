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
import netlify from '@astrojs/netlify';

it('renders guest checkout in the public shell, defers ownership privately, and preserves missing/empty workshops', async () => {
	// Real pages, pricing widget, ownership island and cache guard. Only external
	// authentication/database data and the surrounding layout are stubbed.
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
		for (const path of [
			'pages/workshops/[slug].astro',
			'pages/404.astro',
			'components/workshops/workshop-ticket.astro',
			'components/workshops/workshop-pricing.tsx',
			'components/design-system/block.astro',
			'coursebuilder/workshop-page.ts',
			'coursebuilder/workshop-cache.ts',
			'coursebuilder/supporter-coupons.ts',
		]) {
			await fixture(
				`src/${path}`,
				await readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
			);
		}
		await fixture(
			'src/layouts/default.astro',
			'---\nconst {title, description} = Astro.props;\n---\n<html><head><title>{title}</title><meta name="description" content={description} /></head><body><slot /></body></html>',
		);
		await fixture(
			'src/coursebuilder/workshop-price.ts',
			`export const getDefaultWorkshopOffer = async () => ({ expiresAt: new Date('2026-11-04T07:59:00Z'), price: { unitPrice: 500, fullPrice: 500, calculatedPrice: 300 } });`,
		);
		await fixture(
			'src/coursebuilder/request-country.ts',
			'export const getTrustedCountry = () => "US";',
		);
		await fixture(
			'src/coursebuilder/users.ts',
			'export const getCourseBuilderUserForClerkUser = async (user) => user ? {id: user.id === "clerk-fixture" ? "test-viewer" : user.id} : null;',
		);
		await fixture(
			'src/middleware.ts',
			`
			import { defineMiddleware } from 'astro:middleware';
			import { guardWorkshopCache, hasWorkshopSessionEvidence, WORKSHOP_SESSION_HEADER, WORKSHOP_QUERY_HEADER } from './coursebuilder/workshop-cache';
			export const onRequest = defineMiddleware(async (context, next) => {
				const cookie = context.request.headers.get('Cookie') ?? '';
				const authenticated = cookie.includes('__session=');
				context.locals.currentUser = async () => cookie.includes('__session=supporter')
					? {id: 'clerk-supporter', publicMetadata: {stripe: {status: 'active', level: 'Bronze Tier Supporter'}}}
					: authenticated ? {id: 'clerk-fixture'} : null;
				const headers = new Headers(context.request.headers);
				headers.set(WORKSHOP_SESSION_HEADER, hasWorkshopSessionEvidence(context.request) ? 'session' : 'anonymous');
				headers.set(WORKSHOP_QUERY_HEADER, 'fixture-query');
				context.request = new Request(context.request, { headers });
				return guardWorkshopCache(context.request, await next(), authenticated);
			});
		`,
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
					productId: 'product-4gmhd', cohort: null,
					enrollment: { state: 'open', opensAt: new Date('2026-09-01T00:00:00Z'), closesAt: new Date('2026-11-16T00:00:00Z') },
				} : null,
			});
			export const getTicketPurchase = async (userId) => userId === 'test-viewer' ? {id: 'purchase-fixture'} : null;
			export const resolveCouponCode = async () => { throw new Error('Shell must not resolve a coupon'); };
		`,
		);
		server = await dev({
			root,
			configFile: false,
			output: 'server',
			adapter: netlify(),
			integrations: [react()],
			vite: { ssr: { noExternal: ['@astrojs/react'] } },
			server: { host: '127.0.0.1', port: 0 },
			logLevel: 'silent',
		});
		const base = `http://127.0.0.1:${server.address.port}`;
		const missing = await fetch(`${base}/workshops/does-not-exist`);
		const missingHtml = await missing.text();
		assert.equal(missing.status, 404, missingHtml);
		assert.match(
			missingHtml,
			/Page Not Found|The page you requested was not found/,
		);
		assert.match(missingHtml, /open an issue/);
		assert.doesNotMatch(missingHtml, /Get a ticket/);
		assert.doesNotMatch(
			missing.headers.get('Netlify-CDN-Cache-Control') ?? '',
			/public/,
		);

		const sample = await fetch(`${base}/workshops/sample`);
		const html = await sample.text();
		assert.equal(sample.status, 200, html);
		assert.match(html, /<title>Sample SEO title<\/title>/);
		assert.match(html, /content="Sample SEO description"/);
		assert.match(html, /<strong>text<\/strong>/);
		assert.match(html, /<h2[^>]*>Sample section<\/h2>/);
		assert.match(html, /<h2[^>]*>FAQ<\/h2>/);
		assert.match(html, /id="ticket"/);
		assert.match(html, /href="#ticket"/);
		assert.match(html, /Buy a ticket/);
		assert.match(html, /\$300/);
		assert.match(html, /<s class="full">\$500<\/s>/);
		assert.match(
			html,
			/<form[^>]*action="\/api\/coursebuilder\/checkout\/stripe\?/,
		);
		assert.match(html, /<form[^>]*method="post"/i);
		assert.doesNotMatch(
			html,
			/Sign in to buy|What’s included|unsafe\(\)|<div[^>]*data-ticket-owned/,
		);
		assert.ok(html.indexOf('Sample section') < html.indexOf('id="ticket"'));
		assert.match(
			sample.headers.get('Netlify-CDN-Cache-Control')!,
			/public, durable/,
		);

		const coded = await fetch(`${base}/workshops/sample?code=fixture-member`);
		const codedHtml = await coded.text();
		assert.match(codedHtml, /\$300/);
		assert.doesNotMatch(codedHtml, /fixture-member|usedCouponId=/);

		const islandPath = html.match(
			/href="([^"]*\/_server-islands\/WorkshopTicket[^"]*)"/,
		)?.[1];
		assert.ok(islandPath, 'Missing ownership island preload URL');
		const islandUrl = new URL(islandPath.replaceAll('&amp;', '&'), sample.url);
		const guestIsland = await fetch(islandUrl);
		assert.equal(guestIsland.status, 200);
		assert.doesNotMatch(await guestIsland.text(), /You have a ticket/);
		assert.equal(guestIsland.headers.get('Cache-Control'), 'private, no-store');
		const ownerIsland = await fetch(islandUrl, {
			headers: { Cookie: '__session=fixture' },
		});
		assert.equal(ownerIsland.status, 200);
		assert.match(
			await ownerIsland.text(),
			/data-ticket-owned.*You have a ticket/s,
		);
		assert.equal(
			ownerIsland.headers.get('Netlify-CDN-Cache-Control'),
			'no-store',
		);
		const supporterIsland = await fetch(islandUrl, {
			headers: { Cookie: '__session=supporter' },
		});
		assert.match(
			await supporterIsland.text(),
			/data-member-offer.*Use your member price: 50% off \(\$250\)/s,
		);
		assert.equal(
			supporterIsland.headers.get('Cache-Control'),
			'private, no-store',
		);
		const supporterShell = await fetch(`${base}/workshops/sample`, {
			headers: { Cookie: '__session=supporter' },
		});
		assert.doesNotMatch(
			await supporterShell.text(),
			/data-member-offer|Use your member price/,
		);
		const ownerShell = await fetch(`${base}/workshops/sample`, {
			headers: { Cookie: '__session=fixture' },
		});
		const ownerHtml = await ownerShell.text();
		assert.match(ownerHtml, /Buy a ticket/);
		assert.doesNotMatch(
			ownerHtml,
			/<div[^>]*data-ticket-owned|You have a ticket/,
		);
		assert.equal(
			ownerShell.headers.get('Netlify-CDN-Cache-Control'),
			'no-store',
		);

		const fallback = await fetch(`${base}/workshops/empty`);
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
