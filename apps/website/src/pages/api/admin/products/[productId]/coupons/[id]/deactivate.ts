import type { APIRoute } from 'astro';
import {
	contentRoute,
	readContentJson,
} from '../../../../../../../server/content-http';
export const prerender = false;
export const POST: APIRoute = (context) =>
	contentRoute(context, 'deactivate_coupon', async () => ({
		...(await readContentJson(context.request)),
		productId: context.params.productId,
		id: context.params.id,
	}));
