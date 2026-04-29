import type { APIRoute } from 'astro';
import { asc, desc, eq, or, and } from 'drizzle-orm';
import { z } from 'zod';

import { ensureStripeMerchantAccount } from '../../coursebuilder/merchant-account';
import { courseBuilderAdapter, db } from '../../db';
import { contentResource, contentResourceResource } from '../../db/schema';
import { getUserAbilityForRequest } from '../../server/ability';
import { withSkill } from '../../server/with-skill';

const WorkshopCreateSchema = z.object({
	workshop: z.object({
		title: z.string().min(1),
		description: z.string().optional(),
	}),
	createProduct: z.boolean().optional(),
	pricing: z
		.object({
			price: z.number().nullable().optional(),
			quantity: z.number().nullable().optional(),
		})
		.optional()
		.default({}),
	coupon: z
		.object({
			enabled: z.boolean(),
			percentageDiscount: z.string().optional(),
			expires: z.coerce.date().optional(),
		})
		.optional(),
	structure: z.array(
		z.union([
			z.object({
				type: z.literal('section'),
				title: z.string().min(1),
				lessons: z.array(
					z.object({
						title: z.string().min(1),
						videoResourceId: z.string().optional(),
					}),
				),
			}),
			z.object({
				type: z.literal('lesson'),
				title: z.string().min(1),
				videoResourceId: z.string().optional(),
			}),
		]),
	),
});

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, init);
}

function isVisibleWorkshop(
	workshop: typeof contentResource.$inferSelect,
	canSeeDrafts: boolean,
) {
	if (canSeeDrafts) return true;
	const fields = (workshop.fields ?? {}) as Record<string, unknown>;
	return fields.state === 'published' && fields.visibility === 'public';
}

type CourseBuilderWorkshopAdapter = {
	createWorkshop(
		input: z.infer<typeof WorkshopCreateSchema>,
		userId: string,
	): Promise<{
		workshop: typeof contentResource.$inferSelect;
		sections: Array<typeof contentResource.$inferSelect>;
		lessons: Array<typeof contentResource.$inferSelect>;
		product?: unknown;
	}>;
};

const workshopAdapter = courseBuilderAdapter as CourseBuilderWorkshopAdapter;

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const slugOrId = searchParams.get('slugOrId');
		const { ability } = await getUserAbilityForRequest(request);
		const canSeeDrafts = ability.can('update', 'Content');

		if (slugOrId) {
			const workshop = await db.query.contentResource.findFirst({
				where: and(
					eq(contentResource.type, 'workshop'),
					or(
						eq(contentResource.id, slugOrId),
						eq(contentResource.slug, slugOrId),
					),
				),
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
					resourceProducts: {
						with: {
							product: {
								with: { price: true },
							},
						},
					},
				},
			});

			if (!workshop || !isVisibleWorkshop(workshop, canSeeDrafts)) {
				return json({ error: 'Workshop not found' }, { status: 404 });
			}

			return json(workshop);
		}

		const workshops = await db.query.contentResource.findMany({
			where: eq(contentResource.type, 'workshop'),
			with: {
				resources: {
					with: { resource: true },
					orderBy: asc(contentResourceResource.position),
				},
			},
			orderBy: desc(contentResource.createdAt),
			limit: 100,
		});

		return json(
			canSeeDrafts
				? workshops
				: workshops.filter((workshop) =>
						isVisibleWorkshop(workshop, canSeeDrafts),
					),
		);
	})(request);

export const POST: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);

		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (ability.cannot('create', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const parsed = WorkshopCreateSchema.safeParse(body);

		if (!parsed.success) {
			return json(
				{ error: 'Invalid input', details: z.treeifyError(parsed.error) },
				{ status: 400 },
			);
		}

		if (parsed.data.createProduct) {
			await ensureStripeMerchantAccount();
		}

		const result = await workshopAdapter.createWorkshop(
			{
				...parsed.data,
				pricing: parsed.data.pricing ?? {},
			},
			user.id,
		);

		return json({ success: true, ...result }, { status: 201 });
	})(request);
