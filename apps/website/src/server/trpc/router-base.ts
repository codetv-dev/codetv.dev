import { initTRPC, TRPCError } from '@trpc/server';

import { getUserAbilityForRequest } from '../ability';
import type { TRPCContext } from './context';

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Operator-only procedures, authorized the same way as the CLI REST routes:
 * a device-flow bearer token for a user whose ability can update Content.
 */
export const operatorProcedure = t.procedure.use(async ({ ctx, next }) => {
	const { user, ability } = await getUserAbilityForRequest(ctx.req);

	if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
	if (ability.cannot('update', 'Content')) {
		throw new TRPCError({ code: 'FORBIDDEN' });
	}

	return next({ ctx: { ...ctx, user } });
});
