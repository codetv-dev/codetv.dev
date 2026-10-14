import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { it } from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

it('renders one accessible shell with evidence-based copy and a real support route', async () => {
	// Keep the bundle inside the workspace so external React imports resolve normally.
	const dir = await mkdtemp(join(process.cwd(), '.purchase-shell-test-'));
	try {
		const file = join(dir, 'component.cjs');
		await build({
			entryPoints: ['src/components/workshops/purchase-processing.tsx'],
			outfile: file,
			bundle: true,
			platform: 'node',
			format: 'cjs',
			packages: 'external',
			jsx: 'automatic',
		});
		const { PurchaseProcessing } = createRequire(import.meta.url)(file);
		const render = (initialStatus: unknown, signedIn = false) =>
			renderToStaticMarkup(
				createElement(PurchaseProcessing, {
					sessionId: 'cs_test_fixture',
					supportEmail: 'info@codetv.dev',
					initialStatus,
					signedIn,
				}),
			);
		const pending = render({ status: 'processing', paymentStatus: null });
		assert.match(pending, /Finalizing your ticket/);
		assert.doesNotMatch(
			pending,
			/Payment received|payment went through|payment failed|—/,
		);
		assert.match(
			pending,
			/role="status" aria-live="polite" aria-atomic="true"/,
		);
		assert.match(pending, /id="purchase-heading" tabindex="-1"/);
		const paid = render({ status: 'processing', paymentStatus: 'paid' });
		assert.match(paid, /Payment received/);
		const support = render({ status: 'error', message: 'DB miss' });
		assert.match(support, /Check again/);
		assert.match(
			support,
			/mailto:info@codetv.dev\?subject=Workshop\+ticket\+help/,
		);
		assert.match(support, /cs_test_fixture/);
		assert.match(support, /This does not mean your payment failed/);
		assert.doesNotMatch(
			support,
			/DB miss|haven’t been charged|Your payment didn’t go through|—/,
		);
		const ready = render({
			status: 'ready',
			purchaseId: 'p_fixture',
			productName: 'Workshop',
			buyerEmail: 'guest@example.com',
			purchaseStatus: 'Valid',
			workshopPath: '/workshops/fixture',
		});
		assert.match(ready, /Your ticket is confirmed/);
		assert.match(ready, /You’re in\. Sign in or create your CodeTV account/);
		assert.match(
			ready,
			/Your ticket is for <strong>guest@example.com<\/strong>/,
		);
		assert.match(
			ready,
			/href="\/dashboard\/sign-in\?redirect_url=%2Fworkshops%2Ffixture"/,
		);
		assert.doesNotMatch(ready, /linked to your CodeTV account/);
		const signedInReady = render(
			{
				status: 'ready',
				purchaseId: 'p_fixture',
				productName: 'Workshop',
				purchaseStatus: 'Valid',
				workshopPath: '/workshops/fixture',
			},
			true,
		);
		assert.match(signedInReady, /linked to your CodeTV account/);
		assert.doesNotMatch(signedInReady, /Sign in or create/);
		assert.match(ready, /href="\/workshops\/fixture"/);
		assert.doesNotMatch(ready, /Check again/);
		for (const html of [pending, support, ready])
			assert.equal((html.match(/<section/g) ?? []).length, 1);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
