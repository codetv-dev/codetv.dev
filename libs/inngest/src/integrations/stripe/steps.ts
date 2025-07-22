import Stripe from 'stripe';
import { inngest } from '../../client.js';
import { NonRetriableError } from 'inngest';
import {
	personGetByClerkId,
	personUpdateSubscription,
} from '../sanity/steps.ts';
import { userSubscriptionUpdate } from '../clerk/steps.ts';
import { messageSend } from '../discord/steps.ts';
import type { InvocationResult } from 'inngest/types';
import { intervalToDuration } from 'date-fns';

if (!process.env.STRIPE_SECRET_KEY) {
	throw new Error('STRIPE_SECRET_KEY must be set in the env');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// TODO verify Stripe webhook signature: https://www.inngest.com/docs/platform/webhooks#verifying-request-signatures
// export const handleStripeSubscriptionChangeWebhook = inngest.createFunction(
// 	{ id: 'stripe/subscription-changed' },
// 	[{ event: 'stripe/checkout.session.completed'},{ event: 'stripe/customer.subscription.updated'},{ event: 'stripe/customer.subscription.deleted'}],
// 	async ({ event, step }) => {
// 		/**
// 		 * TODO Inngest doesn't support webhook signature validation yet
// 		 * @see https://www.inngest.com/docs/platform/webhooks#advanced-configuration
// 		 */
// 		// const { type, data } = await step.run('validate-stripe-webhook-signature', async () => {
// 		// 	return validateWebhookSignature(event)
// 		// });
// 	},
// )

export const retrieveStripeSubscription = inngest.createFunction(
	{ id: 'stripe/subscription.get' },
	{ event: 'stripe/subscription.get' },
	async function ({ event, step }): Promise<Stripe.Subscription> {
		return step.run('stripe/retrieve-subscription', async () => {
			return stripe.subscriptions.retrieve(event.data.subscriptionId);
		});
	},
);

export const retrieveStripeProduct = inngest.createFunction(
	{ id: 'stripe/product.get' },
	{ event: 'stripe/product.get' },
	async function ({ event, step }): Promise<Stripe.Product> {
		return step.run('stripe/retrieve-product', async () => {
			if (!event.data.productId) {
				throw new NonRetriableError('No product ID found');
			}

			return stripe.products.retrieve(event.data.productId);
		});
	},
);

export const handleWebhookStripeSubscriptionCompleted = inngest.createFunction(
	{ id: 'stripe/subscription.changed' },
	{ event: 'stripe/checkout.session.completed' },
	async ({ event, step }) => {
		try {
			const data = event.data;
			const userId = data.object.metadata?.userId as string;

			const subscription = await step.invoke('stripe/retrieve-subscription', {
				function: retrieveStripeSubscription,
				data: {
					subscriptionId: data.object.subscription,
				},
			});

			const productPromise = step.invoke('stripe/retrieve-product', {
				function: retrieveStripeProduct,
				data: {
					productId: subscription.items.data.at(0)?.plan?.product as string,
				},
			});

			const userPromise = step.invoke('check-for-existing-user', {
				function: personGetByClerkId,
				data: {
					clerkUserId: userId,
				},
			});

			const metadataPromise = step.run('stripe/update-metadata', async () => {
				return stripe.customers.update(subscription.customer as string, {
					metadata: {
						userId: userId,
					},
				});
			});

			const [product, user] = await Promise.all([
				productPromise,
				userPromise,
				metadataPromise,
			]);

			if (!user) {
				throw new NonRetriableError('no user found');
			}

			const clerkUpdatePromise = step.invoke('clerk-update-user-subscription', {
				function: userSubscriptionUpdate,
				data: {
					clerkUserId: userId,
					stripeCustomerId: subscription.customer as string,
					subscriptionStatus: subscription.status,
					productName: product.name,
				},
			});

			const sanityUpdatePromise = step.invoke(
				'sanity-update-person-subscription',
				{
					function: personUpdateSubscription,
					data: {
						sanityUserId: user._id,
						stripeCustomerId: subscription.customer as string,
						subscriptionStatus: subscription.status,
						productName: product.name,
					},
				},
			);

			const n = user.name;
			const p = product.name;
			const s = subscription.status;

			let message = `New supporter! ${n} joined as a ${p} (${s})`;
			if (event.data.object.cancel_at_period_end) {
				message = `${n} canceled their ${p} subscription`;
			}

			const messagePromise = step.invoke('discord-send-message', {
				function: messageSend,
				data: {
					message,
				},
			});

			await Promise.all([
				clerkUpdatePromise,
				sanityUpdatePromise,
				messagePromise,
			]);
		} catch (err) {
			await step.invoke('discord-send-message', {
				function: messageSend,
				data: {
					message:
						'Failed Inngest run:\n```' + JSON.stringify(err, null, 2) + '```',
				},
			});
		}
	},
);

export const handleStripeSubscriptionUpdatedWebhook = inngest.createFunction(
	{ id: 'stripe/subscription.updated' },
	[
		{ event: 'stripe/customer.subscription.updated' },
		{ event: 'stripe/customer.subscription.deleted' },
	],
	async ({ event, step }) => {
		try {
			const data = event.data;

			const subscription = await step.invoke('stripe/subscription.get', {
				function: retrieveStripeSubscription,
				data: {
					subscriptionId: data.object.id,
				},
			});

			const customerPromise = step.run('stripe/customer.get', async () => {
				return stripe.customers.retrieve(subscription.customer as string);
			}) as InvocationResult<Stripe.Customer>;

			const productPromise = step.invoke('stripe/product.get', {
				function: retrieveStripeProduct,
				data: {
					productId: subscription.items.data.at(0)?.plan?.product as string,
				},
			});

			const [customer, product] = await Promise.all([
				customerPromise,
				productPromise,
			]);

			if (!customer) {
				throw new NonRetriableError('No customer found');
			}

			const personPromise = step.invoke('get-sanity-person', {
				function: personGetByClerkId,
				data: {
					clerkUserId: customer.metadata.userId,
				},
			});

			const clerkPromise = step.invoke('update-clerk-user', {
				function: userSubscriptionUpdate,
				data: {
					clerkUserId: customer.metadata.userId,
					stripeCustomerId: subscription.customer as string,
					subscriptionStatus: subscription.status,
					productName: product.name,
				},
			});

			const [person, user] = await Promise.all([personPromise, clerkPromise]);

			if (!person) {
				throw new NonRetriableError('unable to find person in Sanity');
			}

			const sanityPromise = step.invoke('sanity-update-person-subscription', {
				function: personUpdateSubscription,
				data: {
					sanityUserId: person._id,
					stripeCustomerId: subscription.customer as string,
					subscriptionStatus: subscription.status,
					productName: product.name,
				},
			});

			const startDate = subscription.created;
			const cycleStart = subscription.items.data.at(0)?.current_period_start;

			const isNew = startDate === cycleStart;

			const discordUser = user.externalAccounts.find(
				(acct) => acct.provider === 'oauth_discord',
			);

			const n = discordUser ? `<@${discordUser.externalId}>` : person.name;
			const p = product.name;
			// to get an emoji ID like this, send `\:theEmojiName:` in Discord
			const emoji = '<:jlengsHeart:941389642756943993>';

			// default message — if this survives we’ve hit an edge case we need to handle
			let msg = `${n}'s account is in a weird state`;

			if (isNew) {
				msg = `New ${p}: ${n} just subscribed! ${emoji}`;
			}

			if (!isNew && cycleStart) {
				const duration = intervalToDuration({
					start: startDate * 1000,
					end: cycleStart * 1000,
				});

				const d = (duration.years ?? 0) * 12 + (duration.months ?? 0);

				msg = `${n} renewed their subscription. They’ve been a ${p} for ${d} months! ${emoji}`;
			}

			const messagePromise = step.invoke('discord-send-message', {
				function: messageSend,
				data: {
					message: msg,
				},
			});

			await Promise.all([sanityPromise, messagePromise]);
		} catch (err) {
			await step.invoke('discord-send-error-message', {
				function: messageSend,
				data: {
					message:
						'Failed Inngest run:\n```' + JSON.stringify(err, null, 2) + '```',
				},
			});
		}
	},
);
