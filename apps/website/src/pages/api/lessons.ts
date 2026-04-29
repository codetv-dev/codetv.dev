import type { APIRoute } from 'astro';
import { and, desc, eq, or } from 'drizzle-orm';

import { db } from '../../db';
import { contentResource } from '../../db/schema';
import { getUserAbilityForRequest } from '../../server/ability';
import { withSkill } from '../../server/with-skill';

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, init);
}

function isPublicLesson(lesson: typeof contentResource.$inferSelect) {
	const fields = (lesson.fields ?? {}) as Record<string, unknown>;
	return fields.state === 'published' && fields.visibility === 'public';
}

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const slugOrId = searchParams.get('slugOrId');
		const { ability } = await getUserAbilityForRequest(request);
		const canManageContent = ability.can('update', 'Content');

		if (slugOrId) {
			const lesson = await db.query.contentResource.findFirst({
				where: and(
					eq(contentResource.type, 'lesson'),
					or(eq(contentResource.id, slugOrId), eq(contentResource.slug, slugOrId)),
				),
				with: {
					resources: {
						with: { resource: true },
					},
					resourceOf: {
						with: { resourceOf: true },
					},
				},
			});

			if (!lesson || (!canManageContent && !isPublicLesson(lesson))) {
				return json({ error: 'Lesson not found' }, { status: 404 });
			}

			return json(lesson);
		}

		const lessons = await db.query.contentResource.findMany({
			where: eq(contentResource.type, 'lesson'),
			orderBy: desc(contentResource.createdAt),
			limit: 100,
		});

		return json(
			canManageContent
				? lessons
				: lessons.filter((lesson) => isPublicLesson(lesson)),
		);
	})(request);

export const PUT: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');
		const { user, ability } = await getUserAbilityForRequest(request);

		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (ability.cannot('update', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		if (!id) return json({ error: 'Missing lesson ID' }, { status: 400 });

		const lesson = await db.query.contentResource.findFirst({
			where: and(eq(contentResource.id, id), eq(contentResource.type, 'lesson')),
		});

		if (!lesson) return json({ error: 'Lesson not found' }, { status: 404 });

		const body = await request.json();
		const bodyFields = body.fields ?? body;
		const mergedFields = {
			...((lesson.fields ?? {}) as Record<string, unknown>),
			...(bodyFields ?? {}),
		};

		await db
			.update(contentResource)
			.set({ fields: mergedFields })
			.where(eq(contentResource.id, id));

		const updated = await db.query.contentResource.findFirst({
			where: eq(contentResource.id, id),
			with: {
				resources: {
					with: { resource: true },
				},
				resourceOf: {
					with: { resourceOf: true },
				},
			},
		});

		return json(updated ?? { ...lesson, fields: mergedFields });
	})(request);
