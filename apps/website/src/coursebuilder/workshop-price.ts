import { formatPricesForProduct } from '@coursebuilder/core';

import { courseBuilderAdapter } from '../db';

/** Same default-coupon selection and formatter used by prices-formatted.
 * No viewer, code or PPP is applied to the first-paint price.
 */
export async function getDefaultWorkshopPrice(productId: string) {
	const defaults = await courseBuilderAdapter.getDefaultCoupon([productId]);
	const formatted = await formatPricesForProduct({
		productId,
		quantity: 1,
		country: 'US',
		autoApplyPPP: false,
		merchantCouponId: defaults?.defaultMerchantCoupon?.id,
		usedCouponId: defaults?.defaultCoupon?.id,
		ctx: courseBuilderAdapter,
	});
	// Only serialize the display fields, not the product/resource graph.
	return {
		unitPrice: formatted.unitPrice,
		fullPrice: formatted.fullPrice,
		calculatedPrice: formatted.calculatedPrice,
		appliedMerchantCoupon: formatted.appliedMerchantCoupon
			? (defaults?.defaultMerchantCoupon ?? undefined)
			: undefined,
		appliedDiscountType: formatted.appliedDiscountType,
		appliedCouponLabel: formatted.appliedCouponLabel,
		usedCouponId: formatted.usedCouponId,
	};
}
