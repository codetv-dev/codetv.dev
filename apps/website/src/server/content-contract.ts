import { z } from 'zod';

export const resourceId = z.string().trim().min(1).max(255);
export const resourceType = z.enum([
	'workshop',
	'section',
	'lesson',
	'videoResource',
]);
export type ResourceType = z.infer<typeof resourceType>;
export const contentFields = z.record(z.string(), z.json());
const idInput = z.object({ id: resourceId }).strict();
const relationInput = z
	.object({ parentId: resourceId, childId: resourceId })
	.strict();
const userInput = z
	.object({
		id: resourceId,
		userId: resourceId.optional(),
		email: z.email().max(255).optional(),
	})
	.strict()
	.refine(
		(v) => Boolean(v.userId) !== Boolean(v.email),
		'Provide either userId or email, not both.',
	);

/** These contracts are used by both HTTP and MCP, before any database write. */
export const contentInputs = {
	list_resources: z
		.object({
			type: resourceType.optional(),
			limit: z.number().int().min(1).max(100).default(50),
			offset: z.number().int().min(0).max(1_000_000).default(0),
		})
		.strict(),
	get_resource: idInput,
	create_resource: z
		.object({
			type: resourceType,
			title: z.string().trim().min(1).max(500),
			fields: contentFields.default({}),
		})
		.strict(),
	update_resource: z.object({ id: resourceId, fields: contentFields }).strict(),
	delete_resource: z
		.object({ id: resourceId, confirmed: z.literal(true) })
		.strict(),
	publish: idInput,
	unpublish: idInput,
	archive: idInput,
	add_to_workshop: relationInput
		.extend({
			position: z.number().int().min(0).max(1_000_000).optional(),
			metadata: contentFields.default({}),
		})
		.strict(),
	update_relation: relationInput
		.extend({
			position: z.number().int().min(0).max(1_000_000).optional(),
			metadata: contentFields.optional(),
		})
		.strict()
		.refine(
			(v) => v.position !== undefined || v.metadata !== undefined,
			'Provide position or metadata.',
		),
	remove_from_workshop: relationInput,
	reorder: z
		.object({ id: resourceId, childIds: z.array(resourceId).max(500) })
		.strict()
		.refine(
			(v) => new Set(v.childIds).size === v.childIds.length,
			'Child ids must be unique.',
		),
	attach_mux_asset: z
		.object({
			id: resourceId,
			muxAssetId: resourceId,
			playbackId: z.string().regex(/^[a-zA-Z0-9_-]{1,255}$/),
		})
		.strict(),
	list_contributors: idInput,
	add_contributor: userInput,
	remove_contributor: userInput,
	find_user: z.object({ email: z.email().max(255) }).strict(),
	set_user_role: z
		.object({
			id: resourceId,
			role: z.enum(['user', 'reviewer', 'contributor', 'admin']),
			confirmed: z.literal(true),
		})
		.strict(),
};
export type ContentOperation = keyof typeof contentInputs;
export type ContentInput<K extends ContentOperation> = z.infer<
	(typeof contentInputs)[K]
>;

export class ContentError extends Error {
	constructor(
		public status: number,
		public why: string,
		public next: string,
	) {
		super(why);
	}
	toJSON() {
		return {
			error: this.status === 404 ? 'Not found' : 'Request refused',
			why: this.why,
			next: this.next,
		};
	}
}

export function parseContentInput<K extends ContentOperation>(
	operation: K,
	value: unknown,
): ContentInput<K> {
	const parsed = contentInputs[operation].safeParse(value);
	if (!parsed.success)
		throw new ContentError(
			400,
			z.prettifyError(parsed.error),
			'Check the operation input schema and try again.',
		);
	return parsed.data as ContentInput<K>;
}

export const readOperations = new Set<ContentOperation>([
	'list_resources',
	'get_resource',
]);
export const adminOperations = new Set<ContentOperation>([
	'list_contributors',
	'add_contributor',
	'remove_contributor',
	'attach_mux_asset',
	'find_user',
	'set_user_role',
]);
