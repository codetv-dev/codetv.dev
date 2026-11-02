import { randomUUID } from 'node:crypto';
import { getAbility, type AbilityUser } from './ability-rules';
import { ContentError } from './content-contract';
import type { CommerceOperations } from './commerce-contract';
import type { CommerceStore } from './commerce-store';

export function createCommerceService(
	store: CommerceStore,
	user: AbilityUser,
): CommerceOperations {
	async function product(s: CommerceStore, id: string, lock = false) {
		if (getAbility({ user }).cannot('manage', 'all'))
			throw new ContentError(
				404,
				'Sales and coupons require an admin.',
				'Ask an admin to perform this operation.',
			);
		const row = await s.product(id, lock);
		if (!row)
			throw new ContentError(
				404,
				'The product does not exist.',
				'Use an existing Course Builder product id, not a workshop id.',
			);
		return row;
	}
	const availableFractions = (
		rows: Awaited<ReturnType<CommerceStore['discounts']>>,
	) =>
		[
			...new Set(
				rows
					.map((r) => Number(r.percentageDiscount))
					.filter((n) => n > 0 && n < 1),
			),
		].sort((a, b) => a - b);
	return {
		async list_sales(input) {
			return store.transaction(async (tx) => {
				const item = await product(tx, input.productId);
				const result = await tx.sales(input);
				return {
					product: item,
					...result,
					nextOffset:
						input.offset + result.purchases.length < result.totals.purchaseCount
							? input.offset + result.purchases.length
							: null,
					amountSource: 'Purchase.totalAmount',
					amountUnit: 'stored major units',
					currency: null,
					note: 'Amounts are recorded purchase values, not reconciled Stripe revenue. Totals cover all matching purchases, not just this page. Status totals are separate; refunds are not subtracted or inferred. Currency is not persisted on Purchase rows.',
				};
			});
		},
		async list_coupons(input) {
			return store.transaction(async (tx) => {
				const item = await product(tx, input.productId);
				const rows = await tx.coupons(input);
				return {
					product: item,
					coupons: rows.map((row) => ({
						...row,
						scope:
							row.restrictedToProductId === input.productId
								? 'product'
								: 'global',
						kind:
							Number(row.percentageDiscount) === 1 ? 'free-ticket' : 'discount',
					})),
					availableDiscountFractions: availableFractions(
						await tx.discounts(input.productId),
					),
					nextOffset:
						rows.length === input.limit ? input.offset + rows.length : null,
					note: 'Includes product-specific and global codes. Creation is product-specific. Global and default offer changes require separate approval.',
				};
			});
		},
		async create_coupon(input) {
			return store.transaction(async (tx) => {
				const item = await product(tx, input.productId, true);
				const now = new Date();
				const expires = input.expires ? new Date(input.expires) : null;
				if (expires && expires <= now)
					throw new ContentError(
						400,
						'New coupons must expire in the future.',
						'Choose a future expiry or null for no expiry.',
					);
				const code =
					input.code ?? `CTV_${randomUUID().replaceAll('-', '').toUpperCase()}`;
				if (await tx.codeExists(code))
					throw new ContentError(
						409,
						'This code is already in use or conflicts with a coupon id.',
						'Choose a different code.',
					);
				const freeTicket = input.percentageDiscount === 1;
				let merchantCouponId: string | null = null;
				if (!freeTicket) {
					const discounts = await tx.discounts(input.productId);
					const exact = discounts.find(
						(d) => Number(d.percentageDiscount) === input.percentageDiscount,
					);
					if (!exact)
						throw new ContentError(
							409,
							'Checkout could not apply this code without a matching provider discount.',
							`Use an available fraction (${availableFractions(discounts).join(', ') || 'none available'}), or ask an admin or the desk to provision a provider discount at this percentage.`,
							'No active special MerchantCoupon with a provider id matches that percentage.',
						);
					merchantCouponId = exact.id;
				}
				const row = {
					id: `coupon_${randomUUID()}`,
					code,
					restrictedToProductId: input.productId,
					organizationId: item.organizationId,
					createdAt: now,
					expires,
					maxUses: input.maxUses,
					usedCount: 0,
					status: 1,
					default: false,
					percentageDiscount: input.percentageDiscount.toFixed(2),
					amountDiscount: null,
					merchantCouponId,
					fields: { createdById: user.id, createdVia: 'admin-api' },
				};
				try {
					await tx.insertCoupon(row);
				} catch (error) {
					const cause = (error as { cause?: unknown })?.cause ?? error;
					if (
						(cause as { code?: string })?.code === 'ER_DUP_ENTRY' ||
						(cause as { errno?: number })?.errno === 1062
					)
						throw new ContentError(
							409,
							'This code is already in use.',
							'Choose a different code.',
						);
					throw error;
				}
				return {
					coupon: row,
					kind: freeTicket ? 'free-ticket' : 'discount',
					message: freeTicket
						? 'Created a free ticket code. Each redemption gives away a ticket.'
						: 'Created a product-specific discount code using an existing provider discount. No Stripe write or product price change was made.',
				};
			});
		},
		async deactivate_coupon(input) {
			return store.transaction(async (tx) => {
				await product(tx, input.productId, true);
				const row = await tx.coupon(input.id, true);
				if (!row)
					throw new ContentError(
						404,
						'The coupon does not exist.',
						'List coupons for the product and use an existing id.',
					);
				if (row.restrictedToProductId !== input.productId || row.default)
					throw new ContentError(
						409,
						'Global and default offers cannot be changed through this product-scoped operation.',
						'Ask the desk before changing a global offer or product-wide pricing.',
					);
				// Core redemption validates expiry but currently ignores status. Both are
				// necessary; status alone would leave free-seat codes redeemable.
				const cutoff = new Date(Date.now() - 1);
				const expires =
					row.expires && row.expires < cutoff ? row.expires : cutoff;
				await tx.deactivateCoupon(row.id, expires);
				return {
					coupon: { ...row, status: 0, expires },
					message:
						'Code deactivated and expired. Existing purchases and prior redemptions are unchanged.',
				};
			});
		},
	};
}
