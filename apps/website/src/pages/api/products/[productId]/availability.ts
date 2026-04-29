import type { APIRoute } from 'astro';
import { and, count, eq, ne } from 'drizzle-orm';

import { courseBuilderAdapter, db } from '../../../../db';
import { purchases } from '../../../../db/schema';
import { withSkill } from '../../../../server/with-skill';

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, {
		...init,
		headers: {
			'Cache-Control': 'no-store, max-age=0',
			...(init.headers ?? {}),
		},
	});
}

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

		const [activePurchaseCount] = await db
			.select({ count: count() })
			.from(purchases)
			.where(
				and(
					eq(purchases.productId, productId),
					ne(purchases.status, 'Refunded'),
				),
			);

		const quantityAvailable =
			(product.quantityAvailable || 0) - (activePurchaseCount?.count ?? 0);

		return json({
			quantityAvailable: Math.max(0, quantityAvailable),
			unlimited: false,
		});
	})(request);
