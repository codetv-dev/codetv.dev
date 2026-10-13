/**
 * Clerk cookies on `/api/coursebuilder/*`.
 *
 * A Clerk refresh or handshake `Set-Cookie` that reaches the browser from a
 * `/api/coursebuilder/*` response without `Path=/` is stored by the browser
 * with the default path `/api/coursebuilder`. From then on the browser sends
 * that stale set first (longest path wins) on every request under that
 * prefix, Clerk reads the stale `__session`, and the checkout POST is signed
 * out. Pages and `/api/` never see the stray set, so everything else looks
 * fine.
 */

export const COURSEBUILDER_API_PREFIX = '/api/coursebuilder';

const CLERK_COOKIE =
	/^(__session|__client_uat|__refresh|__clerk_db_jwt|clerk_active_context)(_.+)?$/;

export function isClerkCookie(name: string) {
	return CLERK_COOKIE.test(name);
}

export function isCoursebuilderApiPath(pathname: string) {
	return (
		pathname === COURSEBUILDER_API_PREFIX ||
		pathname.startsWith(`${COURSEBUILDER_API_PREFIX}/`)
	);
}

function parseCookieHeader(header: string | null) {
	return (header ?? '')
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const index = part.indexOf('=');
			return { name: index < 0 ? part : part.slice(0, index), raw: part };
		});
}

/**
 * The browser sends a path-scoped duplicate before the root one. For Clerk
 * cookies, keep only the last value of each name so this request already
 * authenticates with the root-path cookie.
 */
export function dedupeClerkCookies(header: string | null) {
	const cookies = parseCookieHeader(header);
	const lastIndex = new Map<string, number>();
	cookies.forEach((cookie, index) => {
		if (isClerkCookie(cookie.name)) lastIndex.set(cookie.name, index);
	});
	return cookies
		.filter(
			(cookie, index) =>
				!isClerkCookie(cookie.name) || lastIndex.get(cookie.name) === index,
		)
		.map((cookie) => cookie.raw)
		.join('; ');
}

/** Give a Clerk `Set-Cookie` an explicit `Path=/`; leave other cookies alone. */
export function withRootPath(setCookie: string) {
	const name = setCookie.slice(0, setCookie.indexOf('=')).trim();
	if (!isClerkCookie(name)) return setCookie;
	const attributes = setCookie.split(';');
	const rest = attributes
		.slice(1)
		.filter((attribute) => !/^\s*path\s*=/i.test(attribute));
	return [attributes[0], ' Path=/', ...rest].join(';');
}

/** Expire the stray `Path=/api/coursebuilder` copy of each Clerk cookie sent. */
export function expireStrayClerkCookies(cookieHeader: string | null) {
	const names = new Set(
		parseCookieHeader(cookieHeader)
			.map((cookie) => cookie.name)
			.filter(isClerkCookie),
	);
	return [...names].map(
		(name) => `${name}=; Max-Age=0; Path=${COURSEBUILDER_API_PREFIX}`,
	);
}

/** Rewrite a response's Clerk cookies and expire strays. */
export function fixClerkCookieResponse(
	response: Response,
	requestCookieHeader: string | null,
) {
	const existing = response.headers.getSetCookie().map(withRootPath);
	const expiries = expireStrayClerkCookies(requestCookieHeader);
	response.headers.delete('set-cookie');
	for (const cookie of [...existing, ...expiries]) {
		response.headers.append('set-cookie', cookie);
	}
	return response;
}
