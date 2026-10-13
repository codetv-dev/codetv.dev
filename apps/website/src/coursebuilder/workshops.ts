import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm';

import { courseBuilderAdapter, db } from '../db';
import {
	contentResource,
	contentResourceResource,
	products,
	purchases,
} from '../db/schema';
import {
	getEnrollmentWindow,
	pickCurrentTicket,
	type EnrollmentWindow,
} from './enrollment';

type Fields = Record<string, any>;

export type WorkshopTicket = {
	productId: string;
	productName: string;
	productType: string;
	/** USD dollars, from the local Price row. The pricing island formats PPP/coupons. */
	unitAmount: number | null;
	cohort: {
		id: string;
		title: string | null;
		startsAt: Date | null;
		endsAt: Date | null;
	} | null;
	enrollment: EnrollmentWindow;
};

export type WorkshopForSale = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	body: string | null;
	outline: Array<{ id: string; type: string; title: string }>;
	ticket: WorkshopTicket | null;
};

const ACCESS_STATUSES = ['Valid', 'Restricted'];

function toDate(value: unknown): Date | null {
	if (!value) return null;
	const date = new Date(value as string);
	return Number.isNaN(date.getTime()) ? null : date;
}

function isProductActive(product: { status: number; fields: unknown }) {
	const fields = (product.fields ?? {}) as Fields;
	return product.status === 1 && (fields.state ?? 'published') === 'published';
}

/** A Workshop is sellable when published and either public or unlisted. */
function isWorkshopVisible(fields: Fields) {
	return (
		fields.state === 'published' &&
		(fields.visibility === 'public' || fields.visibility === 'unlisted')
	);
}

type ProductRow = typeof products.$inferSelect & {
	price?: { unitAmount: string | number } | null;
};

function toTicket(
	product: ProductRow,
	cohort: typeof contentResource.$inferSelect | null,
	now: Date,
): WorkshopTicket {
	const productFields = (product.fields ?? {}) as Fields;
	const cohortFields = (cohort?.fields ?? {}) as Fields;
	const startsAt = toDate(cohortFields.startsAt);

	return {
		productId: product.id,
		productName: product.name,
		productType: product.type ?? 'self-paced',
		unitAmount: product.price ? Number(product.price.unitAmount) : null,
		cohort: cohort
			? {
					id: cohort.id,
					title: cohortFields.title ?? null,
					startsAt,
					endsAt: toDate(cohortFields.endsAt),
				}
			: null,
		enrollment: getEnrollmentWindow({
			now,
			productActive: isProductActive(product),
			openEnrollment: productFields.openEnrollment,
			closeEnrollment: productFields.closeEnrollment,
			cohortStartsAt: startsAt,
		}),
	};
}

/**
 * Load a Workshop by slug plus the Workshop Ticket its page should sell.
 *
 * Tickets come from products linked to a Cohort that contains this Workshop
 * (`createCohort` shape), or from products linked to the Workshop directly
 * (`workshop create --create-product` shape).
 */
export async function getWorkshopForSale(
	slug: string,
	now = new Date(),
): Promise<WorkshopForSale | null> {
	const workshop = await db.query.contentResource.findFirst({
		where: and(
			eq(contentResource.type, 'workshop'),
			or(eq(contentResource.slug, slug), eq(contentResource.id, slug)),
		),
		with: {
			resources: {
				with: { resource: true },
				orderBy: asc(contentResourceResource.position),
			},
			resourceProducts: {
				with: { product: { with: { price: true } } },
			},
		},
	});

	if (!workshop) return null;

	const fields = (workshop.fields ?? {}) as Fields;
	if (!isWorkshopVisible(fields)) return null;

	const cohortLinks = await db.query.contentResourceResource.findMany({
		where: eq(contentResourceResource.resourceId, workshop.id),
		with: {
			resourceOf: {
				with: {
					resourceProducts: {
						with: { product: { with: { price: true } } },
					},
				},
			},
		},
	});

	const candidates = [
		...cohortLinks
			.map((link) => link.resourceOf)
			.filter((parent) => parent?.type === 'cohort')
			.flatMap((cohort) =>
				cohort.resourceProducts.map((link) =>
					toTicket(link.product as ProductRow, cohort, now),
				),
			),
		...workshop.resourceProducts.map((link) =>
			toTicket(link.product as ProductRow, null, now),
		),
	]
		.filter((ticket) => ticket.productId)
		.map((ticket) => ({
			ticket,
			enrollment: ticket.enrollment,
			cohortStartsAt: ticket.cohort?.startsAt ?? null,
		}));

	return {
		id: workshop.id,
		slug: workshop.slug ?? slug,
		title: fields.title ?? 'Workshop',
		description: fields.description ?? null,
		body: typeof fields.body === 'string' ? fields.body : null,
		outline: workshop.resources
			.map((link) => link.resource)
			.filter(Boolean)
			.map((resource) => ({
				id: resource.id,
				type: resource.type,
				title: ((resource.fields ?? {}) as Fields).title ?? 'Untitled',
			})),
		ticket: pickCurrentTicket(candidates)?.ticket ?? null,
	};
}

/**
 * Load the ticket for a product id, for the server-side checkout guard.
 * Uses the first Cohort the product is linked to, if any.
 */
export async function getTicketForProduct(
	productId: string,
	now = new Date(),
): Promise<WorkshopTicket | null> {
	const product = await db.query.products.findFirst({
		where: eq(products.id, productId),
		with: {
			price: true,
			resources: { with: { resource: true } },
		},
	});

	if (!product) return null;

	const cohort =
		product.resources
			.map((link) => link.resource)
			.find((resource) => resource?.type === 'cohort') ?? null;

	return toTicket(product as ProductRow, cohort, now);
}

/**
 * Path of the Workshop page a product sells, for the post-purchase screen.
 */
export async function getWorkshopPathForProduct(productId: string) {
	const product = await db.query.products.findFirst({
		where: eq(products.id, productId),
		with: {
			resources: {
				with: {
					resource: {
						with: { resources: { with: { resource: true } } },
					},
				},
			},
		},
	});

	for (const link of product?.resources ?? []) {
		const resource = link.resource;
		if (!resource) continue;

		const workshop =
			resource.type === 'workshop'
				? resource
				: resource.resources
						.map((child) => child.resource)
						.find((child) => child?.type === 'workshop');

		if (workshop?.slug) return `/workshops/${workshop.slug}`;
	}

	return null;
}

/**
 * Workshop Access through a Workshop Ticket: a Valid or Restricted (PPP)
 * individual purchase, or a claimed Team Seat. A team buyer's bulk purchase
 * does not grant a seat by itself (CONTEXT.md).
 */
export async function getTicketPurchase(userId: string, productIds: string[]) {
	if (productIds.length === 0) return null;

	return (
		(await db.query.purchases.findFirst({
			where: and(
				eq(purchases.userId, userId),
				inArray(purchases.productId, productIds),
				inArray(purchases.status, ACCESS_STATUSES),
				isNull(purchases.bulkCouponId),
			),
		})) ?? null
	);
}

/**
 * Resolve a `?code=` value (coupon id or human-readable code) to a coupon id
 * the pricing endpoint accepts. Returns null when the coupon is unknown,
 * expired, or restricted to another product.
 */
export async function resolveCouponCode(
	code: string | null | undefined,
	productId: string,
) {
	const trimmed = code?.trim();
	if (!trimmed || trimmed.length > 191) return null;

	const coupon = await courseBuilderAdapter.couponForIdOrCode({
		code: trimmed,
		couponId: trimmed,
	});

	if (!coupon) return null;
	if (
		coupon.restrictedToProductId &&
		coupon.restrictedToProductId !== productId
	)
		return null;

	return coupon.id;
}
