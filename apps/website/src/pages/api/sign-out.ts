import type { APIRoute } from 'astro';
import { clerk } from '@codetv/clerk';

export const GET: APIRoute = async ({ locals, redirect }) => {
	const sessionId = locals.auth().sessionId;

	if (sessionId) {
		await clerk.sessions.revokeSession(sessionId);
	}

	return redirect('/dashboard/sign-out', 307);
};
