import type { APIContext, APIRoute } from 'astro';
import { Coursebuilder } from '@coursebuilder/astro/server';

import {
	decideCheckoutCoupon,
	getPppMerchantCoupon,
	getValidSiteCoupon,
} from '../../../coursebuilder/checkout-coupons';
import {
	getSafeReturnUrl,
	getStripeCheckoutUrl,
} from '../../../coursebuilder/checkout-redirects';
import { getTrustedCountry } from '../../../coursebuilder/request-country';
import {
	getCommerceBaseUrl,
	verifyStripeWebhookSignature,
} from '../../../coursebuilder/stripe-provider';
import { getCourseBuilderUserForClerkUser } from '../../../coursebuilder/users';
import {
	getTicketForProduct,
	getTicketPurchase,
} from '../../../coursebuilder/workshops';
import { courseBuilderAdapter } from '../../../db';

/**
 * CodeTV owns the `/api/coursebuilder/*` route (the integration runs with
 * `injectEndpoints: false`) so the server, not the browser, decides who is
 * buying, from which country, and whether sales are open. Everything else is
 * passed straight to `@coursebuilder/core`.
 */

export const prerender = false;

const { GET: courseBuilderGet, POST: courseBuilderPost } = Coursebuilder();

/** Core actions that authorize with `x-skill-secret`. */
const SKILL_SECRET_ACTIONS = new Set([
	'refund',
	'transfer',
	'lookup',
	'create-magic-link',
]);

function getAction(url: URL) {
	return url.pathname.replace(/^\/api\/coursebuilder\/?/, '').split('/')[0];
}

/** Hand core a different Request while keeping Astro's locals and helpers. */
function withRequest(context: APIContext, request: Request): APIContext {
	return new Proxy(context, {
		get(target, property) {
			if (property === 'request') return request;
			return Reflect.get(target, property, target);
		},
	});
}

function redirect(location: string, status = 303) {
	return new Response(null, { status, headers: { Location: location } });
}

function backTo(returnUrl: URL, checkout: string) {
	const url = new URL(returnUrl);
	url.searchParams.set('checkout', checkout);
	return redirect(url.toString());
}

async function getViewer(context: APIContext) {
	const clerkUser = await context.locals.currentUser?.();
	return getCourseBuilderUserForClerkUser(clerkUser ?? null);
}

async function handleCheckout(context: APIContext) {
	const url = new URL(context.request.url);
	const returnUrl = getSafeReturnUrl(
		url.searchParams.get('cancelUrl'),
		context.url,
		[new URL(getCommerceBaseUrl()).origin],
	);
	const productId = url.searchParams.get('productId');

	if (!productId) return backTo(returnUrl, 'error');

	const viewer = await getViewer(context);
	if (!viewer) {
		console.info('checkout.blocked', { productId, reason: 'signed-out' });
		return backTo(returnUrl, 'sign-in-required');
	}

	const ticket = await getTicketForProduct(productId);
	if (!ticket) {
		console.warn('checkout.blocked', {
			productId,
			reason: 'product-not-found',
		});
		return backTo(returnUrl, 'error');
	}

	if (ticket.enrollment.state !== 'open') {
		console.info('checkout.blocked', {
			productId,
			userId: viewer.id,
			reason: `enrollment-${ticket.enrollment.state}`,
		});
		return backTo(returnUrl, 'enrollment-closed');
	}

	// TODO: team seats. Port the AI Hero bulk purchase path
	// (ai-hero/apps/ai-hero/src/app/(content)/cohorts/[slug]/_components/cohort-pricing-widget-container.tsx)
	// before allowing quantity > 1 or a second ticket for the same Viewer.
	if (await getTicketPurchase(viewer.id, [productId])) {
		console.info('checkout.blocked', {
			productId,
			userId: viewer.id,
			reason: 'already-has-ticket',
		});
		return backTo(returnUrl, 'already-purchased');
	}

	const coupon = await decideCheckoutCoupon({
		productId,
		trustedCountry: getTrustedCountry(context),
		requestedPpp: url.searchParams.get('ppp') === '1',
		usedCouponId: url.searchParams.get('usedCouponId'),
		adapter: courseBuilderAdapter,
	});

	// Rebuild the query from scratch; nothing else from the browser reaches core.
	const checkoutUrl = new URL(url.pathname, url);
	checkoutUrl.searchParams.set('productId', productId);
	checkoutUrl.searchParams.set('userId', viewer.id);
	checkoutUrl.searchParams.set('quantity', '1');
	checkoutUrl.searchParams.set('bulk', 'false');
	checkoutUrl.searchParams.set('country', coupon.country);
	checkoutUrl.searchParams.set('cancelUrl', returnUrl.toString());
	if (coupon.couponId)
		checkoutUrl.searchParams.set('couponId', coupon.couponId);
	if (coupon.usedCouponId) {
		checkoutUrl.searchParams.set('usedCouponId', coupon.usedCouponId);
	}
	try {
		checkoutUrl.searchParams.set('ip_address', context.clientAddress);
	} catch {
		// clientAddress is unavailable in some dev setups.
	}

	// Core reads everything from the query string; drop the form body.
	const headers = new Headers(context.request.headers);
	headers.delete('content-length');
	headers.delete('content-type');

	const response = await courseBuilderPost(
		withRequest(context, new Request(checkoutUrl, { method: 'POST', headers })),
	);

	const stripeCheckoutUrl = getStripeCheckoutUrl(
		response.headers.get('Location'),
	);

	if (!stripeCheckoutUrl) {
		console.error('checkout.failed', {
			productId,
			userId: viewer.id,
			status: response.status,
		});
		return backTo(returnUrl, 'error');
	}

	console.info('checkout.redirect', {
		productId,
		userId: viewer.id,
		coupon: coupon.reason,
	});
	return redirect(stripeCheckoutUrl);
}

async function handlePricesFormatted(context: APIContext) {
	let body: Record<string, unknown> = {};
	try {
		body = (await context.request.json()) as Record<string, unknown>;
	} catch {
		return Response.json('JSON body is required', { status: 400 });
	}

	const productId = typeof body.productId === 'string' ? body.productId : null;
	if (!productId)
		return Response.json('productId is required', { status: 400 });

	const trustedCountry = getTrustedCountry(context);
	const [viewer, siteCoupon, pppCoupon] = await Promise.all([
		getViewer(context),
		getValidSiteCoupon(
			typeof body.couponId === 'string' ? body.couponId : null,
			productId,
			courseBuilderAdapter,
		),
		body.ppp === true
			? getPppMerchantCoupon(trustedCountry, courseBuilderAdapter)
			: null,
	]);

	const headers = new Headers(context.request.headers);
	headers.delete('content-length');
	headers.set('content-type', 'application/json');
	// Core reads the country from this header first; never let the browser set it.
	headers.set('x-vercel-ip-country', trustedCountry);

	// Only the fields the pricing block needs, decided server-side. PPP is
	// opt-in: it shows up in `availableCoupons` and applies only when chosen.
	return courseBuilderPost(
		withRequest(
			context,
			new Request(context.request.url, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					productId,
					quantity: 1,
					autoApplyPPP: false,
					...(siteCoupon && { couponId: siteCoupon.id }),
					...(pppCoupon && { merchantCoupon: pppCoupon }),
					...(viewer && { userId: viewer.id }),
				}),
			}),
		),
	);
}

/**
 * Core skips signature checks when the header is missing and does not await
 * the check when it is present, so verify the raw body here first.
 */
async function handleWebhook(context: APIContext) {
	const signature = context.request.headers.get('stripe-signature');
	const rawBody = await context.request.text();

	if (!verifyStripeWebhookSignature(rawBody, signature)) {
		console.warn('webhook.rejected', {
			reason: signature
				? 'invalid-stripe-signature'
				: 'missing-stripe-signature',
		});
		return Response.json('Invalid stripe-signature', { status: 400 });
	}

	return courseBuilderPost(
		withRequest(
			context,
			new Request(context.request.url, {
				method: 'POST',
				headers: context.request.headers,
				body: rawBody,
			}),
		),
	);
}

export const GET: APIRoute = (context) => courseBuilderGet(context);

export const POST: APIRoute = async (context) => {
	const action = getAction(new URL(context.request.url));

	switch (action) {
		case 'webhook':
			return handleWebhook(context);
		case 'checkout':
			return handleCheckout(context);
		case 'prices-formatted':
			return handlePricesFormatted(context);
		default:
			// Core treats a missing SKILL_SECRET as a match for a missing header.
			if (
				SKILL_SECRET_ACTIONS.has(action) &&
				(!process.env.SKILL_SECRET ||
					context.request.headers.get('x-skill-secret') !==
						process.env.SKILL_SECRET)
			) {
				return Response.json('unauthorized', { status: 401 });
			}
			return courseBuilderPost(context);
	}
};
