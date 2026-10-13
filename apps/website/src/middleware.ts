import { clerkMiddleware } from '@clerk/astro/server';
import { defineMiddleware, sequence } from 'astro:middleware';

import {
	dedupeClerkCookies,
	fixClerkCookieResponse,
	isCoursebuilderApiPath,
} from './coursebuilder/clerk-cookies';

/**
 * Under `/api/coursebuilder/*` a stale path-scoped copy of the Clerk cookies
 * can shadow the root ones (see `coursebuilder/clerk-cookies.ts`). Dedupe the
 * request before Clerk reads it, and pin the cookies on the way out.
 */
const dedupeRequestCookies = defineMiddleware((context, next) => {
	if (!isCoursebuilderApiPath(context.url.pathname)) return next();
	const header = context.request.headers.get('cookie');
	if (!header) return next();
	const deduped = dedupeClerkCookies(header);
	if (deduped !== header) {
		const headers = new Headers(context.request.headers);
		headers.set('cookie', deduped);
		context.request = new Request(context.request, { headers });
	}
	return next();
});

const pinResponseCookies = defineMiddleware(async (context, next) => {
	const cookieHeader = context.request.headers.get('cookie');
	const response = await next();
	if (!isCoursebuilderApiPath(context.url.pathname)) return response;
	return fixClerkCookieResponse(response, cookieHeader);
});

export const onRequest = sequence(
	pinResponseCookies,
	dedupeRequestCookies,
	clerkMiddleware(),
);
