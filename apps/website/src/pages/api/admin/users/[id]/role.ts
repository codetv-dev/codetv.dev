import type { APIRoute } from 'astro';
import {
	AdminInputError,
	setAdminUserRole,
} from '../../../../../server/admin-users';
import {
	ADMIN_ROLES,
	type AdminRole,
} from '../../../../../server/admin-access';
import { adminJson, adminResult } from '../../../../../server/admin-http';

export const prerender = false;
export const PUT: APIRoute = async ({ locals, request, params }) => {
	if (!locals.adminViewer)
		return adminJson(
			{
				error: 'Not found',
				why: 'Admin access is required.',
				next: 'Sign in as an admin.',
			},
			404,
		);
	return adminResult(async () => {
		let input: unknown;
		try {
			input = await request.json();
		} catch {
			throw new AdminInputError('Send a JSON object with role and confirmed.');
		}
		if (
			!input ||
			typeof input !== 'object' ||
			!('role' in input) ||
			!('confirmed' in input) ||
			input.confirmed !== true ||
			!ADMIN_ROLES.includes(input.role as AdminRole)
		)
			throw new AdminInputError('Select a valid role and confirm the change.');
		return setAdminUserRole(
			locals.adminViewer!.id,
			params.id ?? '',
			input.role as AdminRole,
		);
	});
};
