import { z } from 'zod';
import { ClerkWebhookUser } from '@codetv/clerk';

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
