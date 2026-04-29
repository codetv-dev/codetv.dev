import StripeProvider, {
	StripePaymentAdapter,
} from '@coursebuilder/core/providers/stripe';

const baseUrl =
	process.env.COURSEBUILDER_URL ??
	process.env.PUBLIC_SITE_URL ??
	process.env.URL ??
	'http://localhost:4321';

export function getStripeProvider() {
	const stripeToken =
		process.env.COURSEBUILDER_STRIPE_SECRET_TOKEN ??
		process.env.COURSEBUILDER_STRIPE_SECRET_KEY ??
		process.env.STRIPE_SECRET_TOKEN ??
		process.env.STRIPE_SECRET_KEY;
	const stripeWebhookSecret =
		process.env.COURSEBUILDER_STRIPE_WEBHOOK_SECRET ??
		process.env.STRIPE_WEBHOOK_SECRET;

	if (!stripeToken || !stripeWebhookSecret) return null;

	return StripeProvider({
		errorRedirectUrl: baseUrl,
		baseSuccessUrl: baseUrl,
		cancelUrl: baseUrl,
		paymentsAdapter: new StripePaymentAdapter({
			stripeToken,
			stripeWebhookSecret,
		}),
	});
}
