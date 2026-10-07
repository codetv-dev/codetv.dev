import { defineConfig } from '@coursebuilder/astro';
import { userSchema } from '@coursebuilder/core/schemas';

import { createInlineCommerceEvents } from './src/coursebuilder/fulfillment';
import {
	getCommerceBaseUrl,
	getStripeProvider,
} from './src/coursebuilder/stripe-provider';
import { getCourseBuilderUserForClerkUser } from './src/coursebuilder/users';
import { getCourseBuilderAdapter } from './src/db';

export default defineConfig(async (context) => {
	const stripeProvider = getStripeProvider();
	const getCurrentUser = async () => {
		const clerkUser = await context.locals.currentUser?.();
		const courseBuilderUser = await getCourseBuilderUserForClerkUser(
			clerkUser ?? null,
		);

		return courseBuilderUser ? userSchema.parse(courseBuilderUser) : null;
	};

	const baseUrl = getCommerceBaseUrl();

	return {
		baseUrl,
		basePath: '/api/coursebuilder',
		adapter: getCourseBuilderAdapter(),
		providers: stripeProvider ? [stripeProvider] : [],
		// Webhook fulfillment runs in-process; see src/coursebuilder/fulfillment.ts.
		inngest: createInlineCommerceEvents({
			getAdapter: getCourseBuilderAdapter,
			getPaymentProvider: () => stripeProvider,
			siteRootUrl: baseUrl,
		}),
		getCurrentUser,
		callbacks: {
			session: async (request) => ({
				...request,
				user: await getCurrentUser(),
			}),
		},
	};
});
