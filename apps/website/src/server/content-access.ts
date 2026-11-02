import { contentSubject, getAbility, type AbilityUser } from './ability-rules';
import { contentOwnerIds } from './content-ownership';
import { createContentStore } from './content-db';

export async function getContentSubject(id: string) {
	const store = createContentStore();
	const ownerIds = await contentOwnerIds(id, (resourceId) =>
		store.ownership(resourceId),
	);
	return contentSubject({ id, ownerIds });
}

export async function getLessonPreviewAccess(
	user: AbilityUser | null,
	lessonId: string,
) {
	if (!user || !['admin', 'reviewer', 'contributor'].includes(user.role))
		return false;
	const ability = getAbility({ user });
	if (user.role !== 'contributor') return ability.can('read', 'Content');
	return ability.can('read', await getContentSubject(lessonId));
}
