import type { AbilityUser } from './ability-rules';
import { ContentError } from './content-contract';
import { createContentStore } from './content-db';
import { createOperationRunner } from './content-operations';
import {
	AdminInputError,
	findAdminUser,
	setAdminUserRole,
} from './admin-users';

export function contentOperationsForUser(user: AbilityUser) {
	return createOperationRunner(createContentStore(), user, {
		find_user: ({ email }) => findAdminUser(email),
		async set_user_role({ id, role }) {
			try {
				return await setAdminUserRole(user.id, id, role);
			} catch (error) {
				if (error instanceof AdminInputError)
					throw new ContentError(
						error.status,
						error.message,
						'Reload the user, check your admin role, and try again.',
					);
				throw error;
			}
		},
	});
}
