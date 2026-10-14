/** Bound stale HTML by both the refresh window and scheduled price/sales changes. */
export function workshopCacheControl(
	boundaries: Array<Date | null>,
	now = new Date(),
) {
	const remaining = boundaries
		.filter((date): date is Date => date !== null)
		.map((date) => Math.floor((date.getTime() - now.getTime()) / 1000) - 5);
	const lifetime = Math.min(300, ...remaining);
	if (lifetime < 1) return 'no-store';
	const fresh = Math.min(60, lifetime);
	return `public, durable, s-maxage=${fresh}, stale-while-revalidate=${lifetime - fresh}`;
}

/** Run AFTER Clerk: its injected auth state and Set-Cookie must never be shared. */
export function guardWorkshopCache(
	request: Request,
	response: Response,
	isAuthenticated = false,
) {
	const url = new URL(request.url);
	if (!/^\/workshops\/[^/]+$/.test(url.pathname)) return response;
	// Cache lookup happens before middleware. Partition ALL cookies/credentials,
	// not just known Clerk names, so authenticated requests cannot hit the public key.
	const vary = new Set(
		(response.headers.get('Vary') ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean),
	);
	vary.add('Cookie');
	vary.add('Authorization');
	response.headers.set('Vary', [...vary].join(', '));
	if (
		isAuthenticated ||
		request.headers.has('Cookie') ||
		request.headers.has('Authorization') ||
		response.headers.has('Set-Cookie') ||
		response.status !== 200
	) {
		response.headers.set('Cache-Control', 'private, no-store');
		response.headers.set('Netlify-CDN-Cache-Control', 'no-store');
		response.headers.delete('Netlify-Cache-Tag');
	}
	return response;
}
