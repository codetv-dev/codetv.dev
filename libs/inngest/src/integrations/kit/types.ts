import { z } from 'zod';

export const schema = {
	'kit/subscriber.tag.add': {
		data: z.object({
			email: z.string(),
			tag: z.string(),
		}),
	},
};