import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

type AstroLocals = App.Locals;

export function createContext(
	{
		req,
		resHeaders,
	}: FetchCreateContextFnOptions,
	locals?: AstroLocals,
) {
	return { req, resHeaders, locals };
}

export type TRPCContext = Awaited<ReturnType<typeof createContext>>;
