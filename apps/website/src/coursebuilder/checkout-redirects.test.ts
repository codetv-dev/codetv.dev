import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	getSafeReturnUrl,
	getStripeCheckoutUrl,
} from './checkout-redirects.ts';

describe('getStripeCheckoutUrl', () => {
	const stripe = 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3#fid';

	it('unwraps core’s verify-login redirect for cohort products', () => {
		const location = `https://codetv.dev/subscribe/verify-login?${new URLSearchParams(
			{
				productId: 'product-ticket',
				checkoutUrl: stripe,
			},
		)}`;

		assert.equal(getStripeCheckoutUrl(location), stripe);
	});

	it('passes a direct Stripe redirect through', () => {
		assert.equal(getStripeCheckoutUrl(stripe), stripe);
	});

	it('treats core’s error redirect to the site root as a failure', () => {
		assert.equal(getStripeCheckoutUrl('https://codetv.dev'), null);
		assert.equal(
			getStripeCheckoutUrl(
				'https://codetv.dev/subscribe/verify-login?checkoutUrl=https%3A%2F%2Fcodetv.dev',
			),
			null,
		);
	});

	it('refuses lookalike and non-https hosts', () => {
		assert.equal(
			getStripeCheckoutUrl('https://checkout.stripe.com.evil.dev/x'),
			null,
		);
		assert.equal(getStripeCheckoutUrl('http://checkout.stripe.com/x'), null);
		assert.equal(getStripeCheckoutUrl(null), null);
		assert.equal(getStripeCheckoutUrl('not a url'), null);
	});
});

describe('getSafeReturnUrl', () => {
	const requestUrl = new URL(
		'https://deploy-preview-12--codetv.netlify.app/api/coursebuilder/checkout/stripe',
	);

	it('keeps same-site return URLs, including query strings', () => {
		const url = getSafeReturnUrl(
			'https://deploy-preview-12--codetv.netlify.app/workshops/example-workshop?code=EXAMPLE10',
			requestUrl,
			[],
		);

		assert.equal(url.pathname, '/workshops/example-workshop');
		assert.equal(url.searchParams.get('code'), 'EXAMPLE10');
	});

	it('allows the configured commerce origin', () => {
		const url = getSafeReturnUrl('https://codetv.dev/workshops/x', requestUrl, [
			'https://codetv.dev',
		]);

		assert.equal(url.toString(), 'https://codetv.dev/workshops/x');
	});

	it('falls back to the home page for other origins (no open redirect)', () => {
		assert.equal(
			getSafeReturnUrl('https://evil.example/phish', requestUrl, []).toString(),
			'https://deploy-preview-12--codetv.netlify.app/',
		);
		assert.equal(
			getSafeReturnUrl('//evil.example/phish', requestUrl, []).origin,
			'https://deploy-preview-12--codetv.netlify.app',
		);
	});

	it('resolves relative paths against the request', () => {
		assert.equal(
			getSafeReturnUrl('/workshops/x', requestUrl, []).toString(),
			'https://deploy-preview-12--codetv.netlify.app/workshops/x',
		);
	});
});
