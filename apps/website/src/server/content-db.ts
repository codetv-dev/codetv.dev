import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
	contentContributions,
	contentResource,
	contentResourceResource,
	contributionTypes,
	users,
} from '../db/schema';
import type { ContentStore } from './content-store';

type Connection =
	typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export function createContentStore(connection: Connection = db): ContentStore {
	const store: ContentStore = {
		transaction: (run) =>
			connection.transaction((tx) => run(createContentStore(tx))),
		async lock(ids) {
			if (ids.length)
				await connection
					.select({ id: contentResource.id })
					.from(contentResource)
					.where(inArray(contentResource.id, [...new Set(ids)].sort()))
					.orderBy(asc(contentResource.id))
					.for('update');
		},
		async get(id) {
			return (
				(await connection.query.contentResource.findFirst({
					where: and(
						eq(contentResource.id, id),
						isNull(contentResource.deletedAt),
					),
				})) ?? null
			);
		},
		async list({ type, limit, offset }) {
			return connection.query.contentResource.findMany({
				where: and(
					isNull(contentResource.deletedAt),
					type
						? eq(contentResource.type, type)
						: inArray(contentResource.type, [
								'workshop',
								'section',
								'lesson',
								'videoResource',
							]),
				),
				orderBy: asc(contentResource.id),
				limit,
				offset,
			});
		},
		async ownership(id) {
			const resource = await store.get(id);
			if (!resource) return null;
			const [contributions, parents, videos] = await Promise.all([
				connection
					.select({ userId: contentContributions.userId })
					.from(contentContributions)
					.where(
						and(
							eq(contentContributions.contentId, id),
							eq(contentContributions.active, true),
							isNull(contentContributions.deletedAt),
						),
					),
				connection
					.select({ id: contentResourceResource.resourceOfId })
					.from(contentResourceResource)
					.where(
						and(
							eq(contentResourceResource.resourceId, id),
							isNull(contentResourceResource.deletedAt),
						),
					),
				resource.type === 'videoResource'
					? connection
							.select({ id: contentResource.id })
							.from(contentResource)
							.where(
								and(
									isNull(contentResource.deletedAt),
									eq(contentResource.type, 'lesson'),
									sql`JSON_UNQUOTE(JSON_EXTRACT(${contentResource.fields}, '$.videoResourceId')) = ${id}`,
								),
							)
					: Promise.resolve([]),
			]);
			return {
				id,
				createdById: resource.createdById,
				contributors: contributions.map((c) => c.userId),
				parentIds: [...parents, ...videos].map((p) => p.id),
			};
		},
		async edges(id) {
			return connection
				.select({
					resourceOfId: contentResourceResource.resourceOfId,
					resourceId: contentResourceResource.resourceId,
					position: contentResourceResource.position,
					metadata: contentResourceResource.metadata,
				})
				.from(contentResourceResource)
				.innerJoin(
					contentResource,
					eq(contentResourceResource.resourceId, contentResource.id),
				)
				.where(
					and(
						eq(contentResourceResource.resourceOfId, id),
						isNull(contentResourceResource.deletedAt),
						isNull(contentResource.deletedAt),
					),
				)
				.orderBy(
					asc(contentResourceResource.position),
					asc(contentResourceResource.resourceId),
				);
		},
		async insert(resource) {
			await connection.insert(contentResource).values(resource);
		},
		async patch(id, fields, deletedAt) {
			await connection
				.update(contentResource)
				.set({
					fields,
					updatedAt: new Date(),
					...(deletedAt ? { deletedAt } : {}),
				})
				.where(eq(contentResource.id, id));
		},
		async insertEdge(edge) {
			await connection
				.insert(contentResourceResource)
				.values(edge)
				.onDuplicateKeyUpdate({
					set: {
						position: edge.position,
						metadata: edge.metadata,
						deletedAt: null,
						updatedAt: new Date(),
					},
				});
		},
		async patchEdge(edge) {
			await connection
				.update(contentResourceResource)
				.set({
					position: edge.position,
					metadata: edge.metadata,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(contentResourceResource.resourceOfId, edge.resourceOfId),
						eq(contentResourceResource.resourceId, edge.resourceId),
					),
				);
		},
		async removeEdge(parentId, childId) {
			await connection
				.delete(contentResourceResource)
				.where(
					and(
						eq(contentResourceResource.resourceOfId, parentId),
						eq(contentResourceResource.resourceId, childId),
					),
				);
		},
		async findUser(input) {
			const row = await connection.query.users.findFirst({
				where: input.userId
					? eq(users.id, input.userId)
					: eq(users.email, input.email!),
			});
			return row ? { id: row.id, email: row.email, role: row.role } : null;
		},
		async contributors(id) {
			return connection
				.select({
					id: contentContributions.id,
					userId: contentContributions.userId,
					email: users.email,
					role: users.role,
					contributionTypeId: contentContributions.contributionTypeId,
				})
				.from(contentContributions)
				.leftJoin(users, eq(users.id, contentContributions.userId))
				.where(
					and(
						eq(contentContributions.contentId, id),
						eq(contentContributions.active, true),
						isNull(contentContributions.deletedAt),
					),
				);
		},
		async addContributor(id, userId) {
			if ((await store.contributors(id)).some((row) => row.userId === userId))
				return;
			// Provision only the existing Course Builder contribution type, never a user.
			await connection
				.insert(contributionTypes)
				.values({
					id: `contribution-type_${randomUUID()}`,
					slug: 'contributor',
					name: 'Contributor',
				})
				.onDuplicateKeyUpdate({
					set: { active: true, deletedAt: null, updatedAt: new Date() },
				});
			const type = await connection.query.contributionTypes.findFirst({
				where: eq(contributionTypes.slug, 'contributor'),
			});
			if (!type) throw new Error('Contributor type could not be resolved');
			await connection.insert(contentContributions).values({
				id: `contribution_${randomUUID()}`,
				contentId: id,
				userId,
				contributionTypeId: type.id,
				active: true,
			});
		},
		async removeContributor(id, userId) {
			// All active contribution types confer ownership. Revoke each direct row;
			// creator and ancestor ownership are separate and intentionally unchanged.
			await connection
				.update(contentContributions)
				.set({ active: false, deletedAt: new Date(), updatedAt: new Date() })
				.where(
					and(
						eq(contentContributions.contentId, id),
						eq(contentContributions.userId, userId),
						eq(contentContributions.active, true),
					),
				);
		},
	};
	return store;
}
