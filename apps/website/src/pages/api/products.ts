import type { APIRoute } from 'astro';
import { and, asc, eq, or, sql } from 'drizzle-orm';

import { db } from '../../db';
import { contentResourceResource, products } from '../../db/schema';
import { getUserAbilityForRequest } from '../../server/ability';
import { withSkill } from '../../server/with-skill';

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, init);
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

			return json(product);
		}

		const result = await db.query.products.findMany({
			where: eq(products.status, 1),
			with: productWithFullStructure,
		});

		return json(result);
	})(request);
