/**
 * Redirect guards for the checkout route. Dependency-free for `node --test`.
 */

/**
 * Resolve where to send the buyer back to (cancel URL, error notices).
 * Only same-site URLs are allowed; anything else falls back to the home page.
 */
export function getSafeReturnUrl(
	value: string | null,
	requestUrl: URL,
	allowedOrigins: string[],
): URL {
	const fallback = new URL('/', requestUrl);
	if (!value) return fallback;

	try {
		const url = new URL(value, requestUrl);
		return new Set([requestUrl.origin, ...allowedOrigins]).has(url.origin)
			? url
			: fallback;
	} catch {
		return fallback;
	}
}

/**
 * Pull the Stripe Checkout URL out of core's checkout response.
 *
 * For `cohort`, `live` and `membership` products core 1.2.1 redirects to
 * `${baseUrl}/subscribe/verify-login?checkoutUrl=<stripe url>`. CodeTV has
 * already verified the Viewer, so it goes straight to Stripe. Anything that
 * isn't an https checkout.stripe.com URL (including core's error redirect to
 * the site root) returns null.
 */
export function getStripeCheckoutUrl(location: string | null): string | null {
	if (!location) return null;

	try {
		const url = new URL(location);
		const candidate = url.pathname.endsWith('/subscribe/verify-login')
			? url.searchParams.get('checkoutUrl')
			: location;
		if (!candidate) return null;

		const checkoutUrl = new URL(candidate);
		return checkoutUrl.protocol === 'https:' &&
			checkoutUrl.hostname === 'checkout.stripe.com'
			? checkoutUrl.toString()
			: null;
	} catch {
		return null;
	}
}
