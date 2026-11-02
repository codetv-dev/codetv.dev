import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
	mkdtemp,
	rm,
	mkdir,
	readFile,
	writeFile,
	symlink,
} from 'node:fs/promises';
import { dev } from 'astro';
import netlify from '@astrojs/netlify';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type {
	ContentStore,
	ContentResourceRow,
	ContentEdge,
	ContentUser,
} from './content-store';

function memoryStore() {
	const rows = new Map<string, ContentResourceRow>([
		[
			'workshop',
			{
				id: 'workshop',
				type: 'workshop',
				createdById: 'admin',
				fields: {
					title: 'Workshop',
					state: 'published',
					slug: 'sold-workshop',
					visibility: 'public',
				},
			},
		],
		[
			'lesson',
			{
				id: 'lesson',
				type: 'lesson',
				createdById: 'admin',
				fields: {
					title: 'Lesson',
					body: 'Owned exercise',
					state: 'draft',
					startsAt: '2099-01-01T00:00:00Z',
				},
			},
		],
		[
			'video',
			{
				id: 'video',
				type: 'videoResource',
				createdById: 'admin',
				fields: { title: 'Video' },
			},
		],
		[
			'foreign',
			{
				id: 'foreign',
				type: 'lesson',
				createdById: 'other',
				fields: { title: 'Foreign', body: 'FOREIGN_SECRET', state: 'draft' },
			},
		],
		[
			'foreign-video',
			{
				id: 'foreign-video',
				type: 'videoResource',
				createdById: 'other',
				fields: { title: 'Foreign video' },
			},
		],
	]);
	const edges: ContentEdge[] = [
		{
			resourceOfId: 'workshop',
			resourceId: 'lesson',
			position: 0,
			metadata: {},
		},
		{ resourceOfId: 'lesson', resourceId: 'video', position: 0, metadata: {} },
	];
	const people: ContentUser[] = [
		'admin',
		'mike',
		'reviewer',
		'user',
		'other',
		'new-contributor',
	].map((id) => ({
		id,
		email: `${id}@example.test`,
		role:
			id === 'mike' || id === 'other' || id === 'new-contributor'
				? 'contributor'
				: id,
	}));
	const contributions = [
		{ id: 'assignment', contentId: 'workshop', userId: 'mike', active: true },
	];
	const store: ContentStore = {
		transaction: async (run) => run(store),
		lock: async () => {},
		get: async (id) =>
			rows.get(id)?.deletedAt ? null : (rows.get(id) ?? null),
		list: async ({ type, offset, limit }) =>
			[...rows.values()]
				.filter((r) => !r.deletedAt && (!type || r.type === type))
				.sort((a, b) => a.id.localeCompare(b.id))
				.slice(offset, offset + limit),
		ownership: async (id) => {
			const row = await store.get(id);
			if (!row) return null;
			return {
				id,
				createdById: row.createdById,
				contributors: contributions
					.filter((c) => c.contentId === id && c.active)
					.map((c) => c.userId),
				parentIds: [
					...edges
						.filter((e) => e.resourceId === id)
						.map((e) => e.resourceOfId),
					...[...rows.values()]
						.filter(
							(r) =>
								!r.deletedAt &&
								r.type === 'lesson' &&
								r.fields?.videoResourceId === id,
						)
						.map((r) => r.id),
				],
			};
		},
		edges: async (id) =>
			edges
				.filter(
					(e) =>
						e.resourceOfId === id &&
						rows.has(e.resourceId) &&
						!rows.get(e.resourceId)?.deletedAt,
				)
				.sort((a, b) => a.position - b.position),
		insert: async (row) => {
			rows.set(row.id, row);
		},
		patch: async (id, fields, deletedAt) => {
			const row = rows.get(id)!;
			rows.set(id, { ...row, fields, ...(deletedAt ? { deletedAt } : {}) });
		},
		insertEdge: async (edge) => {
			edges.push(edge);
		},
		patchEdge: async (edge) => {
			Object.assign(
				edges.find(
					(e) =>
						e.resourceOfId === edge.resourceOfId &&
						e.resourceId === edge.resourceId,
				)!,
				edge,
			);
		},
		removeEdge: async (parent, child) => {
			const i = edges.findIndex(
				(e) => e.resourceOfId === parent && e.resourceId === child,
			);
			if (i >= 0) edges.splice(i, 1);
		},
		findUser: async ({ userId, email }) =>
			people.find((u) => (userId ? u.id === userId : u.email === email)) ??
			null,
		contributors: async (id) =>
			contributions
				.filter((c) => c.contentId === id && c.active)
				.map((c) => ({
					...c,
					email: people.find((u) => u.id === c.userId)?.email ?? null,
					role: people.find((u) => u.id === c.userId)?.role ?? null,
					contributionTypeId: 'contributor',
				})),
		addContributor: async (id, userId) => {
			if (
				!contributions.some(
					(c) => c.contentId === id && c.userId === userId && c.active,
				)
			)
				contributions.push({
					id: `assignment-${contributions.length}`,
					contentId: id,
					userId,
					active: true,
				});
		},
		removeContributor: async (id, userId) => {
			contributions
				.filter((c) => c.contentId === id && c.userId === userId)
				.forEach((c) => (c.active = false));
		},
	};
	return { store, rows, edges, people, contributions };
}

async function fixture(run: (f: any) => Promise<void>) {
	const dir = await mkdtemp(
		new URL('../../.test-content-', import.meta.url).pathname,
	);
	const state = memoryStore();
	(globalThis as any).__contentDbFixture = state;
	try {
		const files: Record<string, string> = {
			'./admin-access.ts': 'guardAdminRequest,isContentApiPath',
			'./ability.ts': 'getUserAbilityForRequest',
			'./content-operations.ts': 'createOperationRunner',
			'../pages/api/admin/resources/index.ts':
				'GET as listResources,POST as createResource',
			'../pages/api/admin/resources/[id].ts':
				'GET as getResource,PUT as updateResource,DELETE as deleteResource',
			'../pages/api/admin/resources/[id]/contributors.ts':
				'POST as addContributor,DELETE as removeContributor',
			'../pages/api/admin/resources/[id]/[action].ts': 'POST as action',
			'../pages/api/admin/resources/[id]/reorder.ts': 'PUT as reorder',
			'../pages/api/admin/resources/edges.ts':
				'POST as addEdge,PATCH as updateEdge,DELETE as removeEdge',
			'../pages/api/admin/mcp.ts': 'ALL as mcp',
		};
		await build({
			stdin: {
				contents: Object.entries(files)
					.map(
						([path, exports]) =>
							`export {${exports}} from ${JSON.stringify(new URL(path, import.meta.url).pathname)};`,
					)
					.join('\n'),
				resolveDir: new URL('.', import.meta.url).pathname,
			},
			outfile: `${dir}/api.mjs`,
			bundle: true,
			platform: 'node',
			format: 'esm',
			packages: 'external',
			plugins: [
				{
					name: 'external-io-only',
					setup(builder) {
						builder.onResolve({ filter: /(?:^|\/)content-runtime$/ }, () => ({
							path: 'runtime',
							namespace: 'fixture',
						}));
						builder.onResolve({ filter: /(?:^|\/)db$/ }, () => ({
							path: 'db',
							namespace: 'fixture',
						}));
						builder.onResolve({ filter: /(?:^|\/)db\/schema$/ }, () => ({
							path: 'schema',
							namespace: 'fixture',
						}));
						builder.onLoad(
							{ filter: /.*/, namespace: 'fixture' },
							({ path }) => ({
								contents:
									path === 'runtime'
										? `export const contentOperationsForUser=(user)=>globalThis.__contentRuntime(user);`
										: path === 'schema'
											? `export const users={id:'id'};export const deviceAccessToken={token:'token'};`
											: `
				const param=(where)=>where.queryChunks.findLast(c=>typeof c==='string');
				export const db={query:{deviceAccessToken:{findFirst:async({where})=>{const id=param(where);return globalThis.__contentDbFixture.people.some(u=>u.id===id)?{userId:id}:null;}},users:{findFirst:async({where})=>globalThis.__contentDbFixture.people.find(u=>u.id===param(where))}}};
			`,
							}),
						);
					},
				},
			],
		});
		const api = await import(pathToFileURL(`${dir}/api.mjs`).href);
		(globalThis as any).__contentRuntime = (user: any) =>
			api.createOperationRunner(state.store, user, {
				find_user: async ({ email }: any) => ({
					user: state.people.find((u) => u.email === email) ?? null,
					purchases: [],
				}),
				set_user_role: async ({ id, role }: any) => {
					const person = state.people.find((u) => u.id === id)!;
					person.role = role;
					return { user: person };
				},
			});
		const call = async (
			handler: string,
			path: string,
			token?: string,
			method = 'GET',
			body?: unknown,
			extra: Record<string, string> = {},
		) => {
			const request = new Request(`https://codetv.dev${path}`, {
				method,
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					'Content-Type': 'application/json',
					...extra,
				},
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			});
			return route(request, handler);
		};
		async function route(request: Request, handler = 'mcp') {
			const url = new URL(request.url);
			const parts = url.pathname.split('/');
			const params = { id: parts[4], action: parts[5] };
			return api.guardAdminRequest(
				request,
				async () => (await api.getUserAbilityForRequest(request)).user,
				async (viewer: any) =>
					api[handler]({
						request,
						url,
						params,
						locals: {
							contentViewer: viewer,
							...(viewer.role === 'admin' ? { adminViewer: viewer } : {}),
						},
					}),
				api.isContentApiPath(url.pathname) ? 'content' : 'admin',
			);
		}
		await run({
			dir,
			...state,
			api,
			call,
			route,
			execute: (id: string) =>
				api.createOperationRunner(
					state.store,
					state.people.find((u) => u.id === id)!,
				),
		});
	} finally {
		delete (globalThis as any).__contentRuntime;
		delete (globalThis as any).__contentDbFixture;
		await rm(dir, { recursive: true, force: true });
	}
}

it('HTTP uses the stored bearer role, scopes every resource, and rejects a contributor Mux signing oracle', async () =>
	fixture(async ({ call, rows }: any) => {
		for (const token of [undefined, 'user', 'invalid']) {
			const response = await call(
				'listResources',
				'/api/admin/resources',
				token,
				'GET',
				undefined,
				{ 'X-Scopes': 'manage:all content:write' },
			);
			assert.equal(response.status, 404);
			assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
			assert.equal(
				(
					await call('mcp', '/api/admin/mcp', token, 'POST', {
						jsonrpc: '2.0',
						id: 1,
						method: 'tools/list',
					})
				).status,
				404,
			);
		}
		const mine = await call(
			'getResource',
			'/api/admin/resources/lesson',
			'mike',
		);
		assert.equal((await mine.json()).fields.body, 'Owned exercise');
		assert.equal(
			(await call('getResource', '/api/admin/resources/foreign', 'mike'))
				.status,
			404,
		);
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/foreign',
					'mike',
					'PUT',
					{ fields: { body: 'stolen' } },
				)
			).status,
			403,
		);
		assert.equal(rows.get('foreign').fields.body, 'FOREIGN_SECRET');
		for (const fields of [
			{ slug: 'changed-slug' },
			{ state: 'draft' },
			{ visibility: 'private' },
		]) {
			assert.equal(
				(
					await call(
						'updateResource',
						'/api/admin/resources/workshop',
						'mike',
						'PUT',
						{ fields },
					)
				).status,
				403,
			);
		}
		assert.equal(
			(
				await call(
					'deleteResource',
					'/api/admin/resources/workshop',
					'mike',
					'DELETE',
					{ confirmed: true },
				)
			).status,
			403,
		);
		assert.equal(
			(
				await call(
					'action',
					'/api/admin/resources/workshop/unpublish',
					'mike',
					'POST',
				)
			).status,
			403,
		);
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/workshop',
					'mike',
					'PUT',
					{ fields: { body: 'Workshop text remains editable' } },
				)
			).status,
			200,
		);
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/workshop',
					'admin',
					'PUT',
					{ fields: { slug: 'admin-changed-slug' } },
				)
			).status,
			200,
		);
		const edited = await call(
			'updateResource',
			'/api/admin/resources/lesson',
			'mike',
			'PUT',
			{ fields: { body: 'Edited exercise', startsAt: '2099-02-01T00:00:00Z' } },
		);
		assert.equal(edited.status, 200);
		assert.equal(rows.get('lesson').fields.body, 'Edited exercise');
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/lesson',
					'reviewer',
					'PUT',
					{ fields: { body: 'no' } },
				)
			).status,
			403,
		);
		assert.equal(
			(await call('getResource', '/api/admin/resources/foreign', 'reviewer'))
				.status,
			200,
		);
		const listed = JSON.stringify(
			await (
				await call('listResources', '/api/admin/resources?limit=100', 'mike')
			).json(),
		);
		assert.doesNotMatch(listed, /FOREIGN_SECRET|foreign-video|"foreign"/);
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/lesson',
					'mike',
					'PUT',
					{ fields: { videoResourceId: 'foreign-video' } },
				)
			).status,
			403,
		);
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/lesson',
					'mike',
					'PUT',
					{ createdById: 'mike', fields: { title: 'Forged' } },
				)
			).status,
			400,
		);
		const payload = {
			fields: {
				playback_ids: [{ id: 'known-foreign-playback', policy: 'signed' }],
			},
		};
		const refused = await call(
			'updateResource',
			'/api/admin/resources/video',
			'mike',
			'PUT',
			payload,
		);
		assert.equal(refused.status, 403);
		assert.match((await refused.json()).why, /server-owned/);
		assert.equal(rows.get('video').fields.playback_ids, undefined);
		const imported = await call(
			'updateResource',
			'/api/admin/resources/video',
			'admin',
			'PUT',
			payload,
		);
		assert.equal(imported.status, 200);
		assert.equal(
			rows.get('video').fields.playback_ids[0].id,
			'known-foreign-playback',
		);
		assert.equal(imported.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/lesson',
					'mike',
					'PUT',
					{ fields: { body: 'x'.repeat(2_000_001) } },
				)
			).status,
			413,
		);
	}));

it('owned content CRUD covers structure, ordering, publish state and tombstones without foreign relation grafts', async () =>
	fixture(async ({ execute, rows }: any) => {
		const run = execute('mike');
		const workshop = await run('create_resource', {
			type: 'workshop',
			title: 'My workshop',
		});
		await assert.rejects(
			run('create_resource', {
				type: 'workshop',
				title: 'Shadow sold workshop',
				fields: { slug: 'sold-workshop' },
			}),
			/server-slugged/,
		);
		const lesson = await run('create_resource', {
			type: 'lesson',
			title: 'My chapter',
			fields: { body: 'Draft exercise' },
		});
		const video = await run('create_resource', {
			type: 'videoResource',
			title: 'My video',
		});
		assert.equal(lesson.createdById, 'mike');
		assert.equal(lesson.fields.state, 'draft');
		await assert.rejects(
			run('add_to_workshop', { parentId: workshop.id, childId: 'foreign' }),
			/does not allow/,
		);
		await assert.rejects(
			run('add_to_workshop', { parentId: 'foreign', childId: video.id }),
			/does not allow/,
		);
		await run('add_to_workshop', { parentId: workshop.id, childId: lesson.id });
		await run('add_to_workshop', { parentId: lesson.id, childId: video.id });
		await assert.rejects(
			run('add_to_workshop', { parentId: video.id, childId: workshop.id }),
			/type combination/,
		);
		await assert.rejects(
			run('reorder', { id: workshop.id, childIds: [] }),
			/each current child/,
		);
		await run('reorder', { id: workshop.id, childIds: [lesson.id] });
		await run('update_relation', {
			parentId: workshop.id,
			childId: lesson.id,
			metadata: { label: 'Chapter one' },
		});
		const structure = await run('get_resource', { id: workshop.id });
		assert.equal(structure.children[0].metadata.label, 'Chapter one');
		await run('update_resource', {
			id: lesson.id,
			fields: { videoResourceId: video.id, startsAt: '2099-01-01T00:00:00Z' },
		});
		await run('publish', { id: lesson.id });
		assert.equal(rows.get(lesson.id).fields.state, 'published');
		await run('unpublish', { id: lesson.id });
		assert.equal(rows.get(lesson.id).fields.state, 'draft');
		await run('archive', { id: lesson.id });
		assert.equal(rows.get(lesson.id).fields.state, 'archived');
		await run('remove_from_workshop', {
			parentId: lesson.id,
			childId: video.id,
		});
		await run('delete_resource', { id: video.id, confirmed: true });
		await assert.rejects(
			run('get_resource', { id: video.id }),
			/does not exist/,
		);
		assert.ok(rows.get(video.id).deletedAt);
		assert.ok(rows.get(lesson.id));
		await assert.rejects(
			run('update_resource', {
				id: lesson.id,
				fields: { startsAt: 'tomorrow' },
			}),
			/ISO timestamp/,
		);
		await run('delete_resource', { id: lesson.id, confirmed: true });
		await run('reorder', { id: workshop.id, childIds: [] });
		assert.deepEqual(
			(await run('get_resource', { id: workshop.id })).children,
			[],
		);
	}));

it('only admins assign existing contributors and direct revocation removes inherited access on the next request', async () =>
	fixture(async ({ call, execute, people, contributions }: any) => {
		const path = '/api/admin/resources/workshop/contributors';
		const size = people.length;
		assert.equal(
			(
				await call('addContributor', path, 'mike', 'POST', {
					email: 'new-contributor@example.test',
				})
			).status,
			404,
		);
		assert.equal(
			(
				await call('addContributor', path, 'admin', 'POST', {
					email: 'missing@example.test',
				})
			).status,
			404,
		);
		assert.equal(people.length, size);
		assert.equal(
			(
				await call(
					'getResource',
					'/api/admin/resources/video',
					'new-contributor',
				)
			).status,
			404,
		);
		assert.equal(
			(
				await call('addContributor', path, 'admin', 'POST', {
					email: 'new-contributor@example.test',
				})
			).status,
			200,
		);
		assert.equal(
			(
				await call(
					'getResource',
					'/api/admin/resources/video',
					'new-contributor',
				)
			).status,
			200,
		);
		assert.equal(
			(
				await call('removeContributor', path, 'admin', 'DELETE', {
					userId: 'new-contributor',
				})
			).status,
			200,
		);
		assert.equal(
			(
				await call(
					'getResource',
					'/api/admin/resources/video',
					'new-contributor',
				)
			).status,
			404,
		);
		assert.equal(
			contributions.find((c: any) => c.userId === 'new-contributor').active,
			false,
		);
		await execute('admin')('remove_contributor', {
			id: 'workshop',
			userId: 'mike',
		});
		assert.equal(
			(
				await call(
					'updateResource',
					'/api/admin/resources/lesson',
					'mike',
					'PUT',
					{ fields: { title: 'After revocation' } },
				)
			).status,
			403,
		);
	}));

it('MCP Streamable HTTP client round-trips through the same operations, filters tools and never upgrades a token role', async () =>
	fixture(async ({ route, rows }: any) => {
		async function clientFor(token: string) {
			const client = new Client({ name: 'fixture', version: '1.0.0' });
			await client.connect(
				new StreamableHTTPClientTransport(
					new URL('https://codetv.dev/api/admin/mcp'),
					{
						requestInit: { headers: { Authorization: `Bearer ${token}` } },
						fetch: async (input, init) => route(new Request(input, init)),
					},
				),
			);
			return client;
		}
		const contributor = await clientFor('mike');
		const reviewer = await clientFor('reviewer');
		const admin = await clientFor('admin');
		try {
			const names = (await contributor.listTools()).tools.map((t) => t.name);
			assert.ok(names.includes('create_resource'));
			assert.ok(names.includes('delete_resource'));
			for (const name of [
				'set_user_role',
				'find_user',
				'add_contributor',
				'attach_mux_asset',
				'sales_summary',
			])
				assert.ok(!names.includes(name));
			const readNames = (await reviewer.listTools()).tools.map((t) => t.name);
			assert.deepEqual(readNames.sort(), ['get_resource', 'list_resources']);
			const created = await contributor.callTool({
				name: 'create_resource',
				arguments: { type: 'lesson', title: 'MCP chapter' },
			});
			const data = (created.structuredContent as any).data;
			assert.equal(data.createdById, 'mike');
			await contributor.callTool({
				name: 'update_resource',
				arguments: { id: data.id, fields: { body: 'MCP edited' } },
			});
			assert.equal(rows.get(data.id).fields.body, 'MCP edited');
			const denied = await contributor.callTool({
				name: 'update_resource',
				arguments: { id: 'foreign', fields: { body: 'stolen' } },
			});
			assert.equal(denied.isError, true);
			assert.match((denied.structuredContent as any).why, /does not allow/);
			const roleDenied = await contributor.callTool({
				name: 'set_user_role',
				arguments: { id: 'mike', role: 'admin', confirmed: true },
			});
			assert.equal(roleDenied.isError, true);
			const adminNames = (await admin.listTools()).tools.map((t) => t.name);
			assert.ok(adminNames.includes('add_contributor'));
			const assigned = await admin.callTool({
				name: 'add_contributor',
				arguments: { id: 'workshop', email: 'new-contributor@example.test' },
			});
			assert.equal(assigned.isError, undefined);
			assert.equal(
				(assigned.structuredContent as any).data.user.id,
				'new-contributor',
			);
			const read = await reviewer.callTool({
				name: 'get_resource',
				arguments: { id: 'foreign' },
			});
			assert.equal(
				(read.structuredContent as any).data.fields.body,
				'FOREIGN_SECRET',
			);
			await admin.callTool({
				name: 'set_user_role',
				arguments: { id: 'mike', role: 'reviewer', confirmed: true },
			});
			const afterDemotion = await contributor.callTool({
				name: 'create_resource',
				arguments: {
					type: 'lesson',
					title: 'Token must not retain contributor rights',
				},
			});
			assert.equal(afterDemotion.isError, true);
			assert.deepEqual(
				(await contributor.listTools()).tools.map((t) => t.name).sort(),
				['get_resource', 'list_resources'],
			);
		} finally {
			await contributor.close();
			await reviewer.close();
			await admin.close();
		}
	}));

it('Astro routes wire real middleware, session CSRF and resource/MCP handlers without live services', async () =>
	fixture(async ({ dir }: any) => {
		const root = `${dir}/astro`;
		async function file(path: string, text: string) {
			await mkdir(`${root}/${path.substring(0, path.lastIndexOf('/'))}`, {
				recursive: true,
			});
			await writeFile(`${root}/${path}`, text);
		}
		for (const path of [
			'middleware.ts',
			'coursebuilder/workshop-cache.ts',
			'coursebuilder/clerk-cookies.ts',
			'coursebuilder/workshop-lessons.ts',
			'server/admin-access.ts',
			'server/ability-rules.ts',
			'server/ability.ts',
			'server/content-http.ts',
			'server/content-contract.ts',
			'server/content-mcp.ts',
			'pages/api/admin/mcp.ts',
			'pages/api/admin/resources/index.ts',
			'pages/api/admin/resources/[id].ts',
			'pages/api/admin/resources/[id]/contributors.ts',
			'pages/api/admin/resources/[id]/[action].ts',
			'pages/api/admin/resources/[id]/reorder.ts',
			'pages/api/admin/resources/edges.ts',
		])
			await file(
				`src/${path}`,
				await readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
			);
		await symlink(
			new URL('../../node_modules', import.meta.url).pathname,
			`${root}/node_modules`,
			'dir',
		);
		await file(
			'src/coursebuilder/users.ts',
			'export const findCourseBuilderUserForClerkUser=async(user)=>user;',
		);
		await file(
			'src/server/content-runtime.ts',
			'export const contentOperationsForUser=(user)=>globalThis.__contentRuntime(user);',
		);
		await file(
			'src/db/schema.ts',
			`export const users={id:'id'};export const deviceAccessToken={token:'token'};`,
		);
		await file(
			'src/db/index.ts',
			`
		const param=(where)=>where.queryChunks.findLast(c=>typeof c==='string');
		export const db={query:{deviceAccessToken:{findFirst:async({where})=>{const id=param(where);return globalThis.__contentDbFixture.people.some(u=>u.id===id)?{userId:id}:null;}},users:{findFirst:async({where})=>globalThis.__contentDbFixture.people.find(u=>u.id===param(where))}}};
	`,
		);
		await file(
			'src/clerk-fixture.ts',
			`export const clerkMiddleware=()=>async(context,next)=>{const id=context.request.headers.get('cookie')?.match(/__session=([^;]+)/)?.[1];context.locals.currentUser=async()=>globalThis.__contentDbFixture.people.find(u=>u.id===id)??null;context.locals.auth=()=>({userId:id});return next();};`,
		);
		const server = await dev({
			root,
			configFile: false,
			output: 'server',
			adapter: netlify(),
			devToolbar: { enabled: false },
			vite: {
				resolve: {
					alias: { '@clerk/astro/server': `${root}/src/clerk-fixture.ts` },
				},
			},
			server: { host: '127.0.0.1', port: 0 },
			logLevel: 'silent',
		});
		const base = `http://127.0.0.1:${server.address.port}`;
		try {
			const guest = await fetch(`${base}/api/admin/resources`);
			assert.equal(guest.status, 404);
			assert.equal(guest.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
			const read = await fetch(`${base}/api/admin/resources/lesson`, {
				headers: { Authorization: 'Bearer mike' },
			});
			assert.equal(read.status, 200, await read.clone().text());
			assert.equal((await read.json()).fields.body, 'Owned exercise');
			const signedIn = await fetch(`${base}/api/admin/resources/foreign`, {
				headers: { Cookie: '__session=reviewer' },
			});
			assert.equal(signedIn.status, 200);
			const write = (origin?: string) =>
				fetch(`${base}/api/admin/resources/lesson`, {
					method: 'PUT',
					headers: {
						Cookie: '__session=mike',
						'Content-Type': 'application/json',
						...(origin ? { Origin: origin } : {}),
					},
					body: JSON.stringify({ fields: { body: 'Session edit' } }),
				});
			assert.equal((await write()).status, 403);
			assert.equal((await write(base)).status, 200);
			const assign = await fetch(
				`${base}/api/admin/resources/workshop/contributors`,
				{
					method: 'POST',
					headers: {
						Authorization: 'Bearer admin',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ email: 'new-contributor@example.test' }),
				},
			);
			assert.equal(assign.status, 200);
			const inherited = await fetch(`${base}/api/admin/resources/video`, {
				headers: { Authorization: 'Bearer new-contributor' },
			});
			assert.equal(inherited.status, 200);
			const client = new Client({ name: 'astro-fixture', version: '1.0.0' });
			try {
				await client.connect(
					new StreamableHTTPClientTransport(new URL(`${base}/api/admin/mcp`), {
						requestInit: { headers: { Authorization: 'Bearer reviewer' } },
					}),
				);
				assert.deepEqual(
					(await client.listTools()).tools.map((t) => t.name).sort(),
					['get_resource', 'list_resources'],
				);
			} finally {
				await client.close();
			}
		} finally {
			await server.stop();
		}
	}));
