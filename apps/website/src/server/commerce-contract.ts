import { z } from 'zod';

const id = z.string().trim().min(1).max(191);
const page = {
	productId: id,
	limit: z.number().int().min(1).max(100).default(50),
	offset: z.number().int().min(0).max(1_000_000).default(0),
};
export const commerceInputs = {
	list_sales: z.object(page).strict(),
	list_coupons: z.object(page).strict(),
	create_coupon: z
		.object({
			productId: id,
			code: z
				.string()
				.trim()
				.regex(/^[A-Za-z0-9_-]{3,80}$/)
				.optional(),
			percentageDiscount: z.number().min(0.01).max(1).multipleOf(0.01),
			maxUses: z.union([z.literal(-1), z.number().int().min(1).max(1_000_000)]),
			expires: z.iso.datetime({ offset: true }).nullable().default(null),
			confirmed: z.literal(true).optional(),
		})
		.strict()
		.refine(
			(v) => v.percentageDiscount !== 1 || v.confirmed === true,
			'Creating a free ticket requires confirmed: true.',
		),
	deactivate_coupon: z
		.object({ productId: id, id, confirmed: z.literal(true) })
		.strict(),
};
export type CommerceOperation = keyof typeof commerceInputs;
export type CommerceInput<K extends CommerceOperation> = z.infer<
	(typeof commerceInputs)[K]
>;
export type CommerceOperations = {
	[K in CommerceOperation]: (input: CommerceInput<K>) => Promise<unknown>;
};
