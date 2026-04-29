import type { APIRoute } from 'astro';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createContext } from '../../../server/trpc/context';
import { appRouter } from '../../../server/trpc/router';

export const ALL: APIRoute = (context) => {
	return fetchRequestHandler({
		endpoint: '/api/trpc',
		req: context.request,
		router: appRouter,
		createContext: (opts) => createContext(opts, context.locals),
	});
};
