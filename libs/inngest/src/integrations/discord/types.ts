import { z } from 'zod';
import { ClerkWebhookUser } from '../clerk/index.js';

export type SubscriptionLevel =
	| 'Free Tier Supporter'
	| 'Silver Tier Supporter'
	| 'Gold Tier Supporter'
	| 'Platinum Tier Supporter';

export const schema = {
	'discord/user.role.update': {
		data: ClerkWebhookUser,
	},
	'discord/message.send': {
		data: z.object({
			message: z.string(),
		}),
	},
};
