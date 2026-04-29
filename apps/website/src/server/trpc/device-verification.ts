import { TRPCError } from '@trpc/server';
import { isAfter } from 'date-fns';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getCourseBuilderUserForClerkUser } from '../../coursebuilder/users';
import { db } from '../../db';
import { deviceVerifications } from '../../db/schema';
import { publicProcedure, router } from './router-base';

export const deviceVerificationRouter = router({
	verify: publicProcedure
		.input(
			z.object({
				userCode: z.string(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const clerkUser = await ctx.locals?.currentUser?.();

			if (!clerkUser) {
				return { status: 'login-required' as const };
			}

			const user = await getCourseBuilderUserForClerkUser(clerkUser);

			if (!user) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'CourseBuilder user not found',
				});
			}

			const deviceVerification = await db.query.deviceVerifications.findFirst({
				where: eq(deviceVerifications.userCode, input.userCode),
			});

			if (!deviceVerification) {
				return { status: 'no-verification-found' as const };
			}

			if (deviceVerification.verifiedAt) {
				return { status: 'already-verified' as const };
			}

			if (isAfter(new Date(), deviceVerification.expires)) {
				return { status: 'code-expired' as const };
			}

			await db
				.update(deviceVerifications)
				.set({
					verifiedAt: new Date(),
					verifiedByUserId: user.id,
				})
				.where(eq(deviceVerifications.deviceCode, deviceVerification.deviceCode));

			return { status: 'device-verified' as const };
		}),
});
