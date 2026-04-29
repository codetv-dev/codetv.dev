import type { APIRoute } from 'astro';
import { and, eq, ne } from 'drizzle-orm';

import { courseBuilderAdapter, db } from '../../../../db';
import { purchases } from '../../../../db/schema';
import { withSkill } from '../../../../server/with-skill';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Cache-Control': 'no-store, max-age=0',
};

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, {
		...init,
		headers: {
			...corsHeaders,
			...(init.headers ?? {}),
		},
	});
}

export const OPTIONS: APIRoute = async () => json({});

export const GET: APIRoute = async ({ request, params }) =>
	withSkill(async () => {
		const productId = params.productId;

		if (!productId) {
			return json({ error: 'Product ID required' }, { status: 400 });
		}

		const product = await courseBuilderAdapter.getProduct(productId);

		if (!product) {
			return json({ error: 'Product not found' }, { status: 404 });
		}

		if (product.quantityAvailable === -1) {
			return json({ quantityAvailable: -1, unlimited: true });
		}

		const activePurchases = await db.query.purchases.findMany({
			where: and(
				eq(purchases.productId, productId),
				ne(purchases.status, 'Refunded'),
			),
		});

		const quantityAvailable =
			(product.quantityAvailable || 0) - activePurchases.length;

		return json({
			quantityAvailable: Math.max(0, quantityAvailable),
			unlimited: false,
		});
	})(request);
