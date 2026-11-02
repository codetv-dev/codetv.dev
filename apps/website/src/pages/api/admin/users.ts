import type { APIRoute } from 'astro';
import { findAdminUser } from '../../../server/admin-users';
import { adminJson, adminResult } from '../../../server/admin-http';

export const prerender = false;
export const GET: APIRoute = async ({ locals, url }) => {
	if (!locals.adminViewer)
		return adminJson(
			{
				error: 'Not found',
				why: 'Admin access is required.',
				next: 'Sign in as an admin.',
			},
			404,
		);
	return adminResult(() =>
		findAdminUser(url.searchParams.get('email')?.trim() ?? ''),
	);
};
