import {
	and,
	asc,
	count,
	desc,
	eq,
	isNotNull,
	isNull,
	or,
	sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { db } from '../db';
import {
	coupon,
	merchantCoupon,
	merchantProduct,
	products,
	purchases,
	users,
} from '../db/schema';
import type { CommerceStore } from './commerce-store';
type Connection =
	typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
const bulkCoupon = alias(coupon, 'salesBulkCoupon');
const redeemedCoupon = alias(coupon, 'salesRedeemedCoupon');
const aggregate = () => ({
	purchaseCount: count(),
	recordedAmount: sql<string>`COALESCE(SUM(${purchases.totalAmount}), 0)`,
});
export function createCommerceStore(
	connection: Connection = db,
): CommerceStore {
	return {
		transaction: (run) =>
			connection.transaction((tx) => run(createCommerceStore(tx))),
		async product(id, lock = false) {
			const query = connection
				.select({
					id: products.id,
					name: products.name,
					organizationId: products.organizationId,
				})
				.from(products)
				.where(eq(products.id, id));
			const rows = await (lock ? query.for('update') : query);
			return rows[0] ?? null;
		},
		async sales({ productId, limit, offset }) {
			const where = eq(purchases.productId, productId);
			const rows = await connection
				.select({
					id: purchases.id,
					userId: purchases.userId,
					buyerEmail: users.email,
					amount: purchases.totalAmount,
					status: purchases.status,
					createdAt: purchases.createdAt,
					couponId: purchases.couponId,
					couponCode: coupon.code,
					bulkCouponId: purchases.bulkCouponId,
					bulkCouponCode: bulkCoupon.code,
					redeemedBulkCouponId: purchases.redeemedBulkCouponId,
					redeemedBulkCouponCode: redeemedCoupon.code,
				})
				.from(purchases)
				.leftJoin(users, eq(purchases.userId, users.id))
				.leftJoin(coupon, eq(purchases.couponId, coupon.id))
				.leftJoin(bulkCoupon, eq(purchases.bulkCouponId, bulkCoupon.id))
				.leftJoin(
					redeemedCoupon,
					eq(purchases.redeemedBulkCouponId, redeemedCoupon.id),
				)
				.where(where)
				.orderBy(desc(purchases.createdAt), desc(purchases.id))
				.limit(limit)
				.offset(offset);
			const [totals] = await connection
				.select(aggregate())
				.from(purchases)
				.where(where);
			const byStatus = await connection
				.select({ status: purchases.status, ...aggregate() })
				.from(purchases)
				.where(where)
				.groupBy(purchases.status)
				.orderBy(asc(purchases.status));
			return { purchases: rows, totals: totals!, byStatus };
		},
		async coupons({ productId, limit, offset }) {
			return connection
				.select()
				.from(coupon)
				.where(
					or(
						eq(coupon.restrictedToProductId, productId),
						isNull(coupon.restrictedToProductId),
					),
				)
				.orderBy(desc(coupon.createdAt), desc(coupon.id))
				.limit(limit)
				.offset(offset);
		},
		async discounts(productId) {
			// Match the product's merchant account, not a coupon from another account.
			return connection
				.selectDistinct({
					id: merchantCoupon.id,
					percentageDiscount: merchantCoupon.percentageDiscount,
				})
				.from(merchantCoupon)
				.innerJoin(
					merchantProduct,
					eq(
						merchantProduct.merchantAccountId,
						merchantCoupon.merchantAccountId,
					),
				)
				.where(
					and(
						eq(merchantProduct.productId, productId),
						eq(merchantProduct.status, 1),
						eq(merchantCoupon.status, 1),
						eq(merchantCoupon.type, 'special'),
						isNotNull(merchantCoupon.identifier),
						sql`LENGTH(TRIM(${merchantCoupon.identifier})) > 0`,
					),
				)
				.orderBy(
					asc(merchantCoupon.percentageDiscount),
					asc(merchantCoupon.id),
				);
		},
		async coupon(id, lock = false) {
			const query = connection.select().from(coupon).where(eq(coupon.id, id));
			const rows = await (lock ? query.for('update') : query);
			return rows[0] ?? null;
		},
		async codeExists(code) {
			return Boolean(
				(
					await connection
						.select({ id: coupon.id })
						.from(coupon)
						.where(or(eq(coupon.code, code), eq(coupon.id, code)))
						.limit(1)
				)[0],
			);
		},
		async insertCoupon(row) {
			await connection.insert(coupon).values(row);
		},
		async deactivateCoupon(id, expires) {
			await connection
				.update(coupon)
				.set({ status: 0, expires })
				.where(eq(coupon.id, id));
		},
	};
}
