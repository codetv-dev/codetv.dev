import assert from 'node:assert/strict';
import { it } from 'node:test';
import { build } from 'esbuild';

async function loadModule(path: string, mockDb?: string) {
	const bundle = await build({
		entryPoints: [new URL(path, import.meta.url).pathname],
		bundle: true,
		platform: 'node',
		format: 'esm',
		write: false,
		plugins: mockDb
			? [
					{
						name: 'fixture-db',
						setup(builder) {
							builder.onResolve({ filter: /(?:^|\/)db$/ }, () => ({
								path: 'db',
								namespace: 'fixture',
							}));
							builder.onResolve({ filter: /(?:^|\/)db\/schema$/ }, () => ({
								path: 'schema',
								namespace: 'fixture',
							}));
							builder.onResolve({ filter: /coursebuilder\/products$/ }, () => ({
								path: 'products',
								namespace: 'fixture-products',
							}));
							builder.onLoad(
								{ filter: /.*/, namespace: 'fixture-products' },
								() => ({
									contents: `export class ProductServiceError extends Error {} export const verifyMerchantProduct=async()=>({}); export const createVerifiedProduct=async()=>({}); export const updateVerifiedProductPatch=async(input)=>{globalThis.__legacyAdminFixture.writes.push(input);return {product:input,merchantVerification:{}};};`,
								}),
							);
							builder.onLoad(
								{ filter: /.*/, namespace: 'fixture' },
								({ path }) => ({
									contents:
										path === 'db'
											? mockDb
											: `export const users = {id:'id',role:'role',email:'email'}; export const purchases = {userId:'userId',createdAt:'createdAt'}; export const deviceAccessToken = {token:'token'}; export const contentResource = {id:'id',slug:'slug',type:'type'}; export const contentResourceResource = {position:'position',resourceId:'resourceId'}; export const products = {id:'id',fields:'fields',status:'status'};`,
								}),
							);
						},
					},
				]
			: [],
	});
	return import(
		`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
	);
}

it('denies guest, reviewer and contributor sessions/bearers on admin-only paths, and rejects cross-site admin writes', async () => {
	const { guardAdminRequest, isAdminPath } =
		await loadModule('./admin-access.ts');
	const { getUserAbilityForRequest } = await loadModule(
		'./ability.ts',
		`
		export const db = { query: {
			deviceAccessToken: { findFirst: async () => ({userId:'fixture'}) },
			users: { findFirst: async () => ({id:'fixture',role:'reviewer'}) }
		} };
	`,
	);
	for (const path of [
		'/admin',
		'/admin/users',
		'/admin/missing',
		'/api/admin',
		'/api/admin/users',
	]) {
		assert.equal(isAdminPath(path), true);
		for (const role of [null, 'user', 'reviewer', 'contributor']) {
			const response = await guardAdminRequest(
				new Request(`https://codetv.dev${path}`),
				async () => (role ? { id: 'u', role } : null),
				() => assert.fail('must not run admin handler'),
			);
			assert.equal(response.status, 404);
			for (const header of [
				'Cache-Control',
				'CDN-Cache-Control',
				'Netlify-CDN-Cache-Control',
			])
				assert.match(response.headers.get(header), /no-store/);
		}
		const request = new Request(`https://codetv.dev${path}`, {
			headers: { Authorization: 'Bearer fixture' },
		});
		const response = await guardAdminRequest(
			request,
			async () => (await getUserAbilityForRequest(request)).user,
			() => assert.fail('reviewer bearer must not enter'),
		);
		assert.equal(response.status, 404);
	}
	assert.equal(isAdminPath('/administrator'), false);
	const admin = async () => ({ id: 'admin', role: 'admin' });
	const crossSite = await guardAdminRequest(
		new Request('https://codetv.dev/api/admin/users/u/role', {
			method: 'PUT',
			headers: { Origin: 'https://other.example' },
		}),
		admin,
		() => assert.fail('cross-site write'),
	);
	assert.equal(crossSite.status, 403);
	const allowed = await guardAdminRequest(
		new Request('https://codetv.dev/admin'),
		admin,
		async () => new Response('admin page'),
	);
	assert.equal(await allowed.text(), 'admin page');
	assert.equal(allowed.headers.get('Cache-Control'), 'private, no-store');
});

it('CASL scopes contributors to creator/contribution ancestry and reviewers to read-only content', async () => {
	const { getAbility, contentSubject } = await loadModule('./ability-rules.ts');
	const { contentOwnerIds } = await loadModule('./content-ownership.ts');
	const nodes: Record<string, any> = {
		workshop: {
			id: 'workshop',
			createdById: 'jason',
			contributors: ['mike'],
			parentIds: [],
		},
		lesson: {
			id: 'lesson',
			createdById: 'jason',
			contributors: [],
			parentIds: ['workshop'],
		},
		video: {
			id: 'video',
			createdById: 'jason',
			contributors: [],
			parentIds: ['lesson'],
		},
		other: {
			id: 'other',
			createdById: 'elsewhere',
			contributors: [],
			parentIds: [],
		},
	};
	const mike = getAbility({ user: { id: 'mike', role: 'contributor' } });
	for (const id of ['workshop', 'lesson', 'video']) {
		const content = contentSubject({
			id,
			ownerIds: await contentOwnerIds(id, async (id: string) => nodes[id]),
		});
		for (const action of ['read', 'update', 'delete', 'publish', 'archive'])
			assert.equal(mike.can(action, content), true);
	}
	const foreign = contentSubject({ id: 'other', ownerIds: ['elsewhere'] });
	assert.equal(mike.can('read', foreign), false);
	assert.equal(mike.can('update', foreign), false);
	assert.equal(mike.can('manage', 'all'), false);
	const reviewer = getAbility({ user: { id: 'reviewer', role: 'reviewer' } });
	assert.equal(reviewer.can('read', foreign), true);
	assert.equal(reviewer.can('update', foreign), false);
	assert.equal(reviewer.can('manage', 'all'), false);
	assert.equal(
		getAbility({ user: { id: 'user', role: 'user' } }).can('read', foreign),
		false,
	);
});

it('role writes lock admins and reject last-admin removal, self-demotion and a stale acting admin', async () => {
	const state = {
		admins: [{ id: 'only' }],
		target: { id: 'only', email: 'only@example.test', role: 'admin' },
		writes: [] as unknown[],
	};
	(globalThis as any).__adminRoleFixture = state;
	const { setAdminUserRole } = await loadModule(
		'./admin-users.ts',
		`
		const s = globalThis.__adminRoleFixture;
		export const db = {transaction: async (run) => {
			let selects = 0;
			const tx = {
				select: () => ({from: () => ({where: () => ({
					orderBy: () => ({for: async (mode) => { if(mode!=='update') throw Error('missing lock'); selects++; return s.admins; }}),
					for: async (mode) => { if(mode!=='update'||selects!==1) throw Error('missing admin lock'); return [s.target]; }
				})})}),
				update: () => ({set: (value) => ({where: async () => s.writes.push(value)})})
			}; return run(tx);
		}};
	`,
	);
	try {
		await assert.rejects(
			setAdminUserRole('only', 'only', 'user'),
			/last admin/,
		);
		state.admins.push({ id: 'second' });
		await assert.rejects(
			setAdminUserRole('only', 'only', 'reviewer'),
			/demote yourself/,
		);
		await assert.rejects(
			setAdminUserRole('demoted', 'only', 'user'),
			/no longer an admin/,
		);
		assert.equal(state.writes.length, 0);
		await setAdminUserRole('second', 'only', 'contributor');
		assert.deepEqual(state.writes, [{ role: 'contributor' }]);
	} finally {
		delete (globalThis as any).__adminRoleFixture;
	}
});

it('legacy product PUT denies contributors but preserves admin device-token updates', async () => {
	const state = { role: 'contributor', writes: [] as unknown[] };
	(globalThis as any).__legacyAdminFixture = state;
	const { PUT } = await loadModule(
		'../pages/api/products.ts',
		`
		const s=globalThis.__legacyAdminFixture;
		export const db={query:{
			deviceAccessToken:{findFirst:async()=>({userId:'fixture'})},
			users:{findFirst:async()=>({id:'fixture',role:s.role})}
		}};
	`,
	);
	try {
		const request = () =>
			new Request('https://codetv.dev/api/products?id=product-fixture', {
				method: 'PUT',
				headers: {
					Authorization: 'Bearer fixture',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ id: 'product-fixture', name: 'Updated title' }),
			});
		const denied = await PUT({ request: request() });
		assert.equal(denied.status, 403);
		assert.equal(state.writes.length, 0);
		state.role = 'admin';
		const allowed = await PUT({ request: request() });
		assert.equal(allowed.status, 200);
		assert.deepEqual(state.writes, [
			{ id: 'product-fixture', name: 'Updated title' },
		]);
	} finally {
		delete (globalThis as any).__legacyAdminFixture;
	}
});

it('draft chapters remain absent publicly and appear only for server-authorized preview', async () => {
	const { getWorkshopForSale } = await loadModule(
		'../coursebuilder/workshops.ts',
		`
		export const courseBuilderAdapter={};
		export const db={query:{
			contentResource:{findFirst:async()=>({id:'workshop',slug:'sample',fields:{title:'Sample',state:'published',visibility:'public'},resourceProducts:[],resources:[
				{resource:{id:'released',type:'lesson',fields:{state:'published',title:'Released'},resources:[]}},
				{resource:{id:'draft',type:'lesson',fields:{state:'draft',title:'Draft'},resources:[]}}
			]})},
			contentResourceResource:{findMany:async()=>[]}
		}};
	`,
	);
	assert.deepEqual(
		(await getWorkshopForSale('sample')).chapters.map((c: any) => c.id),
		['released'],
	);
	assert.deepEqual(
		(
			await getWorkshopForSale(
				'sample',
				new Date(),
				async (id: string) => id === 'draft',
			)
		).chapters.map((c: any) => c.id),
		['released', 'draft'],
	);
	assert.deepEqual(
		(
			await getWorkshopForSale('sample', new Date(), async () => false)
		).chapters.map((c: any) => c.id),
		['released'],
	);
});
