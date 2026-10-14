import {
	hasWorkshopSessionEvidence,
	WORKSHOP_SESSION_HEADER,
} from '../../src/coursebuilder/workshop-cache.ts';

/**
 * Run on every request before the function's shared cache lookup. Never cache
 * this gate itself, and never trust a client-supplied classification header.
 * @param {Request} request
 * @param {{ next(request: Request): Promise<Response> }} context
 */
export default function workshopCacheKey(request, context) {
	const headers = new Headers(request.headers);
	headers.set(
		WORKSHOP_SESSION_HEADER,
		hasWorkshopSessionEvidence(request) ? 'session' : 'anonymous',
	);
	return context.next(new Request(request, { headers }));
}

export const config = { path: '/workshops/*' };
