import type { APIRoute } from 'astro';
import {
	contentRoute,
	readContentJson,
} from '../../../../../../server/content-http';
export const prerender = false;
export const GET: APIRoute = (context) =>
	contentRoute(context, 'list_coupons', () => ({
		productId: context.params.productId,
		limit: Number(context.url.searchParams.get('limit') ?? 50),
		offset: Number(context.url.searchParams.get('offset') ?? 0),
	}));
export const POST: APIRoute = (context) =>
	contentRoute(
		context,
		'create_coupon',
		async () => ({
			...(await readContentJson(context.request)),
			productId: context.params.productId,
		}),
		201,
	);
