import { getAbility, type AbilityUser } from './ability-rules';
import {
	ContentError,
	adminOperations,
	parseContentInput,
	type ContentOperation,
	type ContentInput,
} from './content-contract';
import { createContentService } from './content-service';
import type { ContentStore } from './content-store';

export type OperationRunner = (
	operation: ContentOperation,
	input: unknown,
) => Promise<unknown>;
export type UserOperations = {
	find_user(input: ContentInput<'find_user'>): Promise<unknown>;
	set_user_role(input: ContentInput<'set_user_role'>): Promise<unknown>;
};

/** HTTP routes and MCP call this same validated, resource-scoped dispatcher. */
export function createOperationRunner(
	store: ContentStore,
	user: AbilityUser,
	userOperations?: UserOperations,
): OperationRunner {
	const service = createContentService(store, user);
	return async (operation, raw) => {
		if (
			adminOperations.has(operation) &&
			getAbility({ user }).cannot('manage', 'all')
		)
			throw new ContentError(
				404,
				'This operation requires an admin.',
				'Ask an admin to perform it.',
			);
		const input = parseContentInput(operation, raw);
		if (operation === 'find_user') {
			if (!userOperations)
				throw new ContentError(
					503,
					'User operations are unavailable.',
					'Try again later.',
				);
			return userOperations.find_user(input as ContentInput<'find_user'>);
		}
		if (operation === 'set_user_role') {
			if (!userOperations)
				throw new ContentError(
					503,
					'User operations are unavailable.',
					'Try again later.',
				);
			return userOperations.set_user_role(
				input as ContentInput<'set_user_role'>,
			);
		}
		const handler = service[operation] as (input: unknown) => Promise<unknown>;
		return handler(input);
	};
}
