import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	decideCheckoutCoupon,
	getValidSiteCoupon,
} from './checkout-coupons.ts';

const productId = 'product-ticket';
const now = new Date('2026-10-20T00:00:00.000Z');

const merchantCoupons = {
	ppp60: { id: 'mc_ppp_60', type: 'ppp', percentageDiscount: 0.6 },
	special40: { id: 'mc_special_40', type: 'special', percentageDiscount: 0.4 },
	special50: { id: 'mc_special_50', type: 'special', percentageDiscount: 0.5 },
	special25: { id: 'mc_special_25', type: 'special', percentageDiscount: 0.25 },
};

type SiteCoupon = {
	id: string;
	status: number;
	maxUses: number;
	usedCount: number;
	expires: Date | null;
	percentageDiscount: string;
	restrictedToProductId: string | null;
	merchantCoupon: { id: string; percentageDiscount: number };
};

function siteCoupon(overrides: Partial<SiteCoupon> = {}): SiteCoupon {
	return {
		id: 'coupon_member',
		status: 1,
		maxUses: -1,
		usedCount: 0,
		expires: null,
		percentageDiscount: '0.5',
		restrictedToProductId: productId,
		merchantCoupon: merchantCoupons.special50,
		...overrides,
	};
}

function adapter({
	coupons = {} as Record<string, SiteCoupon>,
	defaultCoupon = null as null | {
		merchant: { id: string; percentageDiscount: number };
	},
} = {}) {
	return {
		getMerchantCouponForTypeAndPercent: async ({
			type,
			percentageDiscount,
		}: {
			type: string;
			percentageDiscount: number;
		}) =>
			type === 'ppp' && percentageDiscount === 0.6
				? merchantCoupons.ppp60
				: null,
		couponForIdOrCode: async ({ couponId }: { couponId?: string | null }) =>
			(couponId && coupons[couponId]) || null,
		getDefaultCoupon: async () =>
			defaultCoupon
				? {
						defaultMerchantCoupon: defaultCoupon.merchant,
						defaultCoupon: { id: 'coupon_early_bird' },
					}
				: null,
	} as any;
}

describe('decideCheckoutCoupon', () => {
	it('applies PPP only when the buyer opted in and the trusted country qualifies', async () => {
		// Poland qualifies for 60% off in CourseBuilder's PPP table.
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'PL',
			requestedPpp: true,
			adapter: adapter(),
		});

		assert.deepEqual(decision, {
			country: 'PL',
			couponId: 'mc_ppp_60',
			reason: 'ppp',
		});
	});

	it('never auto-applies PPP: no opt-in means the country is pinned to US', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'IN',
			requestedPpp: false,
			adapter: adapter(),
		});

		assert.deepEqual(decision, { country: 'US', reason: 'none' });
	});

	it('ignores a PPP opt-in from a country without PPP', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: true,
			adapter: adapter(),
		});

		assert.equal(decision.couponId, undefined);
		assert.equal(decision.country, 'US');
	});

	it('uses the early bird default coupon when there is no code', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: false,
			adapter: adapter({
				defaultCoupon: { merchant: merchantCoupons.special40 },
			}),
		});

		assert.deepEqual(decision, {
			country: 'US',
			couponId: 'mc_special_40',
			usedCouponId: 'coupon_early_bird',
			reason: 'default-coupon',
		});
	});

	it('uses a ?code= coupon when it beats the default', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: false,
			usedCouponId: 'coupon_member',
			adapter: adapter({
				coupons: { coupon_member: siteCoupon() },
				defaultCoupon: { merchant: merchantCoupons.special40 },
			}),
			now,
		});

		assert.equal(decision.couponId, 'mc_special_50');
		assert.equal(decision.usedCouponId, 'coupon_member');
		assert.equal(decision.reason, 'site-coupon');
	});

	it('keeps the default when the code is worse', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: false,
			usedCouponId: 'coupon_small',
			adapter: adapter({
				coupons: {
					coupon_small: siteCoupon({
						id: 'coupon_small',
						percentageDiscount: '0.25',
						merchantCoupon: merchantCoupons.special25,
					}),
				},
				defaultCoupon: { merchant: merchantCoupons.special40 },
			}),
			now,
		});

		assert.equal(decision.couponId, 'mc_special_40');
		assert.equal(decision.reason, 'default-coupon');
	});

	it('drops an unknown coupon id instead of trusting it', async () => {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: false,
			usedCouponId: 'mc_ppp_60',
			adapter: adapter(),
			now,
		});

		assert.deepEqual(decision, { country: 'US', reason: 'none' });
	});
});

describe('getValidSiteCoupon', () => {
	const check = (coupon: SiteCoupon) =>
		getValidSiteCoupon(
			coupon.id,
			productId,
			adapter({ coupons: { [coupon.id]: coupon } }),
			now,
		);

	it('accepts an active coupon for this product', async () => {
		assert.equal((await check(siteCoupon()))?.id, 'coupon_member');
	});

	it('rejects a coupon restricted to another product', async () => {
		assert.equal(
			await check(siteCoupon({ restrictedToProductId: 'product-other' })),
			null,
		);
	});

	it('rejects an expired coupon', async () => {
		assert.equal(
			await check(
				siteCoupon({ expires: new Date('2026-10-01T00:00:00.000Z') }),
			),
			null,
		);
	});

	it('rejects a used-up coupon', async () => {
		assert.equal(await check(siteCoupon({ maxUses: 5, usedCount: 5 })), null);
	});

	it('rejects an inactive coupon', async () => {
		assert.equal(await check(siteCoupon({ status: 0 })), null);
	});

	it('rejects 100% Team Claim Link coupons (they redeem, not check out)', async () => {
		assert.equal(await check(siteCoupon({ percentageDiscount: '1' })), null);
	});
});
