import {
	hasWorkshopSessionEvidence,
	WORKSHOP_SESSION_HEADER,
	WORKSHOP_QUERY_HEADER,
} from '../../src/coursebuilder/workshop-cache.ts';

/**
 * Run on every request before the function's shared cache lookup. Never cache
 * this gate itself, and never trust a client-supplied classification header.
 * @param {Request} request
 * @param {{ next(request: Request): Promise<Response> }} context
 */
export default async function workshopCacheKey(request, context) {
	const headers = new Headers(request.headers);
	headers.set(
		WORKSHOP_SESSION_HEADER,
		hasWorkshopSessionEvidence(request) ? 'session' : 'anonymous',
	);
	// Coupon links share the same code-agnostic shell. Only the browser's
	// refinement request reads its original URL and resolves the code.
	const url = new URL(request.url);
	url.searchParams.delete('code');
	// Preserve every other query variation without putting raw query values in
	// a header. Omitting Netlify's broad `query` key lets all codes share a shell.
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(url.search),
	);
	headers.set(
		WORKSHOP_QUERY_HEADER,
		Array.from(new Uint8Array(digest), (byte) =>
			byte.toString(16).padStart(2, '0'),
		).join(''),
	);
	return context.next(new Request(url, new Request(request, { headers })));
}

export const config = { path: '/workshops/*' };
