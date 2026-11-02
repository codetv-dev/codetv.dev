import type { APIRoute } from 'astro';
import { contentRoute } from '../../../../../server/content-http';
export const prerender = false;
export const GET: APIRoute = (context) =>
	contentRoute(context, 'list_sales', () => ({
		productId: context.params.productId,
		limit: Number(context.url.searchParams.get('limit') ?? 50),
		offset: Number(context.url.searchParams.get('offset') ?? 0),
	}));
