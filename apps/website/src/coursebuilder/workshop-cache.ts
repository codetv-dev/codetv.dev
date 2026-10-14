/** Bound stale HTML by both the refresh window and scheduled price/sales changes. */
export function workshopCacheControl(
	boundaries: Array<Date | null>,
	now = new Date(),
) {
	const remaining = boundaries
		.filter((date): date is Date => date !== null)
		.map((date) => Math.floor((date.getTime() - now.getTime()) / 1000) - 5);
	// Keep a filled cache usable across quiet periods; freshness stays one minute.
	const lifetime = Math.min(60 + 86_400, ...remaining);
	if (lifetime < 1) return 'no-store';
	const fresh = Math.min(60, lifetime);
	return `public, durable, s-maxage=${fresh}, stale-while-revalidate=${lifetime - fresh}`;
}

export const WORKSHOP_SESSION_HEADER = 'x-codetv-workshop-session';

/** Clerk uses both legacy and instance-suffixed cookies. Zero UAT is signed out. */
export function hasWorkshopSessionEvidence(request: Request) {
	if (request.headers.has('Authorization')) return true;
	return (request.headers.get('Cookie') ?? '').split(';').some((cookie) => {
		const separator = cookie.indexOf('=');
		const name = (separator < 0 ? cookie : cookie.slice(0, separator)).trim();
		const value = separator < 0 ? '' : cookie.slice(separator + 1).trim();
		return (
			name === '__session' ||
			name.startsWith('__session_') ||
			(name.startsWith('__client_uat') && value !== '0')
		);
	});
}

/** Run AFTER Clerk: its injected auth state and Set-Cookie must never be shared. */
export function guardWorkshopCache(
	request: Request,
	response: Response,
	isAuthenticated = false,
) {
	const url = new URL(request.url);
	if (!/^\/workshops\/[^/]+$/.test(url.pathname)) return response;
	// The non-cached edge gate overwrites this header BEFORE downstream cache
	// lookup. Analytics cookies and zero UAT share the same anonymous entry.
	response.headers.set(
		'Netlify-Vary',
		`query, header=${WORKSHOP_SESSION_HEADER}`,
	);
	if (
		isAuthenticated ||
		url.searchParams.has('code') ||
		hasWorkshopSessionEvidence(request) ||
		// Fail closed when the edge gate is missing or failed to classify a request.
		request.headers.get(WORKSHOP_SESSION_HEADER) !== 'anonymous' ||
		response.headers.has('Set-Cookie') ||
		response.status !== 200
	) {
		response.headers.set('Cache-Control', 'private, no-store');
		response.headers.set('Netlify-CDN-Cache-Control', 'no-store');
		response.headers.delete('Netlify-Cache-Tag');
	}
	return response;
}
