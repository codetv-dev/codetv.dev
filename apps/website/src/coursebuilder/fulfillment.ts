import type { CourseBuilderConfig } from '@coursebuilder/core';
import type { CourseBuilderAdapter } from '@coursebuilder/core/adapters';
import { NEW_PURCHASE_CREATED_EVENT } from '@coursebuilder/core/inngest/commerce/event-new-purchase-created';
import {
	STRIPE_CHECKOUT_SESSION_COMPLETED_EVENT,
	stripeCheckoutSessionComplete,
} from '@coursebuilder/core/inngest/stripe/event-checkout-session-completed';
import type { PaymentsProviderConfig } from '@coursebuilder/core/types';
import { workshopKit } from './kit-workshops.ts';
import { workshopMarketing } from './workshop-interest.ts';

/**
 * In-process stand-in for the Inngest client that CourseBuilder core expects
 * at `options.inngest`.
 *
 * Core's Stripe webhook does not write purchases itself. It sends
 * `stripe/checkout-session-completed` to Inngest, and an Inngest function
 * (`stripeCheckoutSessionComplete`) records the MerchantCharge, MerchantSession
 * and Purchase. CodeTV's Inngest app lives in `apps/workflows` and has no access
 * to the CourseBuilder database, so for the first Cohort we run that same core
 * handler inline, inside the webhook request.
 *
 * - If fulfillment throws, the webhook responds non-2xx and Stripe retries.
 * - `createMerchantChargeAndPurchase` is idempotent on the Stripe charge, so a
 *   retried delivery returns the existing purchase.
 *
 * TODO: move to a real Inngest function for durable post-purchase retries. Port
 * `ai-hero/apps/ai-hero/src/inngest/functions/post-purchase-workflow.ts` and
 * register core's `stripeCheckoutSessionComplete` with
 * `createInngestMiddleware` instead of this runner.
 */

type CommerceEvent = {
	name: string;
	data?: Record<string, any>;
	user?: unknown;
};

type InlineCommerceContext = {
	getAdapter: () => CourseBuilderAdapter;
	getPaymentProvider: () => PaymentsProviderConfig | null;
	siteRootUrl: string;
};

function createInlineStep(dispatch: (event: CommerceEvent) => Promise<void>) {
	return {
		async run<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
			console.info('commerce.fulfillment.step', { step: name });
			return await fn();
		},
		async sendEvent(_id: string, payload: CommerceEvent | CommerceEvent[]) {
			for (const event of Array.isArray(payload) ? payload : [payload]) {
				await dispatch(event);
			}
			return { ids: [] };
		},
	};
}

/**
 * Stripe only emails a receipt when `receipt_email` is set on the
 * PaymentIntent, and this account doesn't send them automatically. Guest
 * checkout means the email is only known once Stripe has collected it, so set
 * it here, after the purchase is recorded.
 *
 * - Skips when the PaymentIntent already has `receipt_email` (webhook retry,
 *   or an email set at session creation) so the buyer gets one receipt.
 * - Never throws: the ticket matters more than the receipt.
 */
async function sendReceipt(
	paymentProvider: PaymentsProviderConfig,
	session: Record<string, any> | undefined,
) {
	const checkoutSessionId = session?.id;
	const email = session?.customer_details?.email;
	try {
		if (!session?.payment_intent || !email) return;
		const adapter = paymentProvider.options.paymentsAdapter as any;
		const paymentIntentId =
			typeof session.payment_intent === 'string'
				? session.payment_intent
				: session.payment_intent.id;
		const paymentIntent =
			await adapter.stripe.paymentIntents.retrieve(paymentIntentId);
		if (paymentIntent.receipt_email) return;
		await adapter.stripe.paymentIntents.update(paymentIntentId, {
			receipt_email: email,
		});
	} catch (error) {
		console.error('commerce.receipt.failed', {
			checkoutSessionId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function createInlineCommerceEvents(context: InlineCommerceContext) {
	async function dispatch(event: CommerceEvent): Promise<void> {
		switch (event.name) {
			case STRIPE_CHECKOUT_SESSION_COMPLETED_EVENT: {
				const mode = event.data?.stripeEvent?.data?.object?.mode;
				// Mirrors the Inngest trigger: only one-time payments create purchases.
				if (mode !== 'payment') {
					console.info('commerce.fulfillment.skipped', {
						event: event.name,
						mode,
						reason: 'not-a-one-time-payment',
					});
					return;
				}

				const paymentProvider = context.getPaymentProvider();
				if (!paymentProvider) {
					throw new Error(
						'Stripe provider is not configured for CourseBuilder',
					);
				}

				const result = (await stripeCheckoutSessionComplete.handler({
					event,
					step: createInlineStep(dispatch),
					db: context.getAdapter(),
					siteRootUrl: context.siteRootUrl,
					paymentProvider,
					emailProvider: undefined,
					getAuthConfig: () => ({}),
				} as any)) as { txnId?: string; purchase?: { id: string } } | undefined;

				await sendReceipt(
					paymentProvider,
					event.data?.stripeEvent?.data?.object,
				);

				console.info('commerce.fulfillment.completed', {
					txnId: result?.txnId,
					purchaseId: result?.purchase?.id,
					checkoutSessionId: event.data?.stripeEvent?.data?.object?.id,
				});
				return;
			}
			case NEW_PURCHASE_CREATED_EVENT:
				try {
					const adapter = context.getAdapter();
					const purchase = await adapter.getPurchase(event.data?.purchaseId);
					if (!purchase) throw new Error('Purchase not found for Kit sync');
					const product = await adapter.getProduct(purchase.productId);
					const config =
						workshopMarketing[
							purchase.productId as keyof typeof workshopMarketing
						];
					if (
						!config &&
						product?.type !== 'cohort' &&
						product?.type !== 'workshop'
					)
						return;
					const user = await adapter.getUserById(purchase.userId);
					const slug = config?.productSlug ?? product?.fields?.slug;
					if (!user?.email || !slug)
						throw new Error('Buyer email or workshop slug missing');
					await workshopKit().purchase({
						email: user.email,
						productId: purchase.productId,
						slug,
						purchasedAt: new Date(purchase.createdAt),
					});
				} catch (error) {
					// The ticket matters more than the tag. Never send welcome mail here.
					console.error('commerce.kit-sync.failed', {
						purchaseId: event.data?.purchaseId,
						error: error instanceof Error ? error.message : String(error),
					});
				}
				console.info('commerce.purchase.created', {
					txnId: event.data?.txnId,
					purchaseId: event.data?.purchaseId,
					checkoutSessionId: event.data?.checkoutSessionId,
					productType: event.data?.productType,
				});
				return;
			default:
				console.info('commerce.event.unhandled', { event: event.name });
		}
	}

	const client = {
		async send(payload: CommerceEvent | CommerceEvent[]) {
			for (const event of Array.isArray(payload) ? payload : [payload]) {
				await dispatch(event);
			}
			return { ids: [] };
		},
	};

	return client as unknown as NonNullable<CourseBuilderConfig['inngest']>;
}
