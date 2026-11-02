import type { APIContext } from 'astro';
import { privateLessonHeaders } from '../coursebuilder/workshop-lessons';
import {
	ContentError,
	adminOperations,
	type ContentOperation,
} from './content-contract';
import { getAbility } from './ability-rules';
import { contentOperationsForUser } from './content-runtime';

export const contentJson = (value: unknown, status = 200) =>
	Response.json(value, { status, headers: privateLessonHeaders });
export function contentFailure(error: unknown) {
	if (error instanceof ContentError)
		return contentJson(error.toJSON(), error.status);
	console.error(
		'Content operation failed',
		error instanceof Error ? error.name : 'Unknown error',
	);
	return contentJson(
		{
			error: 'Request failed',
			why: 'The content operation could not be completed.',
			next: 'Reload the resource and try again.',
		},
		500,
	);
}
export async function readContentJson(request: Request) {
	const tooLarge = () =>
		new ContentError(
			413,
			'Content requests are limited to 2 MB.',
			'Split the update into smaller requests.',
		);
	if (Number(request.headers.get('Content-Length') ?? 0) > 2_000_000)
		throw tooLarge();
	const reader = request.body?.getReader();
	try {
		const decoder = new TextDecoder();
		let bytes = 0;
		let text = '';
		// Bound streamed input too; Content-Length is not an authorization or
		// memory-safety boundary when a caller uses chunked transfer encoding.
		if (reader)
			while (true) {
				const chunk = await reader.read();
				if (chunk.done) break;
				bytes += chunk.value.byteLength;
				if (bytes > 2_000_000) {
					await reader.cancel().catch(() => undefined);
					throw tooLarge();
				}
				text += decoder.decode(chunk.value, { stream: true });
			}
		return JSON.parse(text + decoder.decode());
	} catch (error) {
		if (error instanceof ContentError) throw error;
		throw new ContentError(
			400,
			'The request is not valid JSON.',
			'Send an application/json object matching the operation schema.',
		);
	} finally {
		reader?.releaseLock();
	}
}
export async function contentRoute(
	context: Pick<APIContext, 'locals'>,
	operation: ContentOperation,
	input: () => Promise<unknown> | unknown,
	status = 200,
) {
	const viewer = context.locals.contentViewer;
	if (!viewer)
		return contentJson(
			{
				error: 'Not found',
				why: 'Content access is required.',
				next: 'Sign in with an authorized account or use its device bearer token.',
			},
			404,
		);
	if (
		adminOperations.has(operation) &&
		getAbility({ user: viewer }).cannot('manage', 'all')
	)
		return contentJson(
			{
				error: 'Not found',
				why: 'This operation requires an admin.',
				next: 'Ask an admin to perform it.',
			},
			404,
		);
	try {
		return contentJson(
			await contentOperationsForUser(viewer)(operation, await input()),
			status,
		);
	} catch (error) {
		return contentFailure(error);
	}
}
