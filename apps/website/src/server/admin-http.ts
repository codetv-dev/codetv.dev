import { privateLessonHeaders } from '../coursebuilder/workshop-lessons';
import { AdminInputError } from './admin-users';

export const adminJson = (value: unknown, status = 200) =>
	Response.json(value, { status, headers: privateLessonHeaders });

export async function adminResult(run: () => Promise<unknown>) {
	try {
		return adminJson(await run());
	} catch (error) {
		if (error instanceof AdminInputError)
			return adminJson(
				{
					error: 'Request refused',
					why: error.message,
					next: 'Check the input and reload the user before trying again.',
				},
				error.status,
			);
		console.error(
			'Admin request failed',
			error instanceof Error ? error.name : 'Unknown error',
		);
		return adminJson(
			{
				error: 'Request failed',
				why: 'The database request could not be completed.',
				next: 'Reload and try again.',
			},
			500,
		);
	}
}
