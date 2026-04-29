import type { APIRoute } from 'astro';
import { and, asc, eq, or, sql } from 'drizzle-orm';

import { db } from '../../db';
import { contentResourceResource, products } from '../../db/schema';
import { getUserAbilityForRequest } from '../../server/ability';
import {
	createVerifiedProduct,
	ProductServiceError,
	updateVerifiedProductPatch,
	verifyMerchantProduct,
} from '../../coursebuilder/products';
import { withSkill } from '../../server/with-skill';

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, init);
}

async function readJsonBody(request: Request) {
	try {
		return await request.json();
	} catch {
		return null;
	}
}

function productServiceErrorResponse(error: unknown) {
	if (error instanceof ProductServiceError) {
		return json(
			{
				error: error.message,
				code: error.code,
				details: error.details,
			},
			{ status: error.status },
		);
	}

	console.error('product.route.unexpected-error', { error });
	return json(
		{
			error: 'Internal server error',
			code: 'INTERNAL_SERVER_ERROR',
		},
		{ status: 500 },
	);
}

const productWithFullStructure = {
	price: true,
	resources: {
		with: {
			resource: {
				with: {
					resources: {
						with: {
							resource: {
								with: {
									resources: {
										with: {
											resource: {
												with: {
													resources: {
														with: { resource: true },
														orderBy: asc(contentResourceResource.position),
													},
												},
											},
										},
										orderBy: asc(contentResourceResource.position),
									},
								},
							},
						},
						orderBy: asc(contentResourceResource.position),
					},
				},
			},
		},
	},
} as const;

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const slugOrId = searchParams.get('slugOrId');
		const { ability } = await getUserAbilityForRequest(request);
		const canSeeInactiveProducts = ability.can('update', 'Content');

		if (slugOrId) {
			const slugOrIdCondition = or(
				eq(products.id, slugOrId),
				eq(
					sql`JSON_UNQUOTE(JSON_EXTRACT(${products.fields}, "$.slug"))`,
					slugOrId,
				),
			);
			const product = await db.query.products.findFirst({
				where: canSeeInactiveProducts
					? slugOrIdCondition
					: and(slugOrIdCondition, eq(products.status, 1)),
				with: productWithFullStructure,
			});

			if (!product)
				return json({ error: 'Product not found' }, { status: 404 });

			if (canSeeInactiveProducts) {
				const merchantVerification = await verifyMerchantProduct(product.id);
				return json({ ...product, merchantVerification });
			}

			return json(product);
		}

		const result = await db.query.products.findMany({
			where: eq(products.status, 1),
			with: productWithFullStructure,
		});

		return json(result);
	})(request);

export const POST: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (!ability.can('create', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await readJsonBody(request);
		if (!body || typeof body !== 'object') {
			return json({ error: 'JSON body is required' }, { status: 400 });
		}

		try {
			const { product, merchantVerification } = await createVerifiedProduct(
				body as { name?: unknown; price?: unknown },
			);
			return json(
				{ success: true, product, merchantVerification },
				{ status: 201 },
			);
		} catch (error) {
			return productServiceErrorResponse(error);
		}
	})(request);

export const PUT: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (!ability.can('update', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await readJsonBody(request);
		if (!body || typeof body !== 'object') {
			return json({ error: 'JSON body is required' }, { status: 400 });
		}

		const payload = body as {
			id?: unknown;
			productId?: unknown;
			name?: unknown;
			price?: unknown;
		};

		try {
			const { product, merchantVerification } =
				await updateVerifiedProductPatch({
					id: payload.id ?? payload.productId,
					name: payload.name,
					price: payload.price,
				});
			return json({ success: true, product, merchantVerification });
		} catch (error) {
			return productServiceErrorResponse(error);
		}
	})(request);
