import { isAfter } from 'date-fns';

import type { CourseBuilderAdapter } from '@coursebuilder/core/adapters';
import { getPPPDiscountPercent } from '@coursebuilder/core/pricing/parity-coupon';

/**
 * Server-side coupon decisions for Workshop Ticket pricing and checkout.
 *
 * CourseBuilder core 1.2.1 trusts whatever merchant `couponId` reaches
 * checkout and mints a Stripe promotion code from it, and it auto-applies PPP
 * from the query country. So the browser never sends merchant coupon ids:
 * it sends the site coupon it was given (`usedCouponId`, from `?code=`) and
 * whether the buyer opted into PPP. Everything else is decided here.
 *
 * The adapter is passed in so `node --test` can exercise this without a DB.
 */

export type CouponAdapter = Pick<
	CourseBuilderAdapter,
	| 'getMerchantCouponForTypeAndPercent'
	| 'couponForIdOrCode'
	| 'getDefaultCoupon'
>;

/** Country pinned at checkout when the buyer did not opt into PPP. */
export const NON_PPP_COUNTRY = 'US';

/** The PPP merchant coupon for a country, when that country qualifies. */
export async function getPppMerchantCoupon(
	country: string,
	adapter: CouponAdapter,
) {
	const percentageDiscount = getPPPDiscountPercent(country);
	if (percentageDiscount <= 0) return null;

	return adapter.getMerchantCouponForTypeAndPercent({
		type: 'ppp',
		percentageDiscount,
	});
}

/** A site coupon from `?code=` that is usable for this product right now. */
export async function getValidSiteCoupon(
	couponId: string | null | undefined,
	productId: string,
	adapter: CouponAdapter,
	now = new Date(),
) {
	if (!couponId) return null;

	const coupon = await adapter.couponForIdOrCode({ couponId });
	if (!coupon || coupon.status !== 1) return null;
	if (
		coupon.restrictedToProductId &&
		coupon.restrictedToProductId !== productId
	)
		return null;
	if (coupon.maxUses !== -1 && coupon.usedCount >= coupon.maxUses) return null;
	if (coupon.expires && isAfter(now, coupon.expires)) return null;
	// 100% bulk coupons are Team Claim Links, which redeem instead of checking out.
	if (Number(coupon.percentageDiscount) >= 1) return null;

	return coupon;
}

function discountOf(
	coupon: { percentageDiscount?: unknown } | null | undefined,
) {
	return Number(coupon?.percentageDiscount ?? 0);
}

export type CheckoutCouponDecision = {
	country: string;
	couponId?: string;
	usedCouponId?: string;
	reason: 'ppp' | 'site-coupon' | 'default-coupon' | 'none';
};

/**
 * Decide the merchant coupon and country checkout should use.
 *
 * - PPP only when the buyer opted in and the trusted country qualifies.
 * - Otherwise the better of the product's default coupon (early bird) and a
 *   valid `?code=` coupon, priced as a US buyer so PPP is never auto-applied.
 */
export async function decideCheckoutCoupon({
	productId,
	trustedCountry,
	requestedPpp,
	usedCouponId,
	adapter,
	now,
}: {
	productId: string;
	trustedCountry: string;
	requestedPpp: boolean;
	usedCouponId?: string | null;
	adapter: CouponAdapter;
	now?: Date;
}): Promise<CheckoutCouponDecision> {
	if (requestedPpp) {
		const pppCoupon = await getPppMerchantCoupon(trustedCountry, adapter);
		if (pppCoupon) {
			return {
				country: trustedCountry,
				couponId: pppCoupon.id,
				reason: 'ppp',
			};
		}
	}

	const [siteCoupon, defaults] = await Promise.all([
		getValidSiteCoupon(usedCouponId, productId, adapter, now),
		adapter.getDefaultCoupon([productId]),
	]);

	const siteMerchantCoupon = siteCoupon?.merchantCoupon ?? null;
	const defaultMerchantCoupon = defaults?.defaultMerchantCoupon ?? null;

	if (
		siteCoupon &&
		siteMerchantCoupon &&
		discountOf(siteMerchantCoupon) >= discountOf(defaultMerchantCoupon)
	) {
		return {
			country: NON_PPP_COUNTRY,
			couponId: siteMerchantCoupon.id,
			usedCouponId: siteCoupon.id,
			reason: 'site-coupon',
		};
	}

	if (defaults?.defaultMerchantCoupon) {
		return {
			country: NON_PPP_COUNTRY,
			couponId: defaults.defaultMerchantCoupon.id,
			usedCouponId: defaults.defaultCoupon.id,
			reason: 'default-coupon',
		};
	}

	return { country: NON_PPP_COUNTRY, reason: 'none' };
}
