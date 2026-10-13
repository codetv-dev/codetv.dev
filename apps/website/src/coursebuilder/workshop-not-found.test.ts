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

it('rewrites an unknown workshop to the site 404 page with a 404 status', async () => {
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
		await fixture(
			'src/pages/workshops/[slug].astro',
			workshopPage.replace(
				"'@clerk/astro/components'",
				"'../../coursebuilder/stubs'",
			),
		);
		await fixture(
			'src/pages/404.astro',
			await readFile(new URL('../pages/404.astro', import.meta.url), 'utf8'),
		);
		await fixture(
			'src/layouts/default.astro',
			'<html><body><slot /></body></html>',
		);
		await fixture(
			'src/components/design-system/block.astro',
			'<div><slot /></div>',
		);
		await fixture(
			'src/components/workshops/workshop-pricing.ts',
			'export const WorkshopPricing = () => null;',
		);
		await fixture(
			'src/coursebuilder/stubs.ts',
			'export const SignInButton = () => null;',
		);
		await fixture(
			'src/coursebuilder/users.ts',
			'export const getCourseBuilderUserForClerkUser = async () => { throw new Error("Unexpected user lookup for missing workshop"); };',
		);
		await fixture(
			'src/coursebuilder/workshops.ts',
			`
			export const getWorkshopForSale = async () => null;
			export const getTicketPurchase = async () => { throw new Error('Unexpected ticket lookup'); };
			export const resolveCouponCode = async () => { throw new Error('Unexpected coupon lookup'); };
		`,
		);
		server = await dev({
			root,
			configFile: false,
			output: 'server',
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
	} finally {
		await server?.stop();
		await rm(root, { recursive: true, force: true });
	}
});
