import type { CourseBuilderConfig } from '@coursebuilder/core';
import type { CourseBuilderAdapter } from '@coursebuilder/core/adapters';
import { NEW_PURCHASE_CREATED_EVENT } from '@coursebuilder/core/inngest/commerce/event-new-purchase-created';
import {
	STRIPE_CHECKOUT_SESSION_COMPLETED_EVENT,
	stripeCheckoutSessionComplete,
} from '@coursebuilder/core/inngest/stripe/event-checkout-session-completed';
import type { PaymentsProviderConfig } from '@coursebuilder/core/types';

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
 * TODO: move to a real Inngest function when post-purchase work lands
 * (emails, Discord role, Kit sync). Port
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

				console.info('commerce.fulfillment.completed', {
					txnId: result?.txnId,
					purchaseId: result?.purchase?.id,
					checkoutSessionId: event.data?.stripeEvent?.data?.object?.id,
				});
				return;
			}
			case NEW_PURCHASE_CREATED_EVENT:
				// TODO: post-purchase email, Discord role and Kit sync. Port
				// ai-hero/apps/ai-hero/src/inngest/functions/post-purchase-workflow.ts.
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
