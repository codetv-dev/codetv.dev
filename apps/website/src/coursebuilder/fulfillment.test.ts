import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInlineCommerceEvents } from './fulfillment.ts';

/**
 * Runs CourseBuilder core's real `stripeCheckoutSessionComplete` handler
 * through the inline runner, with a fake adapter and a fake Stripe session.
 */

const checkoutSessionId = 'cs_test_a1b2c3';

function checkoutSessionCompletedEvent(mode: 'payment' | 'subscription') {
	return {
		id: 'evt_test_1',
		created: 1_760_000_000,
		type: 'checkout.session.completed',
		data: {
			object: {
				id: checkoutSessionId,
				object: 'checkout.session',
				amount_subtotal: 50_000,
				amount_total: 30_000,
				created: 1_760_000_000,
				currency: 'usd',
				custom_fields: [],
				customer: 'cus_test_1',
				customer_details: {
					address: {
						city: null,
						country: 'US',
						line1: null,
						line2: null,
						postal_code: '97201',
						state: null,
					},
					email: 'viewer@example.com',
					name: 'Test Viewer',
				},
				livemode: false,
				metadata: { productId: 'product-ticket', userId: 'user_1' },
				mode,
				payment_intent: mode === 'payment' ? 'pi_test_1' : null,
				subscription: mode === 'payment' ? null : 'sub_test_1',
				payment_method_collection: 'always',
				payment_status: 'paid',
				phone_number_collection: { enabled: false },
				status: 'complete',
				success_url: 'https://codetv.dev/thanks/purchase',
				total_details: {
					amount_discount: 20_000,
					amount_shipping: 0,
					amount_tax: 0,
				},
			},
		},
	};
}

function fakeStripeCheckoutSession() {
	return {
		id: checkoutSessionId,
		customer: {
			id: 'cus_test_1',
			email: 'viewer@example.com',
			name: 'Test Viewer',
		},
		line_items: {
			data: [
				{
					quantity: 1,
					price: {
						product: { id: 'prod_stripe_ticket', name: 'Workshop Ticket' },
					},
					discounts: [{ discount: { coupon: { id: 'stripe_coupon_40' } } }],
				},
			],
		},
		payment_intent: {
			id: 'pi_test_1',
			latest_charge: { id: 'ch_test_1', amount: 30_000 },
		},
		metadata: { country: 'US', usedCouponId: 'coupon_early_bird' },
		amount_total: 30_000,
	};
}

function setup() {
	const calls: Record<string, unknown[]> = {};
	const record = (name: string, value: unknown) => {
		(calls[name] ??= []).push(value);
	};
	const user = {
		id: 'user_1',
		email: 'viewer@example.com',
		name: 'Test Viewer',
	};

	const adapter = {
		getMerchantAccount: async () => ({ id: 'ctv-stripe-merchant-account' }),
		getUserByEmail: async () => user,
		getPurchaseForStripeCharge: async () => null,
		getPurchasesForUser: async () => [],
		findOrCreateUser: async (email: string) => {
			record('findOrCreateUser', email);
			return { user, isNewUser: false };
		},
		getMerchantProduct: async (identifier: string) => {
			record('getMerchantProduct', identifier);
			return { id: 'mproduct_1', productId: 'product-ticket' };
		},
		findOrCreateMerchantCustomer: async (options: unknown) => {
			record('findOrCreateMerchantCustomer', options);
			return { id: 'mcustomer_1' };
		},
		getProduct: async () => ({
			id: 'product-ticket',
			name: 'Workshop Ticket',
			type: 'cohort',
		}),
		createMerchantChargeAndPurchase: async (
			options: Record<string, unknown>,
		) => {
			record('createMerchantChargeAndPurchase', options);
			return { id: 'purch_1', status: 'Valid', productId: 'product-ticket' };
		},
	};

	const paymentProvider = {
		options: {
			paymentsAdapter: {
				getCheckoutSession: async (id: string) => {
					record('getCheckoutSession', id);
					return fakeStripeCheckoutSession();
				},
			},
		},
	};

	const events = createInlineCommerceEvents({
		getAdapter: () => adapter as any,
		getPaymentProvider: () => paymentProvider as any,
		siteRootUrl: 'https://codetv.dev',
	});

	return { events, calls };
}

describe('createInlineCommerceEvents', () => {
	it('records the purchase inline when Stripe reports a completed checkout', async () => {
		const { events, calls } = setup();

		await events.send({
			name: 'stripe/checkout-session-completed',
			data: {
				txnId: 'txn_1',
				stripeEvent: checkoutSessionCompletedEvent('payment'),
			},
		});

		assert.deepEqual(calls.getCheckoutSession, [checkoutSessionId]);
		assert.deepEqual(calls.findOrCreateUser, ['viewer@example.com']);
		assert.deepEqual(calls.getMerchantProduct, ['prod_stripe_ticket']);

		const [purchase] = calls.createMerchantChargeAndPurchase as Array<
			Record<string, unknown>
		>;
		assert.equal(purchase.userId, 'user_1');
		assert.equal(purchase.productId, 'product-ticket');
		assert.equal(purchase.stripeChargeId, 'ch_test_1');
		assert.equal(purchase.stripeChargeAmount, 30_000);
		assert.equal(purchase.stripeCouponId, 'stripe_coupon_40');
		assert.equal(purchase.checkoutSessionId, checkoutSessionId);
		assert.equal(purchase.usedCouponId, 'coupon_early_bird');
		assert.equal(purchase.quantity, 1);
	});

	it('ignores subscription checkouts, like the Inngest trigger does', async () => {
		const { events, calls } = setup();

		await events.send({
			name: 'stripe/checkout-session-completed',
			data: { stripeEvent: checkoutSessionCompletedEvent('subscription') },
		});

		assert.equal(calls.createMerchantChargeAndPurchase, undefined);
	});

	it('propagates fulfillment failures so the webhook fails and Stripe retries', async () => {
		const { events } = setup();
		const failing = createInlineCommerceEvents({
			getAdapter: () =>
				({
					getMerchantAccount: async () => {
						throw new Error('database unavailable');
					},
				}) as any,
			getPaymentProvider: () => ({ options: { paymentsAdapter: {} } }) as any,
			siteRootUrl: 'https://codetv.dev',
		});

		await assert.rejects(
			failing.send({
				name: 'stripe/checkout-session-completed',
				data: { stripeEvent: checkoutSessionCompletedEvent('payment') },
			}),
			/database unavailable/,
		);
		// The happy-path runner is unaffected.
		assert.ok(events);
	});

	it('logs events it does not handle instead of throwing', async () => {
		const { events } = setup();

		await events.send({ name: 'commerce/purchase-status-updated', data: {} });
	});
});
