import { and, eq } from 'drizzle-orm';

import { courseBuilderAdapter, db } from '../db';
import { merchantPrice, merchantProduct, prices } from '../db/schema';
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

export async function createVerifiedProduct(input: {
	name?: unknown;
	price?: unknown;
}) {
	const name = assertProductName(input.name);
	const price = parseUsdPrice(input.price);
	let product: CourseBuilderProduct | null = null;

	try {
		product = (await courseBuilderAdapter.createProduct({
			name,
			price: price.amount,
			type: 'self-paced',
			quantityAvailable: -1,
			state: 'draft',
			visibility: 'unlisted',
		})) as CourseBuilderProduct;

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

export async function updateVerifiedProductPatch(input: {
	id: unknown;
	name?: unknown;
	price?: unknown;
}) {
	const id = assertProductId(input.id);
	const hasName = input.name !== undefined;
	const hasPrice = input.price !== undefined;

	if (!hasName && !hasPrice) {
		throw new ProductServiceError(
			'Provide at least one field to update: name or price',
			400,
			'NO_PRODUCT_UPDATES',
		);
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
