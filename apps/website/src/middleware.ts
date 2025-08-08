import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';
import { PUBLIC_CLERK_PUBLISHABLE_KEY } from 'astro:env/client';

// Not protecting the dashboard when a Clerk key is missing means people can
// see the broken dashboard. Helpful for dev but not useful otherwise, I think.

// TODO does this have any abuse vectors? I can't think of any, but...
const key = PUBLIC_CLERK_PUBLISHABLE_KEY && PUBLIC_CLERK_PUBLISHABLE_KEY.length > 1 ? PUBLIC_CLERK_PUBLISHABLE_KEY : undefined;

const isProtectedPage = key ? createRouteMatcher([
	/^(?!.*\/(?:sign-up|sign-in)\/?$)\/dashboard.*$/,
]) : () => false;

export const onRequest = key
	? clerkMiddleware((auth, context, next) => {
		if (isProtectedPage(context.request) && !auth().userId) {
			return auth().redirectToSignIn();
		}

		return next();
	})
	: (_: any, next: any) => next();
