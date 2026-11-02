import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
	contentContributions,
	contentResource,
	contentResourceResource,
} from '../db/schema';
import { contentSubject, getAbility, type AbilityUser } from './ability-rules';
import { contentOwnerIds } from './content-ownership';

export async function getContentSubject(id: string) {
	const ownerIds = await contentOwnerIds(id, async (resourceId) => {
		const resource = await db.query.contentResource.findFirst({
			where: eq(contentResource.id, resourceId),
		});
		if (!resource) return null;
		const [contributions, edges, videoParents] = await Promise.all([
			db
				.select({ userId: contentContributions.userId })
				.from(contentContributions)
				.where(eq(contentContributions.contentId, resourceId)),
			db
				.select({ id: contentResourceResource.resourceOfId })
				.from(contentResourceResource)
				.where(eq(contentResourceResource.resourceId, resourceId)),
			// Lessons can attach a video through fields instead of a relation row.
			resource.type === 'videoResource'
				? db
						.select({ id: contentResource.id })
						.from(contentResource)
						.where(
							sql`JSON_UNQUOTE(JSON_EXTRACT(${contentResource.fields}, '$.videoResourceId')) = ${resourceId}`,
						)
				: Promise.resolve([]),
		]);
		return {
			id: resource.id,
			createdById: resource.createdById,
			contributors: contributions.map((c) => c.userId),
			parentIds: [...edges, ...videoParents].map((p) => p.id),
		};
	});
	return contentSubject({ id, ownerIds });
}

export async function getLessonPreviewAccess(
	user: AbilityUser | null,
	lessonId: string,
) {
	if (!user || !['admin', 'reviewer', 'contributor'].includes(user.role))
		return false;
	const ability = getAbility({ user });
	// Reviewers and admins have unconditional content read access.
	if (user.role !== 'contributor') return ability.can('read', 'Content');
	return ability.can('read', await getContentSubject(lessonId));
}
