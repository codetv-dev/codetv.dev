import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';

import { db } from '../../../../db';
import { coupon, purchases } from '../../../../db/schema';
import { getUserAbilityForRequest } from '../../../../server/ability';
import { withSkill } from '../../../../server/with-skill';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
	withSkill(async (request) => {
		const productId = params.productId;

		if (!productId) {
			return json({ error: 'Product ID required' }, { status: 400 });
		}

		const { user, ability } = await getUserAbilityForRequest(request);

		if (!user || ability.cannot('update', 'Content')) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const statusCounts = await db
			.select({
				status: purchases.status,
				count: sql<number>`COUNT(*)`.as('count'),
			})
			.from(purchases)
			.where(eq(purchases.productId, productId))
			.groupBy(purchases.status);

		const byStatus: Record<string, number> = {};
		let totalPurchases = 0;
		for (const row of statusCounts) {
			byStatus[row.status] = Number(row.count);
			totalPurchases += Number(row.count);
		}

		const bulkStats = await db
			.select({
				totalMaxUses: sql<number>`COALESCE(SUM(${coupon.maxUses}), 0)`.as(
					'totalMaxUses',
				),
				totalUsedCount: sql<number>`COALESCE(SUM(${coupon.usedCount}), 0)`.as(
					'totalUsedCount',
				),
				bulkPurchaseCount: sql<number>`COUNT(*)`.as('bulkPurchaseCount'),
			})
			.from(purchases)
			.innerJoin(coupon, eq(purchases.bulkCouponId, coupon.id))
			.where(
				and(eq(purchases.productId, productId), eq(purchases.status, 'Valid')),
			);

		const bulk = bulkStats[0] ?? {
			totalMaxUses: 0,
			totalUsedCount: 0,
			bulkPurchaseCount: 0,
		};
		const unredeemedSeats =
			Number(bulk.totalMaxUses) - Number(bulk.totalUsedCount);
		const activePurchases =
			(byStatus.Valid ?? 0) + (byStatus.Restricted ?? 0);

		return json({
			productId,
			totalPurchases,
			activePurchases,
			totalSeats: activePurchases + unredeemedSeats,
			byStatus,
			bulk: {
				purchases: Number(bulk.bulkPurchaseCount),
				maxSeats: Number(bulk.totalMaxUses),
				usedSeats: Number(bulk.totalUsedCount),
				unredeemedSeats,
			},
		});
	})(request);
