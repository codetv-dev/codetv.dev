import Stripe from 'stripe';

import StripeProvider, {
	StripePaymentAdapter,
} from '@coursebuilder/core/providers/stripe';

/**
 * Base URL for CourseBuilder commerce redirects (Stripe success/cancel URLs).
 *
 * On Netlify, `URL` is always the production domain. Deploy previews and branch
 * deploys use `DEPLOY_PRIME_URL` so a test purchase returns to the preview.
 */
export function getCommerceBaseUrl() {
	const netlifyPreviewUrl =
		process.env.CONTEXT && process.env.CONTEXT !== 'production'
			? process.env.DEPLOY_PRIME_URL
			: undefined;

	return (
		process.env.COURSEBUILDER_URL ??
		netlifyPreviewUrl ??
		process.env.PUBLIC_SITE_URL ??
		process.env.URL ??
		'http://localhost:4321'
	).replace(/\/$/, '');
}

function getStripeToken() {
	return (
		process.env.COURSEBUILDER_STRIPE_SECRET_TOKEN ??
		process.env.COURSEBUILDER_STRIPE_SECRET_KEY ??
		process.env.STRIPE_SECRET_TOKEN ??
		process.env.STRIPE_SECRET_KEY
	);
}

/** True when CourseBuilder commerce is pointed at a live Stripe key. */
export function isStripeLiveMode() {
	return /^(sk|rk)_live_/.test(getStripeToken() ?? '');
}

function getStripeWebhookSecret() {
	return (
		process.env.COURSEBUILDER_STRIPE_WEBHOOK_SECRET ??
		process.env.STRIPE_WEBHOOK_SECRET
	);
}

/**
 * Verify a Stripe webhook signature against the CourseBuilder webhook secret.
 *
 * CourseBuilder core 1.2.1 calls its async `verifyWebhookSignature` without
 * awaiting it, so a bad signature does not stop core from processing the
 * event. The `/api/coursebuilder/webhook` route verifies here first.
 */
export function verifyStripeWebhookSignature(
	rawBody: string,
	signature: string | null,
): boolean {
	const secret = getStripeWebhookSecret();
	if (!secret || !signature) return false;

	try {
		Stripe.webhooks.constructEvent(rawBody, signature, secret);
		return true;
	} catch {
		return false;
	}
}

export function getStripeProvider() {
	const stripeToken = getStripeToken();
	const stripeWebhookSecret = getStripeWebhookSecret();

	if (!stripeToken || !stripeWebhookSecret) return null;

	const baseUrl = getCommerceBaseUrl();

	return StripeProvider({
		errorRedirectUrl: baseUrl,
		baseSuccessUrl: baseUrl,
		cancelUrl: baseUrl,
		paymentsAdapter: new StripePaymentAdapter({
			stripeToken,
			stripeWebhookSecret,
		}),
	});
}
