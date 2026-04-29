import { deviceVerificationRouter } from './device-verification';
import { publicProcedure, router } from './router-base';

export const appRouter = router({
	health: publicProcedure.query(() => ({ ok: true })),
	deviceVerification: deviceVerificationRouter,
});

export type AppRouter = typeof appRouter;
