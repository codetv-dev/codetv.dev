import { privateLessonHeaders } from '../coursebuilder/workshop-lessons';
import { getAbility } from './ability-rules';

export type AdminViewer = { id: string; role: string };
export function isAdminPath(path: string) {
	try {
		path = decodeURIComponent(path);
	} catch {
		/* Router rejects malformed escapes. */
	}
	return /^\/(?:api\/)?admin(?:\/|$)/.test(path);
}

/** Only these API branches admit scoped content roles; admin pages stay admin-only. */
export function isContentApiPath(path: string) {
	try {
		path = decodeURIComponent(path);
	} catch {
		/* Router rejects malformed escapes. */
	}
	return /^\/api\/admin\/(?:resources|mcp)(?:\/|$)/.test(path);
}

/** Outer response wrapper also covers denied requests and unknown admin routes. */
export async function guardAdminRequest(
	request: Request,
	resolveViewer: () => Promise<AdminViewer | null>,
	next: (viewer: AdminViewer) => Promise<Response>,
	access: 'admin' | 'content' = 'admin',
) {
	const viewer = await resolveViewer();
	let response: Response;
	if (
		!viewer ||
		(access === 'content'
			? !['admin', 'reviewer', 'contributor'].includes(viewer.role)
			: getAbility({ user: viewer }).cannot('manage', 'all'))
	) {
		response = Response.json(
			{
				error: 'Not found',
				why:
					access === 'admin'
						? 'Admin access is required.'
						: 'An admin, reviewer or contributor role is required.',
				next: 'Sign in with an authorized account.',
			},
			{ status: 404 },
		);
	} else if (
		!request.headers.has('authorization') &&
		!['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
		request.headers.get('origin') !== new URL(request.url).origin
	) {
		// Session-cookie writes require same-origin forms, not cross-site requests.
		response = Response.json(
			{
				error: 'Forbidden',
				why: 'Cross-origin writes are not allowed.',
				next: 'Submit from this site or use an authorized bearer token.',
			},
			{ status: 403 },
		);
	} else {
		response = await next(viewer);
	}
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(privateLessonHeaders))
		headers.set(key, value);
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export const ADMIN_ROLES = [
	'user',
	'reviewer',
	'contributor',
	'admin',
] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Called while the admin rows are locked, including the acting admin. */
export function roleChangeError({
	actorId,
	targetId,
	role,
	currentRole,
	adminIds,
}: {
	actorId: string;
	targetId: string;
	role: string;
	currentRole: string;
	adminIds: string[];
}) {
	if (!ADMIN_ROLES.includes(role as AdminRole)) return 'Invalid role.';
	if (currentRole === 'admin' && role !== 'admin' && adminIds.length <= 1)
		return 'The last admin cannot be removed.';
	if (!adminIds.includes(actorId)) return 'You are no longer an admin.';
	if (actorId === targetId && role !== 'admin')
		return 'You cannot demote yourself.';
	return null;
}
