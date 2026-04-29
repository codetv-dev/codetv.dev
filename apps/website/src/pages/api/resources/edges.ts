import type { APIRoute } from 'astro';
import { and, asc, eq, max } from 'drizzle-orm';

import { db } from '../../../db';
import { contentResource, contentResourceResource } from '../../../db/schema';
import { getUserAbilityForRequest } from '../../../server/ability';
import { withSkill } from '../../../server/with-skill';

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, init);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const parentId = searchParams.get('parentId');

		if (!parentId) {
			return json({ error: 'Missing parentId parameter' }, { status: 400 });
		}

		const edges = await db.query.contentResourceResource.findMany({
			where: eq(contentResourceResource.resourceOfId, parentId),
			with: { resource: true },
			orderBy: asc(contentResourceResource.position),
		});

		return json({ parentId, count: edges.length, edges });
	})(request);

export const POST: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (ability.cannot('create', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { parentId, childId, position, metadata } = body ?? {};

		if (!parentId || typeof parentId !== 'string') {
			return json({ error: 'Missing or invalid "parentId"' }, { status: 400 });
		}
		if (!childId || typeof childId !== 'string') {
			return json({ error: 'Missing or invalid "childId"' }, { status: 400 });
		}
		if (position !== undefined && typeof position !== 'number') {
			return json({ error: '"position" must be a number' }, { status: 400 });
		}
		if (metadata !== undefined && !isObject(metadata)) {
			return json({ error: '"metadata" must be an object' }, { status: 400 });
		}

		const [parent, child] = await Promise.all([
			db.query.contentResource.findFirst({
				where: eq(contentResource.id, parentId),
			}),
			db.query.contentResource.findFirst({
				where: eq(contentResource.id, childId),
			}),
		]);

		if (!parent) {
			return json(
				{ error: `Parent resource not found: ${parentId}` },
				{ status: 404 },
			);
		}
		if (!child) {
			return json(
				{ error: `Child resource not found: ${childId}` },
				{ status: 404 },
			);
		}

		const existing = await db.query.contentResourceResource.findFirst({
			where: and(
				eq(contentResourceResource.resourceOfId, parentId),
				eq(contentResourceResource.resourceId, childId),
			),
		});

		if (existing) {
			return json(
				{ error: 'Edge already exists', edge: existing },
				{ status: 409 },
			);
		}

		let resolvedPosition = position;
		if (resolvedPosition === undefined) {
			const rows = await db
				.select({ maxPosition: max(contentResourceResource.position) })
				.from(contentResourceResource)
				.where(eq(contentResourceResource.resourceOfId, parentId));
			const maxPosition = rows[0]?.maxPosition ?? null;
			resolvedPosition = maxPosition === null ? 0 : Number(maxPosition) + 1;
		}

		await db.insert(contentResourceResource).values({
			resourceOfId: parentId,
			resourceId: childId,
			position: resolvedPosition,
			metadata: metadata ?? {},
		});

		const created = await db.query.contentResourceResource.findFirst({
			where: and(
				eq(contentResourceResource.resourceOfId, parentId),
				eq(contentResourceResource.resourceId, childId),
			),
			with: { resource: true },
		});

		return json(created, { status: 201 });
	})(request);

export const PATCH: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);
		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (ability.cannot('update', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const { parentId, childId, position, metadata } = body ?? {};

		if (!parentId || typeof parentId !== 'string') {
			return json({ error: 'Missing or invalid "parentId"' }, { status: 400 });
		}
		if (!childId || typeof childId !== 'string') {
			return json({ error: 'Missing or invalid "childId"' }, { status: 400 });
		}
		if (position === undefined && metadata === undefined) {
			return json(
				{ error: 'Must provide at least one of "position" or "metadata"' },
				{ status: 400 },
			);
		}
		if (position !== undefined && typeof position !== 'number') {
			return json({ error: '"position" must be a number' }, { status: 400 });
		}
		if (metadata !== undefined && !isObject(metadata)) {
			return json({ error: '"metadata" must be an object' }, { status: 400 });
		}

		const existing = await db.query.contentResourceResource.findFirst({
			where: and(
				eq(contentResourceResource.resourceOfId, parentId),
				eq(contentResourceResource.resourceId, childId),
			),
		});

		if (!existing) return json({ error: 'Edge not found' }, { status: 404 });

		const update: Record<string, unknown> = {
			metadata:
				metadata === undefined
					? existing.metadata
					: {
							...((existing.metadata ?? {}) as Record<string, unknown>),
							...metadata,
						},
			updatedAt: new Date(),
		};
		if (position !== undefined) update.position = position;

		await db
			.update(contentResourceResource)
			.set(update)
			.where(
				and(
					eq(contentResourceResource.resourceOfId, parentId),
					eq(contentResourceResource.resourceId, childId),
				),
			);

		const updated = await db.query.contentResourceResource.findFirst({
			where: and(
				eq(contentResourceResource.resourceOfId, parentId),
				eq(contentResourceResource.resourceId, childId),
			),
			with: { resource: true },
		});

		return json(updated);
	})(request);

export const DELETE: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const parentId = searchParams.get('parentId');
		const childId = searchParams.get('childId');
		const all = searchParams.get('all');
		const { user, ability } = await getUserAbilityForRequest(request);

		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (!parentId) {
			return json({ error: 'Missing parentId parameter' }, { status: 400 });
		}

		if (!childId) {
			if (all !== '1' && all !== 'true') {
				return json(
					{
						error:
							'Missing childId. To detach all children pass ?all=1 explicitly (destructive).',
					},
					{ status: 400 },
				);
			}
			if (ability.cannot('manage', 'Content')) {
				return json({ error: 'Forbidden' }, { status: 403 });
			}

			const existing = await db
				.select({ resourceId: contentResourceResource.resourceId })
				.from(contentResourceResource)
				.where(eq(contentResourceResource.resourceOfId, parentId));

			await db
				.delete(contentResourceResource)
				.where(eq(contentResourceResource.resourceOfId, parentId));

			return json({
				parentId,
				removed: existing.length,
				removedChildren: existing.map((edge) => edge.resourceId),
			});
		}

		if (ability.cannot('delete', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const existing = await db.query.contentResourceResource.findFirst({
			where: and(
				eq(contentResourceResource.resourceOfId, parentId),
				eq(contentResourceResource.resourceId, childId),
			),
		});

		if (!existing) return json({ error: 'Edge not found' }, { status: 404 });

		await db
			.delete(contentResourceResource)
			.where(
				and(
					eq(contentResourceResource.resourceOfId, parentId),
					eq(contentResourceResource.resourceId, childId),
				),
			);

		return json({ parentId, childId, removed: 1 });
	})(request);
