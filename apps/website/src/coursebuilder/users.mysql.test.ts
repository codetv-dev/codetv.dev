import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { it } from 'node:test';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

// Only an explicit loopback fixture URL is used, never DATABASE_URL. The URL's
// user must be able to create/drop a database; no existing tables are touched.
it(
	'links guest rows with Clerk profiles on MySQL 8 (utf8mb4 and utf8mb3)',
	{
		skip:
			!process.env.AFE_TEST_MYSQL_URL &&
			'Set AFE_TEST_MYSQL_URL to a local disposable MySQL 8 URL',
	},
	async (t) => {
		const url = new URL(process.env.AFE_TEST_MYSQL_URL!);
		assert.ok(
			['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
			'Only a loopback fixture is allowed',
		);
		const databaseName = `afe114_${randomUUID().replaceAll('-', '')}`;
		const admin = await mysql.createConnection(url.toString());
		const dir = await mkdtemp(join(process.cwd(), '.afe114-test-'));
		let connection:
			Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
		let created = false;
		try {
			const [version] = await admin.query<mysql.RowDataPacket[]>(
				'SELECT VERSION() AS version',
			);
			assert.match(version[0].version, /^8\./, 'This proof requires MySQL 8');
			await admin.query(
				`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4`,
			);
			created = true;
			url.pathname = `/${databaseName}`;
			url.searchParams.set('charset', 'utf8mb4');
			connection = await mysql.createConnection(url.toString());
			await connection.query(
				"SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ENGINE_SUBSTITUTION'",
			);

			// Bundle only to resolve the app's extensionless TS imports. No mocks:
			// the real linker and the real schema run against the injected MySQL db.
			const outfile = join(dir, 'users.mjs');
			await build({
				stdin: {
					contents: `export { getCourseBuilderUserForClerkUser } from './src/coursebuilder/users';
					export { users } from './src/db/schema';`,
					resolveDir: process.cwd(),
					loader: 'ts',
				},
				outfile,
				bundle: true,
				platform: 'node',
				format: 'esm',
				packages: 'external',
			});
			const { users, getCourseBuilderUserForClerkUser } = await import(
				pathToFileURL(outfile).href
			);
			const schema = { users };
			const db = drizzle(connection, { schema, mode: 'default' });
			// Generate DDL from schema.ts, including the stored JSON externalId.
			// drizzle-kit 0.27's ESM entry uses dynamic require; use its CJS API.
			const { generateMySQLDrizzleJson, generateMySQLMigration } =
				createRequire(import.meta.url)(
					'drizzle-kit/api',
				) as typeof import('drizzle-kit/api');
			const empty = await generateMySQLDrizzleJson({});
			const current = await generateMySQLDrizzleJson(schema);
			for (const statement of await generateMySQLMigration(empty, current)) {
				await connection.query(statement);
			}

			const cases: {
				label: string;
				name: string;
				image: string | null;
				expectedName: string | null;
				expectedImage: string | null;
				existingImage?: string;
				existingName?: string;
			}[] = [
				{
					label: '256-char avatar',
					name: 'Ada',
					image: `https://img.clerk.com/${'a'.repeat(234)}`,
					expectedName: 'Ada',
					expectedImage: null,
				},
				{
					label: '261-char name',
					name: 'n'.repeat(261),
					image: null,
					expectedName: null,
					expectedImage: null,
				},
				{
					label: 'emoji within UTF-16 limit',
					name: '😀'.repeat(100),
					image: null,
					expectedName: '😀'.repeat(100),
					expectedImage: null,
				},
				{
					label: '128 emoji exceed UTF-16 but fit varchar',
					name: '😀'.repeat(128),
					image: null,
					expectedName: '😀'.repeat(128),
					expectedImage: null,
				},
				{
					label: '255 code points with an emoji',
					name: `${'n'.repeat(254)}😀`,
					image: null,
					expectedName: `${'n'.repeat(254)}😀`,
					expectedImage: null,
				},
				{
					label: 'keep existing short image',
					name: 'Ada',
					image: `https://img.clerk.com/${'a'.repeat(234)}`,
					existingImage: 'https://example.com/kept.png',
					expectedName: 'Ada',
					expectedImage: 'https://example.com/kept.png',
				},
				{
					label: 'keep stored name when emoji avatar needs fallback',
					name: 'Clerk Name',
					existingName: 'Ada',
					image: 'https://example.com/😀.png',
					expectedName: 'Ada',
					expectedImage: 'https://example.com/😀.png',
				},
				{
					label: 'normal user',
					name: 'Ada Lovelace',
					image: 'https://example.com/avatar.png',
					expectedName: 'Ada Lovelace',
					expectedImage: 'https://example.com/avatar.png',
				},
			];
			assert.equal(cases[0].image!.length, 256);
			for (const charset of ['utf8mb4', 'utf8mb3']) {
				// Do not convert the previous pass's valid utf8mb4 emoji rows.
				await db.delete(users);
				await connection.query(
					`ALTER TABLE ctv_User CONVERT TO CHARACTER SET ${charset}`,
				);
				for (const fixture of cases) {
					await t.test(`${charset}: ${fixture.label}`, async () => {
						const id = `guest_${randomUUID()}`;
						const email = `${id}@example.test`;
						const clerkId = `clerk_${randomUUID()}`;
						await db.insert(users).values({
							id,
							email,
							name: fixture.existingName ?? null,
							image: fixture.existingImage ?? null,
							fields: { guest: true },
						});
						const guest = await db.query.users.findFirst({
							where: eq(users.id, id),
						});
						assert.equal(guest?.externalId, null);
						const user = await getCourseBuilderUserForClerkUser(
							{
								id: clerkId,
								primaryEmailAddress: { emailAddress: email },
								fullName: fixture.name,
								imageUrl: fixture.image,
							},
							db,
						);
						const needsCharsetFallback =
							charset === 'utf8mb3' &&
							[fixture.expectedName, fixture.expectedImage].some(
								(value) =>
									value !== null && /[\u{10000}-\u{10ffff}]/u.test(value),
							);
						const expectedName = needsCharsetFallback
							? (fixture.existingName ?? null)
							: fixture.expectedName;
						const expectedImage = needsCharsetFallback
							? (fixture.existingImage ?? null)
							: fixture.expectedImage;
						assert.equal(
							user?.id,
							id,
							'must update the guest row, not insert another user',
						);
						assert.equal(user?.externalId, clerkId);
						assert.equal(user?.name, expectedName);
						assert.equal(user?.image, expectedImage);
						const stored = await db.query.users.findFirst({
							where: eq(users.id, id),
						});
						assert.equal(
							stored?.externalId,
							clerkId,
							'generated column must link the Clerk login',
						);
						assert.deepEqual(stored?.fields, {
							guest: true,
							externalId: clerkId,
						});
						assert.equal(stored?.name, expectedName);
						assert.equal(stored?.image, expectedImage);
					});
				}
			}
		} finally {
			try {
				await connection?.end();
				if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
			} finally {
				await admin.end();
				await rm(dir, { recursive: true, force: true });
			}
		}
	},
);
