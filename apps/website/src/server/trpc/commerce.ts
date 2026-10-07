import { randomUUID } from 'node:crypto';

import { TRPCError } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { ensureStripeMerchantAccount } from '../../coursebuilder/merchant-account';
import { applyProductFieldOptions } from '../../coursebuilder/products';
import {
	getCommerceBaseUrl,
	getStripeProvider,
	isStripeLiveMode,
} from '../../coursebuilder/stripe-provider';
import { getWorkshopPathForProduct } from '../../coursebuilder/workshops';
import { courseBuilderAdapter, db } from '../../db';
import { contentResource, merchantCoupon, purchases } from '../../db/schema';
import { operatorProcedure, router } from './router-base';

/**
 * Operator procedures for selling a Workshop Ticket. The CourseBuilder CLI
 * calls them with `cb trpc get|post commerce.<name>`; see
 * docs/sop/workshop-launch.md.
 */

/** Percentages `createCoupon` snaps to; each needs a `special` merchant coupon. */
const SPECIAL_PERCENTAGES = [0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 0.95];
/** PPP discounts CourseBuilder computes (40% to 75% in 5% steps). */
const PPP_PERCENTAGES = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75];

const isoDate = z
	.string()
	.refine((value) => !Number.isNaN(new Date(value).getTime()), {
		message: 'must be an ISO date',
	})
	.transform((value) => new Date(value));

const percentage = z.coerce.number().gt(0).lt(1);

async function shareUrlForProduct(productId: string, code: string) {
	const path = await getWorkshopPathForProduct(productId);
	if (!path) return null;
	const url = new URL(path, getCommerceBaseUrl());
	url.searchParams.set('code', code);
	return url.toString();
}

export const commerceRouter = router({
	/**
	 * Create a Cohort for a Workshop plus its Workshop Ticket product
	 * (type `cohort`, published, sales close at the Cohort start), and an
	 * optional early bird default coupon.
	 */
	createCohort: operatorProcedure
		.input(
			z.object({
				workshopId: z.string().min(1),
				title: z.string().min(2).max(90),
				description: z.string().optional(),
				startsAt: isoDate,
				endsAt: isoDate,
				price: z.number().positive(),
				openEnrollment: isoDate.optional(),
				earlyBird: z
					.object({
						percentageDiscount: percentage,
						expires: isoDate,
					})
					.optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const workshop = await db.query.contentResource.findFirst({
				where: and(
					eq(contentResource.id, input.workshopId),
					eq(contentResource.type, 'workshop'),
				),
			});
			if (!workshop) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Workshop not found',
				});
			}

			await ensureStripeMerchantAccount();

			const { cohort, product } = await courseBuilderAdapter.createCohort(
				{
					cohort: { title: input.title, description: input.description },
					dates: { start: input.startsAt, end: input.endsAt },
					createProduct: true,
					pricing: { price: input.price },
					...(input.earlyBird && {
						coupon: {
							enabled: true,
							percentageDiscount: String(input.earlyBird.percentageDiscount),
							expires: input.earlyBird.expires,
						},
					}),
					workshops: [{ id: input.workshopId }],
				},
				ctx.user.id,
			);

			// createCohort logs and swallows product failures; surface them.
			if (!product?.id) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Cohort ${cohort.id} was created but its product was not. Check Stripe env, then create the product with POST /api/products and resourceId=${cohort.id}.`,
				});
			}

			if (input.openEnrollment) {
				await applyProductFieldOptions(product.id, {
					openEnrollment: input.openEnrollment.toISOString(),
				});
			}

			const defaults = await courseBuilderAdapter.getDefaultCoupon([
				product.id,
			]);

			return {
				cohort,
				product: await courseBuilderAdapter.getProduct(product.id),
				earlyBird: input.earlyBird
					? {
							created: Boolean(defaults?.defaultCoupon),
							hint: defaults?.defaultCoupon
								? undefined
								: 'No early bird coupon: run commerce.seedMerchantCoupons, then commerce.createCoupon with default=true.',
						}
					: undefined,
				workshopPath: await getWorkshopPathForProduct(product.id),
			};
		}),

	/** List buyers of a product (the operator check). */
	listPurchases: operatorProcedure
		.input(z.object({ productId: z.string().min(1) }))
		.query(async ({ input }) => {
			const rows = await db.query.purchases.findMany({
				where: eq(purchases.productId, input.productId),
				with: { user: true },
				orderBy: desc(purchases.createdAt),
			});

			return rows.map((purchase) => ({
				id: purchase.id,
				status: purchase.status,
				createdAt: purchase.createdAt,
				totalAmount: purchase.totalAmount,
				country: purchase.country,
				couponId: purchase.couponId,
				bulkCouponId: purchase.bulkCouponId,
				redeemedBulkCouponId: purchase.redeemedBulkCouponId,
				user: purchase.user
					? {
							id: purchase.user.id,
							email: purchase.user.email,
							name: purchase.user.name,
						}
					: null,
			}));
		}),

	/**
	 * Create the Stripe-backed merchant coupons CourseBuilder needs for PPP and
	 * percentage coupons. Idempotent. Refuses a live Stripe key unless
	 * `allowLive` is true.
	 */
	seedMerchantCoupons: operatorProcedure
		.input(
			z
				.object({
					dryRun: z.boolean().default(false),
					allowLive: z.boolean().default(false),
				})
				.default({ dryRun: false, allowLive: false }),
		)
		.mutation(async ({ input }) => {
			const live = isStripeLiveMode();
			if (live && !input.allowLive) {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message:
						'CourseBuilder Stripe key is live. Re-run with allowLive=true only when you mean to create live coupons.',
				});
			}

			const stripeProvider = getStripeProvider();
			if (!stripeProvider) {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message: 'CourseBuilder Stripe env is not configured',
				});
			}

			const account = await ensureStripeMerchantAccount();
			if (!account) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Stripe merchant account row is missing',
				});
			}

			const wanted = [
				...SPECIAL_PERCENTAGES.map((value) => ({ type: 'special', value })),
				...PPP_PERCENTAGES.map((value) => ({ type: 'ppp', value })),
			];
			const results: Array<{
				type: string;
				percentageDiscount: number;
				status: 'exists' | 'created' | 'would-create';
				id?: string;
			}> = [];

			for (const { type, value } of wanted) {
				const existing =
					await courseBuilderAdapter.getMerchantCouponForTypeAndPercent({
						type,
						percentageDiscount: value,
					});

				if (existing) {
					results.push({
						type,
						percentageDiscount: value,
						status: 'exists',
						id: existing.id,
					});
					continue;
				}

				if (input.dryRun) {
					results.push({
						type,
						percentageDiscount: value,
						status: 'would-create',
					});
					continue;
				}

				const percent = Math.round(value * 100);
				const identifier =
					await stripeProvider.options.paymentsAdapter.createCoupon({
						percent_off: percent,
						duration: 'forever',
						name:
							type === 'ppp'
								? `Regional pricing ${percent}%`
								: `${percent}% off`,
						metadata: { type, source: 'codetv-coursebuilder' },
					});
				const id = `mcoupon_${randomUUID()}`;

				await db.insert(merchantCoupon).values({
					id,
					identifier,
					merchantAccountId: account.id,
					status: 1,
					percentageDiscount: value.toFixed(2),
					type,
				});

				results.push({
					type,
					percentageDiscount: value,
					status: 'created',
					id,
				});
			}

			return { live, results };
		}),

	/**
	 * Create a coupon for a product. Share it as `/workshops/<slug>?code=<code>`.
	 * Set `default: true` for a sitewide sale such as the early bird.
	 */
	createCoupon: operatorProcedure
		.input(
			z.object({
				productId: z.string().min(1),
				percentageDiscount: percentage,
				code: z
					.string()
					.regex(/^[A-Za-z0-9_-]{3,64}$/)
					.optional(),
				expires: isoDate.optional(),
				maxUses: z.number().int().min(-1).default(-1),
				default: z.boolean().default(false),
				label: z.string().max(90).optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const product = await courseBuilderAdapter.getProduct(input.productId);
			if (!product) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Product not found',
				});
			}

			// `createCoupon` copies extra input (here `code`) onto the Coupon row.
			const ids = await courseBuilderAdapter.createCoupon({
				quantity: '1',
				maxUses: input.maxUses,
				expires: input.expires ?? null,
				restrictedToProductId: input.productId,
				percentageDiscount: String(input.percentageDiscount),
				status: 1,
				default: input.default,
				fields: input.label ? { label: input.label } : {},
				...(input.code && { code: input.code }),
			} as Parameters<typeof courseBuilderAdapter.createCoupon>[0]);

			const couponId = ids?.[0];
			if (!couponId) {
				throw new TRPCError({
					code: 'PRECONDITION_FAILED',
					message:
						'No matching `special` merchant coupon. Run commerce.seedMerchantCoupons first.',
				});
			}

			return {
				couponId,
				code: input.code ?? null,
				shareUrl: await shareUrlForProduct(
					input.productId,
					input.code ?? couponId,
				),
			};
		}),
});
