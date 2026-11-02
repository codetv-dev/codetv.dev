import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';

export type AbilityUser = { id: string; role: string };
export type ContentOwnership = { id: string; ownerIds: string[] };
export const contentSubject = (content: ContentOwnership) =>
	subject('Content', content);

/** One role policy for lesson pages, HTTP handlers and machine tools. */
export function getAbility(options: { user?: AbilityUser | null } = {}) {
	const { can, rules } = new AbilityBuilder(createMongoAbility);
	const user = options.user;
	if (user?.role === 'admin') can('manage', 'all');
	if (user?.role === 'reviewer') can('read', 'Content');
	if (user?.role === 'contributor') {
		can('create', 'Content');
		can(['manage', 'save', 'publish', 'unpublish', 'archive'], 'Content', {
			ownerIds: { $in: [user.id] },
		});
	}
	// Preserve the existing signed-in read permission for non-content subjects.
	if (user) can('read', 'User', { id: user.id });
	return createMongoAbility(rules);
}
