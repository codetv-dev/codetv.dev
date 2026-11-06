import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Client } from '@planetscale/database';
import { getTableColumns } from 'drizzle-orm';
import type { MySqlTable } from 'drizzle-orm/mysql-core';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

it('runs a content write through the real PlanetScale HTTP transaction with sequential fresh ownership reads', async () => {
	// Bundle local TS imports just like the API suite. Only the default DB is
	// replaced; the store, service, schema, drizzle and database-js are real.
	const dir = await mkdtemp(
		fileURLToPath(new URL('../../node_modules/.driver-test-', import.meta.url)),
	);
	try {
		await build({
			stdin: {
				contents: `
					export { createContentStore } from './content-db.ts';
					export { createContentService } from './content-service.ts';
					export * as schema from '../db/schema.ts';
				`,
				resolveDir: new URL('.', import.meta.url).pathname,
			},
			outfile: `${dir}/driver.mjs`,
			bundle: true,
			platform: 'node',
			format: 'esm',
			packages: 'external',
			plugins: [
				{
					name: 'no-default-database',
					setup(builder) {
						builder.onResolve({ filter: /^\.\.\/db$/ }, () => ({
							path: 'db',
							namespace: 'stub',
						}));
						builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
							contents: 'export const db = {};',
						}));
					},
				},
			],
		});
		const { createContentStore, createContentService, schema } = await import(
			pathToFileURL(`${dir}/driver.mjs`).href
		);
		const columns = Object.values(
			getTableColumns(schema.contentResource as MySqlTable),
		);
		const fields = columns.map((c) => ({
			name: c.name,
			type: c.dataType === 'json' ? 'JSON' : 'VARCHAR',
		}));
		const values: Record<string, string> = {
			id: 'lesson',
			type: 'lesson',
			createdById: 'admin',
			fields: JSON.stringify({
				title: 'Unchanged title',
				body: 'Keep this body',
			}),
			createdAt: '2026-11-06 00:00:00.000',
			updatedAt: '2026-11-06 00:00:00.000',
		};
		const row = fields.map((field) => values[field.name] ?? null);
		let transaction = false;
		let inFlight = false;
		let version = 0;
		const sql: string[] = [];
		const client = new Client({
			host: 'synthetic.invalid',
			username: 'synthetic',
			password: 'synthetic',
			fetch: async (_url, init) => {
				const body = JSON.parse(String(init?.body));
				sql.push(body.query);
				if (transaction) {
					assert.equal(
						inFlight,
						false,
						'HTTP transaction queries must not overlap',
					);
					assert.deepEqual(
						body.session,
						{ version },
						'reuse the latest transaction session',
					);
				}
				inFlight = true;
				await new Promise<void>((resolve) => setImmediate(resolve));
				inFlight = false;
				if (body.query === 'BEGIN') transaction = true;
				const resource = body.query.startsWith('select `id`, `organizationId`');
				const result = {
					fields: resource ? fields : [],
					rows: resource
						? [
								{
									lengths: row.map((v) =>
										v === null ? '-1' : String(Buffer.byteLength(v)),
									),
									values: Buffer.from(
										row.filter((v) => v !== null).join(''),
									).toString('base64'),
								},
							]
						: [],
					rowsAffected: '1',
					insertId: '0',
				};
				return Response.json({
					result,
					...(transaction ? { session: { version: ++version } } : {}),
				});
			},
		});
		const real = drizzle(client, { schema });
		// Match the lazy db proxy's receiver behavior too.
		const proxy = new Proxy(real, {
			get(_target, key, receiver) {
				return Reflect.get(real, key, receiver);
			},
		});
		const service = createContentService(createContentStore(proxy), {
			id: 'admin',
			role: 'admin',
		});
		const updated = await service.update_resource({
			id: 'lesson',
			fields: { title: 'Unchanged title' },
		});
		assert.deepEqual(updated.fields, {
			title: 'Unchanged title',
			body: 'Keep this body',
		});
		const begin = sql.indexOf('BEGIN');
		assert.ok(begin >= 0);
		assert.match(sql[begin + 1], /for update$/);
		assert.ok(
			sql
				.slice(begin + 2)
				.some((query) => query.includes('ctv_ContentContribution')),
		);
		assert.match(
			sql.at(-2)!,
			/^update .*`updatedAt` = '\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}'/,
		);
		assert.equal(sql.at(-1), 'COMMIT');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
