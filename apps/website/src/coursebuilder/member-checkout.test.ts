import assert from 'node:assert/strict';
import { it } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { formatPricesForProduct } from '@coursebuilder/core';
import { stripeCheckout } from '@coursebuilder/core/pricing/stripe-checkout';
import { decideCheckoutCoupon } from './checkout-coupons.ts';
import { isActiveSupporter } from './supporter-coupons.ts';

const productId = 'product-4gmhd';
const merchants: Record<string, any> = {
	member: {
		id: 'member',
		identifier: 'stripe_member_50',
		type: 'special',
		percentageDiscount: 0.5,
	},
	early: {
		id: 'early',
		identifier: 'stripe_early_40',
		type: 'special',
		percentageDiscount: 0.4,
	},
};
const coupon = {
	id: 'coupon_hw5vh',
	code: 'MEMBER-5E6D28',
	status: 1,
	maxUses: -1,
	usedCount: 0,
	expires: null,
	percentageDiscount: '0.5',
	restrictedToProductId: productId,
	merchantCouponId: 'member',
	merchantCoupon: merchants.member,
};
const adapter: any = {
	couponForIdOrCode: async () => coupon,
	getDefaultCoupon: async () => ({
		defaultCoupon: { id: 'early-site' },
		defaultMerchantCoupon: merchants.early,
	}),
	getProduct: async () => ({
		id: productId,
		name: 'Workshop Ticket',
		type: 'cohort',
		status: 1,
	}),
	getUser: async (id: string) => ({ id, email: 'fixture@example.test' }),
	getMerchantCustomerForUserId: async () => ({ identifier: 'cus_fixture' }),
	getMerchantProductForProductId: async () => ({
		id: 'merchant_product',
		identifier: 'prod_fixture',
	}),
	getMerchantPriceForProductId: async () => ({
		identifier: 'price_fixture_500',
	}),
	getPriceForProduct: async () => ({ unitAmount: 500 }),
	getCoupon: async (id: string) => (id === coupon.id ? coupon : null),
	getMerchantCoupon: async (id: string) => merchants[id],
	getPurchasesForUser: async () => [],
	getMerchantCouponsForTypeAndPercent: async () => [],
	getEntitlementTypeByName: async () => null,
};

it('real CourseBuilder price calculation charges guests/non-supporters $300 and every active tier $250', async () => {
	for (const [user, expected] of [
		[null, 300],
		[{ publicMetadata: {} }, 300],
		[
			{
				publicMetadata: {
					stripe: { status: 'past_due', level: 'Gold Tier Supporter' },
				},
			},
			300,
		],
		...[
			'Bronze Tier Supporter',
			'Silver Tier Supporter',
			'Gold Tier Supporter',
			'Platinum Tier Supporter',
		].map((level) => [
			{ publicMetadata: { stripe: { status: 'active', level } } },
			250,
		]),
	] as const) {
		const decision = await decideCheckoutCoupon({
			productId,
			trustedCountry: 'US',
			requestedPpp: false,
			usedCouponId: coupon.id,
			isSupporter: isActiveSupporter(user),
			adapter,
		});
		const price = await formatPricesForProduct({
			productId,
			country: decision.country,
			quantity: 1,
			autoApplyPPP: false,
			merchantCouponId: decision.couponId,
			usedCouponId: decision.usedCouponId,
			ctx: adapter,
		});
		assert.equal(price.calculatedPrice, expected);

		// Execute the real core checkout through its Stripe network boundary.
		// Assert the exact base price and coupon sent to Stripe, not a duplicate
		// implementation of the checkout arithmetic.
		let session: any;
		const promotions: string[] = [];
		const result = await stripeCheckout({
			params: {
				productId,
				quantity: 1,
				country: decision.country,
				couponId: decision.couponId,
				usedCouponId: decision.usedCouponId,
				...(user && { userId: 'fixture_clerk' }),
			} as any,
			adapter,
			config: {
				baseSuccessUrl: 'https://preview.example',
				cancelUrl: 'https://preview.example/workshops/fixture',
				paymentsAdapter: {
					getPrice: async () => ({ unit_amount: 50000 }),
					getCouponPercentOff: async (id: string) =>
						id === 'stripe_member_50' ? 50 : 40,
					getCouponAmountOff: async () => 0,
					createPromotionCode: async ({ coupon }: { coupon: string }) => {
						promotions.push(coupon);
						return `promo_${coupon}`;
					},
					createCheckoutSession: async (params: any) => {
						session = params;
						return 'https://checkout.stripe.com/c/pay/cs_test_fixture';
					},
				},
			} as any,
		});
		assert.equal(
			result.redirect,
			'https://checkout.stripe.com/c/pay/cs_test_fixture',
		);
		assert.deepEqual(session.line_items, [
			{ price: 'price_fixture_500', quantity: 1 },
		]);
		const expectedCoupon =
			expected === 250 ? 'stripe_member_50' : 'stripe_early_40';
		assert.deepEqual(promotions, [expectedCoupon]);
		assert.deepEqual(session.discounts, [
			{ promotion_code: `promo_${expectedCoupon}` },
		]);
	}
});

it('EGGHEAD40 remains an open coupon for a guest', async () => {
	const openCoupon = {
		...coupon,
		id: 'coupon_egghead',
		code: 'EGGHEAD40',
		percentageDiscount: '0.4',
		merchantCouponId: 'early',
		merchantCoupon: merchants.early,
	};
	const ctx = {
		...adapter,
		couponForIdOrCode: async () => openCoupon,
		getCoupon: async () => openCoupon,
	};
	const decision = await decideCheckoutCoupon({
		productId,
		trustedCountry: 'US',
		requestedPpp: false,
		usedCouponId: openCoupon.id,
		adapter: ctx,
	});
	assert.equal(decision.usedCouponId, openCoupon.id);
	const price = await formatPricesForProduct({
		productId,
		quantity: 1,
		autoApplyPPP: false,
		merchantCouponId: decision.couponId,
		usedCouponId: decision.usedCouponId,
		ctx,
	});
	assert.equal(price.calculatedPrice, 300);
});

it('member HTTP route preserves sign-in return URL and shares ownership/coupon guards with raw checkout', async () => {
	// Replace external IO only; exercise the actual Astro route and coupon policy.
	const dir = await mkdtemp(join(process.cwd(), '.member-checkout-test-'));
	try {
		const outfile = join(dir, 'route.mjs');
		await build({
			stdin: {
				contents: `export { GET, POST } from './src/pages/api/coursebuilder/[...coursebuilder]';`,
				resolveDir: process.cwd(),
				loader: 'ts',
			},
			outfile,
			bundle: true,
			platform: 'node',
			format: 'esm',
			packages: 'external',
			define: { 'import.meta.env.DEV': 'false' },
			plugins: [
				{
					name: 'external-io',
					setup(b) {
						b.onResolve({ filter: /^@coursebuilder\/astro\/server$/ }, () => ({
							path: 'core',
							namespace: 'fixture',
						}));
						b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
							contents: `
					export function Coursebuilder() { return {
						GET: async () => new Response(null, {status: 405}),
						POST: async (ctx) => {
							const url = new URL(ctx.request.url);
							globalThis.memberRequests.push(url);
							if (url.pathname.endsWith('prices-formatted')) return Response.json(await ctx.request.json());
							return new Response(null, { status: 303, headers: { Location: 'https://checkout.stripe.com/c/pay/cs_test_fixture' } });
						}
					}; }`,
							loader: 'ts',
						}));
						b.onLoad({ filter: /src\/db\/index\.ts$/ }, () => ({
							contents:
								'export const courseBuilderAdapter = globalThis.memberAdapter;',
							loader: 'ts',
						}));
						b.onLoad({ filter: /src\/coursebuilder\/users\.ts$/ }, () => ({
							contents:
								'export async function getCourseBuilderUserForClerkUser(user) { return user ? {id: user.id} : null; }',
							loader: 'ts',
						}));
						b.onLoad({ filter: /src\/coursebuilder\/workshops\.ts$/ }, () => ({
							contents: `
					export async function getTicketForProduct() { return { enrollment: {state: 'open'} }; }
					export async function getTicketPurchase(id) { return id === 'owner' ? {id: 'purchase'} : null; }
					export async function resolveCouponCode(code) { return code ? 'coupon_hw5vh' : null; }
				`,
							loader: 'ts',
						}));
						b.onLoad(
							{ filter: /src\/coursebuilder\/stripe-provider\.ts$/ },
							() => ({
								contents: `export const getCommerceBaseUrl = () => 'https://codetv.dev'; export const verifyStripeWebhookSignature = () => false;`,
								loader: 'ts',
							}),
						);
					},
				},
			],
		});
		const globals = globalThis as any;
		globals.memberAdapter = adapter;
		globals.memberRequests = [];
		const route = await import(pathToFileURL(outfile).href);
		const context = (
			path: string,
			user: unknown = null,
			method = 'GET',
			body?: any,
		) => {
			const url = new URL(path, 'https://preview.example');
			return {
				url,
				request: new Request(url, {
					method,
					...(body && { body: JSON.stringify(body) }),
				}),
				locals: { currentUser: async () => user },
				clientAddress: '127.0.0.1',
			};
		};
		const memberPath = `/api/coursebuilder/member-checkout?productId=${productId}`;
		const signedOut = await route.GET(context(memberPath));
		assert.equal(signedOut.status, 303);
		const signIn = new URL(signedOut.headers.get('location'));
		assert.equal(signIn.pathname, '/dashboard/sign-in');
		assert.equal(
			signIn.searchParams.get('redirect_url'),
			`https://preview.example${memberPath}`,
		);
		const nonmember = await route.GET(context(memberPath, { id: 'nonmember' }));
		assert.equal(
			new URL(nonmember.headers.get('location')).searchParams.get('checkout'),
			'supporter-required',
		);
		const active = {
			id: 'supporter',
			publicMetadata: {
				stripe: { status: 'active', level: 'Bronze Tier Supporter' },
			},
		};
		assert.equal((await route.GET(context(memberPath, active))).status, 303);
		assert.equal(
			globals.memberRequests.at(-1).searchParams.get('couponId'),
			'member',
		);
		assert.equal(
			(await route.GET(context(memberPath, { ...active, id: 'owner' }))).headers
				.get('location')
				?.includes('already-purchased'),
			true,
		);
		for (const user of [null, { id: 'nonmember' }]) {
			for (const query of ['usedCouponId=coupon_hw5vh', 'code=MEMBER-5E6D28']) {
				await route.POST(
					context(
						`/api/coursebuilder/checkout/stripe?productId=${productId}&${query}`,
						user,
						'POST',
					),
				);
				const sent = globals.memberRequests.at(-1);
				assert.equal(sent.searchParams.get('couponId'), 'early');
				assert.equal(
					new URL(sent.searchParams.get('cancelUrl')).searchParams.get(
						'checkout',
					),
					'supporter-required',
				);
			}
		}
		const price = await route.POST(
			context('/api/coursebuilder/prices-formatted', null, 'POST', {
				productId,
				couponId: coupon.id,
			}),
		);
		const json = await price.json();
		assert.equal(json.couponId, undefined);
		assert.equal(json.checkoutNotice, 'supporter-required');
		assert.equal(price.headers.get('cache-control'), 'private, no-store');
		const memberPrice = await route.POST(
			context('/api/coursebuilder/prices-formatted', active, 'POST', {
				productId,
				couponId: coupon.id,
			}),
		);
		assert.equal((await memberPrice.json()).memberCheckoutUrl, memberPath);
		delete globals.memberAdapter;
		delete globals.memberRequests;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
