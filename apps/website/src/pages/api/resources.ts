import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';

import { db } from '../../db';
import { contentResource } from '../../db/schema';
import { getUserAbilityForRequest } from '../../server/ability';
import { withSkill } from '../../server/with-skill';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, init: ResponseInit = {}) {
	return Response.json(body, {
		...init,
		headers: {
			...corsHeaders,
			...(init.headers ?? {}),
		},
	});
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 220);
}

export const OPTIONS: APIRoute = async () => json({});

export const GET: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { searchParams } = new URL(request.url);
		const slugOrId = searchParams.get('slugOrId');
		const type = searchParams.get('type');

		if (!slugOrId) {
			return json({ error: 'Missing slugOrId parameter' }, { status: 400 });
		}

		const { ability } = await getUserAbilityForRequest(request);
		const resource = await db.query.contentResource.findFirst({
			where: and(
				or(eq(contentResource.id, slugOrId), eq(contentResource.slug, slugOrId)),
				...(type ? [eq(contentResource.type, type)] : []),
			),
		});

		if (!resource) {
			return json({ error: 'Resource not found' }, { status: 404 });
		}

		const fields = (resource.fields ?? {}) as Record<string, unknown>;
		const isPublicResource =
			fields.state === 'published' && fields.visibility === 'public';

		if (!isPublicResource && ability.cannot('update', 'Content')) {
			return json({ error: 'Resource not found' }, { status: 404 });
		}

		return json(resource);
	})(request);

export const POST: APIRoute = async ({ request }) =>
	withSkill(async (request) => {
		const { user, ability } = await getUserAbilityForRequest(request);

		if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
		if (ability.cannot('create', 'Content')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await request.json();
		const type = body?.type;
		const title = body?.title;
		const inputFields = body?.fields ?? {};

		if (!type || typeof type !== 'string') {
			return json({ error: 'Missing or invalid "type" field' }, { status: 400 });
		}

		if (!title || typeof title !== 'string' || title.trim().length < 2) {
			return json(
				{ error: 'Missing or invalid "title" field (min 2 characters)' },
				{ status: 400 },
			);
		}

		const hash = crypto.randomUUID().slice(0, 8);
		const id = `${slugify(type)}~${hash}`;
		const fields = {
			title: title.trim(),
			state: 'draft',
			visibility: 'unlisted',
			...inputFields,
			slug: inputFields.slug ?? `${slugify(title)}~${hash}`,
		};

		await db.insert(contentResource).values({
			id,
			type,
			fields,
			createdById: user.id,
		});

		const resource = await db.query.contentResource.findFirst({
			where: eq(contentResource.id, id),
		});

		return json(resource ?? { id, type, fields }, { status: 201 });
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
		if (!id) return json({ error: 'Missing id parameter' }, { status: 400 });

		const currentResource = await db.query.contentResource.findFirst({
			where: eq(contentResource.id, id),
		});

		if (!currentResource) {
			return json({ error: 'Resource not found' }, { status: 404 });
		}

		const body = await request.json();
		const mergedFields = {
			...((currentResource.fields ?? {}) as Record<string, unknown>),
			...(body.fields ?? {}),
		};

		await db
			.update(contentResource)
			.set({ fields: mergedFields })
			.where(eq(contentResource.id, id));

		const resource = await db.query.contentResource.findFirst({
			where: eq(contentResource.id, id),
		});

		return json(resource ?? { ...currentResource, fields: mergedFields });
	})(request);
