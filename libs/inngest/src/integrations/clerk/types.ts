import { z } from 'zod';
import { ClerkWebhookUser } from '@codetv/clerk';

export { ClerkWebhookUser } from '@codetv/clerk';

export const schema = {
	'clerk/user.updated': {
		data: ClerkWebhookUser,
	},
	'clerk/user.created': {
		data: ClerkWebhookUser,
	},
	'clerk/user.subscription.update': {
		data: z.object({
			clerkUserId: z.string(),
			stripeCustomerId: z.string(),
			subscriptionStatus: z.string(),
			productName: z.string(),
		}),
	},
	'clerk/user.external-account.get-id': {
		data: z.object({
			user: z.object({
				externalAccounts: z.array(
					z.object({
						provider: z.union([
							z.literal('oauth_google'),
							z.literal('oauth_github'),
							z.literal('oauth_discord'),
						]),
						externalId: z.string(),
					}),
				),
			}),
			provider: z.union([
				z.literal('oauth_google'),
				z.literal('oauth_github'),
				z.literal('oauth_discord'),
			]),
		}),
	},
	'clerk/user.get-by-id': {
		data: z.object({
			userId: z.string(),
		}),
	},
};
