import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { courseBuilderAdapter, db } from '../db';
import {
	contentResource,
	contentResourceProduct,
	merchantPrice,
	merchantProduct,
	prices,
	products,
} from '../db/schema';
import { ensureStripeMerchantAccount } from './merchant-account';
import { getStripeProvider } from './stripe-provider';

export type MerchantVerification = {
	provider: 'stripe';
	stripeProductId: string | null;
	stripePriceId: string | null;
	verified: boolean;
	issues: string[];
};

type ParsedUsdPrice = {
	amount: number;
	unitAmount: string;
};

type CourseBuilderProduct = {
	id: string;
	name: string;
	price?: {
		id: string;
		unitAmount: number | string;
		nickname?: string | null;
		[key: string]: unknown;
	} | null;
	[key: string]: unknown;
};

export class ProductServiceError extends Error {
	constructor(
		message: string,
		public status = 400,
		public code = 'PRODUCT_SERVICE_ERROR',
		public details?: unknown,
	) {
		super(message);
	}
}

export function parseUsdPrice(
	value: unknown,
	fieldName = 'price',
): ParsedUsdPrice {
	if (typeof value !== 'number' && typeof value !== 'string') {
		throw new ProductServiceError(
			`${fieldName} must be a USD dollar amount`,
			400,
			'INVALID_PRICE',
		);
	}

	const raw = String(value).trim();
	if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
		throw new ProductServiceError(
			`${fieldName} must be a USD dollar amount with at most two decimals`,
			400,
			'INVALID_PRICE',
		);
	}

	const amount = Number(raw);
	if (!Number.isFinite(amount) || amount < 0) {
		throw new ProductServiceError(
			`${fieldName} must be greater than or equal to 0`,
			400,
			'INVALID_PRICE',
		);
	}

	return {
		amount,
		unitAmount: String(amount),
	};
}

function assertProductId(value: unknown): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new ProductServiceError(
			'Product id is required',
			400,
			'MISSING_PRODUCT_ID',
		);
	}
	return value.trim();
}

function assertProductName(value: unknown): string {
	if (typeof value !== 'string') {
		throw new ProductServiceError(
			'name is required',
			400,
			'MISSING_PRODUCT_NAME',
		);
	}
	const name = value.trim();
	if (name.length < 2 || name.length > 90) {
		throw new ProductServiceError(
			'name must be between 2 and 90 characters',
			400,
			'INVALID_PRODUCT_NAME',
		);
	}
	return name;
}

const isoDate = z
	.string()
	.refine((value) => !Number.isNaN(new Date(value).getTime()), {
		message: 'must be an ISO date',
	})
	.transform((value) => new Date(value).toISOString());

/**
 * Optional product fields. `type`, `slug`, `state`, `visibility` and
 * `quantityAvailable` are what `cb product create|update` already sends.
 * `openEnrollment`, `closeEnrollment` and `resourceId` are CodeTV additions
 * for Workshop Tickets (send them with `--body` through curl or the SOP).
 */
const ProductOptionsSchema = z.object({
	type: z
		.enum([
			'self-paced',
			'cohort',
			'cohort-archive',
			'membership',
			'live',
			'source-code-access',
		])
		.optional(),
	slug: z
		.string()
		.regex(/^[a-z0-9]+(?:[-~][a-z0-9]+)*$/, 'must be a lowercase URL slug')
		.max(191)
		.optional(),
	state: z.enum(['draft', 'published', 'archived', 'deleted']).optional(),
	visibility: z.enum(['public', 'private', 'unlisted']).optional(),
	quantityAvailable: z.number().int().min(-1).optional(),
	openEnrollment: isoDate.nullable().optional(),
	closeEnrollment: isoDate.nullable().optional(),
	resourceId: z.string().min(1).optional(),
});

type ProductOptions = z.infer<typeof ProductOptionsSchema>;

function parseProductOptions(input: unknown): ProductOptions {
	const parsed = ProductOptionsSchema.safeParse(input ?? {});
	if (!parsed.success) {
		throw new ProductServiceError(
			'Invalid product options',
			400,
			'INVALID_PRODUCT_OPTIONS',
			z.treeifyError(parsed.error),
		);
	}
	return parsed.data;
}

/** Merge field-level options into the product's `fields` JSON. */
export async function applyProductFieldOptions(
	productId: string,
	options: ProductOptions,
) {
	const patch: Record<string, unknown> = {};
	for (const key of [
		'slug',
		'state',
		'visibility',
		'openEnrollment',
		'closeEnrollment',
	] as const) {
		if (options[key] !== undefined) patch[key] = options[key];
	}

	const columns: Partial<typeof products.$inferInsert> = {};
	if (options.type) columns.type = options.type;
	if (options.quantityAvailable !== undefined) {
		columns.quantityAvailable = options.quantityAvailable;
	}

	if (Object.keys(patch).length === 0 && Object.keys(columns).length === 0) {
		return;
	}

	const current = await db.query.products.findFirst({
		where: eq(products.id, productId),
	});
	if (!current) {
		throw new ProductServiceError(
			'Product not found',
			404,
			'PRODUCT_NOT_FOUND',
		);
	}

	const fields = { ...((current.fields ?? {}) as Record<string, unknown>) };
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) delete fields[key];
		else fields[key] = value;
	}

	await db
		.update(products)
		.set({ ...columns, fields })
		.where(eq(products.id, productId));
}

/** Link a product to a Cohort or Workshop so its page can sell it. */
async function linkProductToResource(productId: string, resourceId: string) {
	const resource = await db.query.contentResource.findFirst({
		where: eq(contentResource.id, resourceId),
	});
	if (!resource) {
		throw new ProductServiceError(
			'Resource not found',
			404,
			'RESOURCE_NOT_FOUND',
		);
	}

	const existing = await db.query.contentResourceProduct.findFirst({
		where: and(
			eq(contentResourceProduct.productId, productId),
			eq(contentResourceProduct.resourceId, resourceId),
		),
	});
	if (existing) return;

	await db.insert(contentResourceProduct).values({
		productId,
		resourceId,
		position: 0,
		metadata: { addedBy: 'api/products' },
	});
}

export async function verifyMerchantProduct(
	productId: string,
): Promise<MerchantVerification> {
	const issues: string[] = [];
	let stripeProductId: string | null = null;
	let stripePriceId: string | null = null;

	const merchantProductRow = await db.query.merchantProduct.findFirst({
		where: and(
			eq(merchantProduct.productId, productId),
			eq(merchantProduct.status, 1),
		),
	});

	if (!merchantProductRow) {
		issues.push('missing_active_merchant_product');
	} else {
		stripeProductId = merchantProductRow.identifier;
	}

	const merchantPriceRow = merchantProductRow
		? await db.query.merchantPrice.findFirst({
				where: and(
					eq(merchantPrice.merchantProductId, merchantProductRow.id),
					eq(merchantPrice.status, 1),
				),
			})
		: null;

	if (!merchantPriceRow) {
		issues.push('missing_active_merchant_price');
	} else {
		stripePriceId = merchantPriceRow.identifier;
	}

	const stripeProvider = getStripeProvider();
	if (!stripeProvider) {
		issues.push('stripe_provider_unavailable');
	} else {
		if (stripeProductId) {
			try {
				const stripeProduct = await stripeProvider.getProduct(stripeProductId);
				if ('deleted' in stripeProduct && stripeProduct.deleted) {
					issues.push('stripe_product_deleted');
				} else if ('active' in stripeProduct && !stripeProduct.active) {
					issues.push('stripe_product_inactive');
				}
			} catch (error) {
				console.warn('product.verify.stripe-product-failed', {
					productId,
					stripeProductId,
					error,
				});
				issues.push('stripe_product_not_retrievable');
			}
		}

		if (stripePriceId) {
			try {
				const stripePrice = await stripeProvider.getPrice(stripePriceId);
				if ('active' in stripePrice && !stripePrice.active) {
					issues.push('stripe_price_inactive');
				}
			} catch (error) {
				console.warn('product.verify.stripe-price-failed', {
					productId,
					stripePriceId,
					error,
				});
				issues.push('stripe_price_not_retrievable');
			}
		}
	}

	return {
		provider: 'stripe',
		stripeProductId,
		stripePriceId,
		verified: issues.length === 0,
		issues,
	};
}

export async function createVerifiedProduct(
	input: {
		name?: unknown;
		price?: unknown;
	} & Record<string, unknown>,
) {
	const name = assertProductName(input.name);
	const price = parseUsdPrice(input.price);
	const options = parseProductOptions({
		type: input.type,
		slug: input.slug,
		state: input.state,
		visibility: input.visibility,
		quantityAvailable: input.quantityAvailable,
		openEnrollment: input.openEnrollment,
		closeEnrollment: input.closeEnrollment,
		resourceId: input.resourceId,
	});
	let product: CourseBuilderProduct | null = null;

	try {
		await ensureStripeMerchantAccount();

		product = (await courseBuilderAdapter.createProduct({
			name,
			price: price.amount,
			type: options.type ?? 'self-paced',
			quantityAvailable: options.quantityAvailable ?? -1,
			state: options.state ?? 'draft',
			visibility: options.visibility ?? 'unlisted',
			...(options.openEnrollment && {
				openEnrollment: options.openEnrollment,
			}),
			...(options.closeEnrollment && {
				closeEnrollment: options.closeEnrollment,
			}),
		})) as CourseBuilderProduct;

		if (options.slug) {
			await applyProductFieldOptions(product.id, { slug: options.slug });
		}
		if (options.resourceId) {
			await linkProductToResource(product.id, options.resourceId);
		}
		product = ((await courseBuilderAdapter.getProduct(product.id)) ??
			product) as CourseBuilderProduct;

		const merchantVerification = await verifyMerchantProduct(product.id);
		if (!merchantVerification.verified) {
			throw new ProductServiceError(
				'Product merchant verification failed',
				502,
				'PRODUCT_MERCHANT_VERIFICATION_FAILED',
				merchantVerification,
			);
		}
		return { product, merchantVerification };
	} catch (error) {
		if (product?.id) {
			try {
				await courseBuilderAdapter.archiveProduct(product.id);
			} catch (cleanupError) {
				console.warn('product.create.cleanup-failed', {
					productId: product.id,
					cleanupError,
				});
			}
		}

		if (error instanceof ProductServiceError) throw error;
		const message =
			error instanceof Error ? error.message : 'Product creation failed';
		throw new ProductServiceError(
			message,
			/Payment provider|Merchant account/i.test(message) ? 503 : 500,
			'PRODUCT_CREATE_FAILED',
		);
	}
}

export async function updateVerifiedProductPatch(
	input: {
		id: unknown;
		name?: unknown;
		price?: unknown;
	} & Record<string, unknown>,
) {
	const id = assertProductId(input.id);
	const hasName = input.name !== undefined;
	const hasPrice = input.price !== undefined;
	const options = parseProductOptions({
		slug: input.slug,
		state: input.state,
		visibility: input.visibility,
		quantityAvailable: input.quantityAvailable,
		openEnrollment: input.openEnrollment,
		closeEnrollment: input.closeEnrollment,
		resourceId: input.resourceId,
	});
	const { resourceId, ...fieldOptions } = options;
	const hasOptions = Object.values(options).some(
		(value) => value !== undefined,
	);

	if (!hasName && !hasPrice && !hasOptions) {
		throw new ProductServiceError(
			'Provide at least one field to update: name, price, slug, state, visibility, quantityAvailable, openEnrollment, closeEnrollment or resourceId',
			400,
			'NO_PRODUCT_UPDATES',
		);
	}

	if (!hasName && !hasPrice) {
		await applyProductFieldOptions(id, fieldOptions);
		if (resourceId) await linkProductToResource(id, resourceId);
		const product = await courseBuilderAdapter.getProduct(id);
		if (!product) {
			throw new ProductServiceError(
				'Product not found',
				404,
				'PRODUCT_NOT_FOUND',
			);
		}
		return { product, merchantVerification: await verifyMerchantProduct(id) };
	}

	const currentProduct = (await courseBuilderAdapter.getProduct(
		id,
	)) as CourseBuilderProduct | null;
	if (!currentProduct) {
		throw new ProductServiceError(
			'Product not found',
			404,
			'PRODUCT_NOT_FOUND',
		);
	}

	const name = hasName ? assertProductName(input.name) : currentProduct.name;
	const parsedPrice = hasPrice ? parseUsdPrice(input.price) : null;

	if (parsedPrice && !currentProduct.price) {
		throw new ProductServiceError(
			'Product has no price to update',
			409,
			'PRODUCT_PRICE_MISSING',
		);
	}

	const mergedProduct: CourseBuilderProduct = {
		...currentProduct,
		name,
		price: currentProduct.price
			? {
					...currentProduct.price,
					unitAmount: parsedPrice
						? parsedPrice.amount
						: currentProduct.price.unitAmount,
					nickname: name,
				}
			: currentProduct.price,
	};

	try {
		let product = (await courseBuilderAdapter.updateProduct(
			mergedProduct as any,
		)) as CourseBuilderProduct;

		// CourseBuilder adapter currently floors decimal dollars into the local Price row on update.
		// Correct CodeTV's local source of truth after the Stripe/default-price recreation succeeds.
		if (parsedPrice && currentProduct.price?.id) {
			await db
				.update(prices)
				.set({ unitAmount: parsedPrice.unitAmount, nickname: name })
				.where(eq(prices.id, currentProduct.price.id));
			product = (await courseBuilderAdapter.getProduct(
				id,
			)) as CourseBuilderProduct;
		}

		if (hasOptions) {
			await applyProductFieldOptions(id, fieldOptions);
			if (resourceId) await linkProductToResource(id, resourceId);
			product = (await courseBuilderAdapter.getProduct(
				id,
			)) as CourseBuilderProduct;
		}

		const merchantVerification = await verifyMerchantProduct(id);
		if (!merchantVerification.verified) {
			throw new ProductServiceError(
				'Product merchant verification failed',
				502,
				'PRODUCT_MERCHANT_VERIFICATION_FAILED',
				merchantVerification,
			);
		}
		return { product, merchantVerification };
	} catch (error) {
		if (error instanceof ProductServiceError) throw error;
		const message =
			error instanceof Error ? error.message : 'Product update failed';
		throw new ProductServiceError(
			message,
			/Payment provider|Merchant account/i.test(message) ? 503 : 500,
			'PRODUCT_UPDATE_FAILED',
		);
	}
}
