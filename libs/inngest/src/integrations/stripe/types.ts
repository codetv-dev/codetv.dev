import { z } from 'zod';

export const schema = {
	'stripe/subscription.get': {
		data: z.object({
			subscriptionId: z.string(),
		}),
	},
	'stripe/product.get': {
		data: z.object({
			productId: z.string(),
		}),
	},
	'stripe/checkout.session.completed': {
		data: z.object({
			object: z.object({
				customer: z.string(),
				metadata: z.object({
					userId: z.string(),
				}),
				subscription: z.string(),
				cancel_at_period_end: z.boolean(),
			}),
		}),
	},
	'stripe/customer.subscription.updated': {
		data: z.object({
			object: z.object({
				id: z.string(),
				cancel_at_period_end: z.boolean(),
			}),
		}),
	},
	'stripe/customer.subscription.deleted': {
		data: z.object({
			object: z.object({
				id: z.string(),
			}),
		}),
	},
};
