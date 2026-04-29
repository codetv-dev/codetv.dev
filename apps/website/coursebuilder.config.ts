import { defineConfig } from '@coursebuilder/astro';
import { userSchema } from '@coursebuilder/core/schemas';

import { getStripeProvider } from './src/coursebuilder/stripe-provider';
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

	return {
		baseUrl:
			process.env.COURSEBUILDER_URL ??
			process.env.PUBLIC_SITE_URL ??
			process.env.URL ??
			'http://localhost:4321',
		basePath: '/api/coursebuilder',
		adapter: getCourseBuilderAdapter(),
		providers: stripeProvider ? [stripeProvider] : [],
		getCurrentUser,
		callbacks: {
			session: async (request) => ({
				...request,
				user: await getCurrentUser(),
			}),
		},
	};
});
