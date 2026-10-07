import { courseBuilderAdapter } from '../db';
import type { CheckoutStatus } from './purchase-polling';
import { getStripeProvider } from './stripe-provider';
import { getWorkshopPathForProduct } from './workshops';

export type CheckoutStatusWithLinks = CheckoutStatus & {
	workshopPath?: string | null;
};

const CHECKOUT_SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]+$/;

export function isCheckoutSessionId(value: string | null | undefined) {
	return Boolean(value && CHECKOUT_SESSION_ID.test(value));
}

/**
 * Purchase Processing status for a Stripe Checkout Session.
 *
 * The verified purchase row is the source of truth. Until it exists, Stripe's
 * own session state is used only to reassure the buyer (or to tell them the
 * payment didn't go through).
 */
export async function getCheckoutStatus(
	sessionId: string,
): Promise<CheckoutStatusWithLinks> {
	if (!isCheckoutSessionId(sessionId)) {
		return { status: 'error', message: 'Unknown checkout session.' };
	}

	try {
		return await lookupCheckoutStatus(sessionId);
	} catch (error) {
		// The buyer has just paid; keep them in Purchase Processing and retry.
		console.error('checkout-status.lookup-failed', {
			sessionId,
			error: error instanceof Error ? error.message : String(error),
		});
		return { status: 'processing', paymentStatus: null };
	}
}

async function lookupCheckoutStatus(
	sessionId: string,
): Promise<CheckoutStatusWithLinks> {
	const purchase =
		await courseBuilderAdapter.getPurchaseByCheckoutSessionId(sessionId);

	if (purchase) {
		const product = await courseBuilderAdapter.getProduct(
			purchase.productId,
			false,
		);

		return {
			status: 'ready',
			purchaseId: purchase.id,
			productName: product?.name ?? null,
			purchaseStatus: purchase.status,
			workshopPath: await getWorkshopPathForProduct(purchase.productId),
		};
	}

	const stripeProvider = getStripeProvider();
	if (!stripeProvider) {
		return { status: 'processing', paymentStatus: null };
	}

	try {
		const session =
			await stripeProvider.options.paymentsAdapter.getCheckoutSession(
				sessionId,
			);

		// `open` means the buyer never finished checkout; `complete` + `unpaid`
		// is an async payment still settling, so keep reassuring.
		if (session.status === 'expired' || session.status === 'open') {
			return { status: 'not-paid', paymentStatus: session.payment_status };
		}

		return { status: 'processing', paymentStatus: session.payment_status };
	} catch (error) {
		console.warn('checkout-status.stripe-lookup-failed', {
			sessionId,
			error: error instanceof Error ? error.message : String(error),
		});
		return { status: 'processing', paymentStatus: null };
	}
}
