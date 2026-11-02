import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { contentSubject, getAbility, type AbilityUser } from './ability-rules';
import { contentOwnerIds } from './content-ownership';
import {
	ContentError,
	resourceType,
	type ContentInput,
} from './content-contract';
import type { ContentResourceRow, ContentStore } from './content-store';

const stateSchema = z.enum(['draft', 'published', 'archived']);
const slug = (title: string) =>
	title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200) || 'content';
const transitions: Record<string, string[]> = {
	workshop: ['section', 'lesson'],
	section: ['lesson'],
	lesson: ['videoResource'],
};
const notFound = () =>
	new ContentError(
		404,
		'This content does not exist or is not accessible.',
		'List your accessible resources and use one of those ids.',
	);

export function createContentService(store: ContentStore, user: AbilityUser) {
	const ability = getAbility({ user });
	const nodeCache = new Map<string, ReturnType<ContentStore['ownership']>>();
	const loadOwnership = (s: ContentStore, id: string) => {
		// Reads share lookups only within this request. Writes use fresh tx reads.
		if (s !== store) return s.ownership(id);
		if (!nodeCache.has(id)) nodeCache.set(id, s.ownership(id));
		return nodeCache.get(id)!;
	};
	async function target(s: ContentStore, id: string, action: string) {
		const resource = await s.get(id);
		if (!resource || !resourceType.safeParse(resource.type).success)
			throw notFound();
		const ownerIds = await contentOwnerIds(id, (key) => loadOwnership(s, key));
		if (ability.cannot(action, contentSubject({ id, ownerIds }))) {
			if (action === 'read') throw notFound();
			throw new ContentError(
				403,
				'Your role does not allow this action on this resource.',
				'Use content you own or ask an admin to assign you as a contributor.',
			);
		}
		return resource;
	}
	function admin() {
		if (ability.cannot('manage', 'all'))
			throw new ContentError(
				404,
				'This operation requires an admin.',
				'Ask an admin to perform it.',
			);
	}
	function validateFields(type: string, fields: Record<string, any>) {
		if (
			fields.title !== undefined &&
			!z.string().trim().min(1).max(500).safeParse(fields.title).success
		)
			throw new ContentError(
				400,
				'Title must contain 1–500 characters.',
				'Send a non-empty title.',
			);
		if (
			fields.body !== undefined &&
			!z.string().max(1_000_000).nullable().safeParse(fields.body).success
		)
			throw new ContentError(
				400,
				'Body must be text of at most 1 MB, or null.',
				'Send a smaller text body.',
			);
		if (
			fields.startsAt !== undefined &&
			!z
				.string()
				.datetime({ offset: true })
				.nullable()
				.safeParse(fields.startsAt).success
		)
			throw new ContentError(
				400,
				'startsAt must be an ISO timestamp with timezone, or null.',
				'For example: 2026-11-09T08:00:00Z.',
			);
		if (
			fields.state !== undefined &&
			!stateSchema.safeParse(fields.state).success
		)
			throw new ContentError(
				400,
				'Invalid publish state.',
				'Use draft, published or archived.',
			);
		if (
			fields.visibility !== undefined &&
			!z.enum(['public', 'unlisted', 'private']).safeParse(fields.visibility)
				.success
		)
			throw new ContentError(
				400,
				'Invalid visibility.',
				'Use public, unlisted or private.',
			);
		if (
			fields.slug !== undefined &&
			!z
				.string()
				.regex(/^[a-zA-Z0-9_~.-]{1,255}$/)
				.safeParse(fields.slug).success
		)
			throw new ContentError(
				400,
				'Invalid slug.',
				'Use a single URL segment without spaces.',
			);
		if (
			fields.videoResourceId !== undefined &&
			(type !== 'lesson' ||
				!z.string().min(1).max(255).nullable().safeParse(fields.videoResourceId)
					.success)
		)
			throw new ContentError(
				400,
				'videoResourceId is valid only on a lesson and must be an id or null.',
				'Link an existing videoResource you own.',
			);
		if (ability.cannot('manage', 'all')) {
			const rawMux = (value: unknown): boolean =>
				Boolean(
					value &&
					typeof value === 'object' &&
					Object.entries(value).some(
						([key, item]) =>
							/mux|playback|asset[_-]?id|upload[_-]?id|passthrough/i.test(
								key,
							) || rawMux(item),
					),
				);
			if (rawMux(fields))
				throw new ContentError(
					403,
					'Raw Mux identity and playback fields are server-owned.',
					'Ask an admin to import the asset, then link an owned videoResource.',
				);
		}
		if (
			fields.playback_ids !== undefined &&
			!z
				.array(
					z
						.object({
							id: z.string().regex(/^[a-zA-Z0-9_-]{1,255}$/),
							policy: z.literal('signed'),
						})
						.strict(),
				)
				.max(20)
				.safeParse(fields.playback_ids).success
		)
			throw new ContentError(
				400,
				'Playback entries must use signed policy.',
				'Provide signed playback ids, never public playback.',
			);
		if (
			fields.muxAssetId !== undefined &&
			!z.string().min(1).max(255).safeParse(fields.muxAssetId).success
		)
			throw new ContentError(
				400,
				'Invalid Mux asset id.',
				'Provide the imported Mux asset id.',
			);
	}
	async function videoReference(s: ContentStore, fields: Record<string, any>) {
		if (typeof fields.videoResourceId !== 'string') return;
		const video = await target(s, fields.videoResourceId, 'update');
		if (video.type !== 'videoResource')
			throw new ContentError(
				400,
				'The referenced resource is not a video.',
				'Use a videoResource id.',
			);
	}
	async function statePermission(
		s: ContentStore,
		id: string,
		fields: Record<string, any>,
	) {
		if (fields.state !== undefined)
			await target(
				s,
				id,
				fields.state === 'published'
					? 'publish'
					: fields.state === 'archived'
						? 'archive'
						: 'unpublish',
			);
	}
	async function patch(input: ContentInput<'update_resource'>) {
		validateFields(
			(await target(store, input.id, 'update')).type,
			input.fields,
		);
		return store.transaction(async (tx) => {
			await tx.lock([
				input.id,
				...(typeof input.fields.videoResourceId === 'string'
					? [input.fields.videoResourceId]
					: []),
			]);
			const resource = await target(tx, input.id, 'update');
			await statePermission(tx, input.id, input.fields);
			await videoReference(tx, input.fields);
			const fields = { ...resource.fields, ...input.fields };
			await tx.patch(input.id, fields);
			nodeCache.clear();
			return { ...resource, fields };
		});
	}
	async function relationTargets(
		s: ContentStore,
		parentId: string,
		childId: string,
	) {
		const parent = await target(s, parentId, 'update');
		const child = await target(s, childId, 'update');
		// A strict type hierarchy prevents cycles, even with concurrent attaches.
		if (!transitions[parent.type]?.includes(child.type))
			throw new ContentError(
				400,
				'This parent/child type combination is not supported.',
				'Use workshop → section/lesson, section → lesson, or lesson → videoResource.',
			);
		return { parent, child };
	}
	async function contributor(
		input: ContentInput<'add_contributor'>,
		remove: boolean,
	) {
		admin();
		return store.transaction(async (tx) => {
			await tx.lock([input.id]);
			await target(tx, input.id, 'manage');
			const person = await tx.findUser(input);
			if (!person)
				throw new ContentError(
					404,
					'This user needs to sign in once first.',
					'Ask them to sign in, then look up their existing user. No user was created.',
				);
			if (remove) await tx.removeContributor(input.id, person.id);
			else await tx.addContributor(input.id, person.id);
			nodeCache.clear();
			return {
				id: input.id,
				user: person,
				contributors: await tx.contributors(input.id),
				message: remove
					? 'Direct contributions removed. Creator and inherited ownership, and user roles, are unchanged.'
					: 'Contribution assigned. This does not change the user role; set contributor separately if needed.',
			};
		});
	}
	return {
		async list_resources(input: ContentInput<'list_resources'>) {
			const rows = await store.list(input);
			const resources: ContentResourceRow[] = [];
			for (const row of rows) {
				try {
					resources.push(await target(store, row.id, 'read'));
				} catch (error) {
					if (!(error instanceof ContentError && error.status === 404))
						throw error;
				}
			}
			// Offset counts scanned rows, not owned rows. Empty pages can have a
			// nextOffset; no foreign ids or fields escape through pagination.
			return {
				resources,
				nextOffset:
					rows.length === input.limit ? input.offset + rows.length : null,
			};
		},
		async get_resource(input: ContentInput<'get_resource'>) {
			const resource = await target(store, input.id, 'read');
			const children = [];
			for (const edge of await store.edges(input.id)) {
				try {
					await target(store, edge.resourceId, 'read');
					children.push(edge);
				} catch (error) {
					if (!(error instanceof ContentError && error.status === 404))
						throw error;
				}
			}
			return { ...resource, children };
		},
		async create_resource(input: ContentInput<'create_resource'>) {
			const id = `${input.type}~${randomUUID()}`;
			const proposed = contentSubject({ id, ownerIds: [user.id] });
			if (ability.cannot('create', proposed))
				throw new ContentError(
					403,
					'Your role cannot create content.',
					'Ask an admin for contributor access.',
				);
			const fields: Record<string, any> = {
				state: 'draft',
				visibility: 'unlisted',
				...input.fields,
				title: input.title,
				slug: input.fields.slug ?? `${slug(input.title)}~${id.split('~')[1]}`,
			};
			validateFields(input.type, fields);
			if (fields.state === 'published' && ability.cannot('publish', proposed))
				throw new ContentError(
					403,
					'Your role cannot publish content.',
					'Create a draft instead.',
				);
			return store.transaction(async (tx) => {
				if (typeof fields.videoResourceId === 'string')
					await tx.lock([fields.videoResourceId]);
				await videoReference(tx, fields);
				const resource = { id, type: input.type, createdById: user.id, fields };
				await tx.insert(resource);
				nodeCache.clear();
				return resource;
			});
		},
		update_resource: patch,
		async delete_resource(input: ContentInput<'delete_resource'>) {
			return store.transaction(async (tx) => {
				await tx.lock([input.id]);
				const resource = await target(tx, input.id, 'delete');
				await tx.patch(
					input.id,
					{ ...resource.fields, state: 'archived' },
					new Date(),
				);
				nodeCache.clear();
				return {
					id: input.id,
					deleted: true,
					mode: 'soft',
					message:
						'Resource hidden. Descendants and media assets were not deleted.',
				};
			});
		},
		publish: (input: ContentInput<'publish'>) =>
			patch({ id: input.id, fields: { state: 'published' } }),
		unpublish: (input: ContentInput<'unpublish'>) =>
			patch({ id: input.id, fields: { state: 'draft' } }),
		archive: (input: ContentInput<'archive'>) =>
			patch({ id: input.id, fields: { state: 'archived' } }),
		async add_to_workshop(input: ContentInput<'add_to_workshop'>) {
			return store.transaction(async (tx) => {
				await tx.lock([input.parentId, input.childId]);
				await relationTargets(tx, input.parentId, input.childId);
				const edges = await tx.edges(input.parentId);
				if (edges.some((e) => e.resourceId === input.childId))
					throw new ContentError(
						409,
						'The relation already exists.',
						'Update its position or metadata instead.',
					);
				const edge = {
					resourceOfId: input.parentId,
					resourceId: input.childId,
					position:
						input.position ?? Math.max(-1, ...edges.map((e) => e.position)) + 1,
					metadata: input.metadata,
				};
				await tx.insertEdge(edge);
				nodeCache.clear();
				return edge;
			});
		},
		async update_relation(input: ContentInput<'update_relation'>) {
			return store.transaction(async (tx) => {
				await tx.lock([input.parentId, input.childId]);
				await relationTargets(tx, input.parentId, input.childId);
				const edge = (await tx.edges(input.parentId)).find(
					(e) => e.resourceId === input.childId,
				);
				if (!edge) throw notFound();
				const updated = {
					...edge,
					position: input.position ?? edge.position,
					metadata: { ...edge.metadata, ...input.metadata },
				};
				await tx.patchEdge(updated);
				return updated;
			});
		},
		async remove_from_workshop(input: ContentInput<'remove_from_workshop'>) {
			return store.transaction(async (tx) => {
				await tx.lock([input.parentId, input.childId]);
				await relationTargets(tx, input.parentId, input.childId);
				await tx.removeEdge(input.parentId, input.childId);
				nodeCache.clear();
				return { removed: true, ...input };
			});
		},
		async reorder(input: ContentInput<'reorder'>) {
			return store.transaction(async (tx) => {
				await tx.lock([input.id]);
				await target(tx, input.id, 'update');
				const edges = await tx.edges(input.id);
				if (
					edges.length !== input.childIds.length ||
					edges.some((e) => !input.childIds.includes(e.resourceId))
				)
					throw new ContentError(
						409,
						'The order must contain each current child exactly once.',
						'Reload the resource and submit its complete child list.',
					);
				for (const id of input.childIds) await target(tx, id, 'update');
				for (const [position, id] of input.childIds.entries())
					await tx.patchEdge({
						...edges.find((e) => e.resourceId === id)!,
						position,
					});
				return { id: input.id, childIds: input.childIds };
			});
		},
		async attach_mux_asset(input: ContentInput<'attach_mux_asset'>) {
			admin();
			const resource = await target(store, input.id, 'update');
			if (resource.type !== 'videoResource')
				throw new ContentError(
					400,
					'Mux assets attach only to videoResources.',
					'Create or select a videoResource first.',
				);
			return patch({
				id: input.id,
				fields: {
					muxAssetId: input.muxAssetId,
					playback_ids: [{ id: input.playbackId, policy: 'signed' }],
				},
			});
		},
		async list_contributors(input: ContentInput<'list_contributors'>) {
			admin();
			await target(store, input.id, 'manage');
			return { id: input.id, contributors: await store.contributors(input.id) };
		},
		add_contributor: (input: ContentInput<'add_contributor'>) =>
			contributor(input, false),
		remove_contributor: (input: ContentInput<'remove_contributor'>) =>
			contributor(input, true),
	};
}
