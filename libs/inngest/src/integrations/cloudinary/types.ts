import { z } from 'zod';

export const schema = {
	'cloudinary/image.upload': {
		data: z.object({
			imageUrl: z.string().url(),
			username: z.string(),
		}),
	},
};
