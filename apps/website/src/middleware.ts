import { clerkMiddleware } from '@clerk/astro/server';
import { defineMiddleware, sequence } from 'astro:middleware';
import { guardWorkshopCache } from './coursebuilder/workshop-cache';
import {
	guardAdminRequest,
	isAdminPath,
	isContentApiPath,
} from './server/admin-access';
import { findCourseBuilderUserForClerkUser } from './coursebuilder/users';
import { getUserAbilityForRequest } from './server/ability';

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

const workshopCacheGuard = defineMiddleware(async (context, next) => {
	const response = await next();
	return guardWorkshopCache(
		context.request,
		response,
		context.url.pathname.startsWith('/workshops/') &&
			Boolean(context.locals.auth?.().userId),
	);
});

const adminGuard = defineMiddleware(async (context, next) => {
	if (!isAdminPath(context.url.pathname)) return next();
	return guardAdminRequest(
		context.request,
		async () =>
			context.request.headers.has('authorization')
				? (await getUserAbilityForRequest(context.request)).user
				: findCourseBuilderUserForClerkUser(
						(await context.locals.currentUser?.()) ?? null,
					),
		async (viewer) => {
			context.locals.contentViewer = viewer;
			if (viewer.role === 'admin') context.locals.adminViewer = viewer;
			return next();
		},
		isContentApiPath(context.url.pathname) ? 'content' : 'admin',
	);
});

export const onRequest = sequence(
	workshopCacheGuard,
	pinResponseCookies,
	dedupeRequestCookies,
	clerkMiddleware(),
	adminGuard,
);
