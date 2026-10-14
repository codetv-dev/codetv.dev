import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { it } from 'node:test';
import { build } from 'esbuild';
import mysql from 'mysql2/promise';

/**
 * Opt-in local MySQL proof. Never uses DATABASE_URL. The supplied admin URL
 * must point to loopback; this test creates and drops only its own schema.
 * Run: CODETV_GUEST_TEST_MYSQL_URL=<local admin URL> pnpm test
 * Only Stripe session creation and the database connection are replaced. The
 * actual Astro server, site config, provider selection, core fulfillment,
 * DrizzleAdapter, Clerk linking, access and route guards run real code.
 */
it(
	'guest fulfillment grants the email user a ticket, Clerk links it, and owners cannot buy twice',
	{
		skip:
			!process.env.CODETV_GUEST_TEST_MYSQL_URL &&
			'Set CODETV_GUEST_TEST_MYSQL_URL to a local MySQL admin URL for integration proof',
	},
	async () => {
		const url = new URL(process.env.CODETV_GUEST_TEST_MYSQL_URL!);
		assert.ok(
			['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname),
			'Only a local fixture is allowed',
		);
		const schemaName = `codetv_guest_${Date.now()}`;
		const admin = await mysql.createConnection(url.toString());
		const dir = await mkdtemp(join(process.cwd(), '.guest-checkout-test-'));
		let connection:
			Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
		let created = false;
		const env = {
			COURSEBUILDER_URL: '',
			PUBLIC_SITE_URL: '',
			CONTEXT: 'deploy-preview',
			DEPLOY_PRIME_URL: 'https://codetv.dev',
			COURSEBUILDER_STRIPE_SECRET_TOKEN: '',
			COURSEBUILDER_STRIPE_SECRET_KEY: '',
			STRIPE_SECRET_TOKEN: '',
			STRIPE_SECRET_KEY: 'sk_test_fixture',
			COURSEBUILDER_STRIPE_WEBHOOK_SECRET: '',
			STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
		};
		const previousEnv = Object.fromEntries(
			Object.keys(env).map((key) => [key, process.env[key]]),
		);
		Object.assign(process.env, env);
		try {
			await admin.query(`CREATE DATABASE \`${schemaName}\``);
			created = true;
			url.pathname = `/${schemaName}`;
			connection = await mysql.createConnection(url.toString());
			const migration = await readFile(
				'src/db/generated/0000_plain_firestar.sql',
				'utf8',
			);
			for (const statement of migration.split('--> statement-breakpoint')) {
				if (statement.trim()) await connection.query(statement);
			}

			const outfile = join(dir, 'fixture.mjs');
			await build({
				stdin: {
					contents: `
					export * from './src/db/index';
					export * as schema from './src/db/schema';
					export { createInlineCommerceEvents } from './src/coursebuilder/fulfillment';
					export { getCourseBuilderUserForClerkUser } from './src/coursebuilder/users';
					export { getTicketPurchase } from './src/coursebuilder/workshops';
					export { getCheckoutStatus } from './src/coursebuilder/checkout-status';
					export { POST } from './src/pages/api/coursebuilder/[...coursebuilder]';
					export { checkoutAttempts } from './src/coursebuilder/stripe-provider';
				`,
					resolveDir: process.cwd(),
					loader: 'ts',
				},
				outfile,
				bundle: true,
				platform: 'node',
				format: 'esm',
				packages: 'external',
				define: { 'import.meta.env.DEV': 'false', 'import.meta.env': '{}' },
				plugins: [
					{
						name: 'local-database-and-stripe-boundary',
						setup(builder) {
							builder.onLoad({ filter: /src\/db\/index\.ts$/ }, () => ({
								contents: `
							import { drizzle } from 'drizzle-orm/mysql2';
							import { DrizzleAdapter } from '@coursebuilder/adapter-drizzle';
							import * as schema from './schema';
							import { mysqlTable } from './mysql-table';
							export let db, courseBuilderAdapter;
							export const getCourseBuilderAdapter = () => courseBuilderAdapter;
							export function configure(connection) {
								db = drizzle(connection, { schema, mode: 'default' });
								courseBuilderAdapter = DrizzleAdapter(db, mysqlTable);
							}
						`,
								loader: 'ts',
								resolveDir: resolve('src/db'),
							}));
							builder.onResolve(
								{ filter: /^@coursebuilder\/astro\/server$/ },
								() => ({
									path: fileURLToPath(
										import.meta.resolve('@coursebuilder/astro/server'),
									),
								}),
							);
							builder.onResolve({ filter: /^coursebuilder:config$/ }, () => ({
								path: resolve('coursebuilder.config.ts'),
							}));
							builder.onLoad(
								{ filter: /src\/coursebuilder\/stripe-provider\.ts$/ },
								async (args) => ({
									contents:
										(await readFile(args.path, 'utf8')).replace(
											'export function getStripeProvider()',
											'function getConfiguredStripeProvider()',
										) +
										`
									export const checkoutAttempts = [];
									export function getStripeProvider() {
										const provider = getConfiguredStripeProvider();
										if (provider) provider.createCheckoutSession = async (params) => {
											checkoutAttempts.push(params);
											return {redirect: 'https://checkout.stripe.com/c/pay/cs_test_fixture'};
										};
										return provider;
									}
								`,
									loader: 'ts',
									resolveDir: resolve('src/coursebuilder'),
								}),
							);
						},
					},
				],
			});
			const fixture = await import(pathToFileURL(outfile).href);
			fixture.configure(connection);
			const { db, schema, courseBuilderAdapter: adapter } = fixture;
			await db.insert(schema.products).values({
				id: 'ticket',
				name: 'Workshop Ticket',
				type: 'cohort',
				status: 1,
				fields: { slug: 'fixture' },
			});
			await db.insert(schema.merchantAccount).values({
				id: 'merchant',
				identifier: 'stripe',
				label: 'stripe',
				status: 1,
			});
			await db.insert(schema.merchantProduct).values({
				id: 'mproduct',
				identifier: 'prod_fixture',
				merchantAccountId: 'merchant',
				productId: 'ticket',
			});

			const context = (clerkUser: unknown = null) => {
				const url = new URL(
					'https://codetv.dev/api/coursebuilder/checkout/stripe?productId=ticket&cancelUrl=https%3A%2F%2Fcodetv.dev%2Fworkshops%2Ffixture&userId=forged',
				);
				return {
					url,
					request: new Request(url, { method: 'POST' }),
					locals: { currentUser: async () => clerkUser },
					clientAddress: '127.0.0.1',
				};
			};
			const guestCheckout = await fixture.POST(context());
			assert.equal(guestCheckout.status, 303);
			assert.equal(
				new URL(guestCheckout.headers.get('location')).hostname,
				'checkout.stripe.com',
			);
			assert.equal(
				await db.$count(schema.users),
				0,
				'No account is needed before paying',
			);
			assert.equal(
				fixture.checkoutAttempts[0].userId,
				undefined,
				'Browser user ids cannot turn guests into another buyer',
			);
			assert.equal(
				fixture.checkoutAttempts[0].cancelUrl,
				'https://codetv.dev/workshops/fixture',
			);
			const clerk = {
				id: 'clerk_guest',
				primaryEmailAddress: { emailAddress: 'guest@example.com' },
			};

			const fulfill = async (email: string, suffix: string) => {
				const sessionId = `cs_test_${suffix}`;
				const events = fixture.createInlineCommerceEvents({
					getAdapter: () => adapter,
					getPaymentProvider: () => ({
						options: {
							paymentsAdapter: {
								getCheckoutSession: async () => ({
									id: sessionId,
									customer: {
										id: `cus_${suffix}`,
										email,
										name: 'Fixture Buyer',
									},
									line_items: {
										data: [
											{
												quantity: 1,
												price: {
													product: {
														id: 'prod_fixture',
														name: 'Workshop Ticket',
													},
												},
												discounts: [],
											},
										],
									},
									payment_intent: {
										id: `pi_${suffix}`,
										latest_charge: { id: `ch_${suffix}`, amount: 30000 },
									},
									metadata: { country: 'US' },
									amount_total: 30000,
								}),
							},
						},
					}),
					siteRootUrl: 'https://codetv.dev',
				});
				await events.send({
					name: 'stripe/checkout-session-completed',
					data: {
						stripeEvent: {
							id: `evt_${suffix}`,
							created: 1760000000,
							type: 'checkout.session.completed',
							data: {
								object: {
									id: sessionId,
									object: 'checkout.session',
									amount_subtotal: 30000,
									amount_total: 30000,
									created: 1760000000,
									currency: 'usd',
									custom_fields: [],
									customer: `cus_${suffix}`,
									customer_details: {
										address: {
											city: null,
											country: 'US',
											line1: null,
											line2: null,
											postal_code: null,
											state: null,
										},
										email,
										name: 'Fixture Buyer',
									},
									livemode: false,
									metadata: { productId: 'ticket' },
									mode: 'payment',
									payment_intent: `pi_${suffix}`,
									subscription: null,
									payment_method_collection: 'always',
									payment_status: 'paid',
									phone_number_collection: { enabled: false },
									status: 'complete',
									success_url: 'https://codetv.dev/thanks/purchase',
									total_details: {
										amount_discount: 0,
										amount_shipping: 0,
										amount_tax: 0,
									},
								},
							},
						},
					},
				});
				return sessionId;
			};
			const email = 'guest@example.com';
			const sessionId = await fulfill(email, 'guest');
			const guest = await adapter.getUserByEmail(email);
			assert.ok(guest);
			const ticket = await fixture.getTicketPurchase(guest.id, ['ticket']);
			assert.ok(ticket, 'A guest payment creates a real accessible ticket');
			const linked = await fixture.getCourseBuilderUserForClerkUser(clerk);
			assert.equal(linked.id, guest.id);
			assert.equal(linked.fields.externalId, clerk.id);
			assert.equal(
				(await fixture.getTicketPurchase(linked.id, ['ticket'])).id,
				ticket.id,
			);
			assert.equal(
				(await fixture.getCourseBuilderUserForClerkUser(clerk)).id,
				guest.id,
				'Subsequent Clerk logins keep the same user',
			);
			const ownerCheckout = await fixture.POST(context(clerk));
			assert.equal(
				new URL(ownerCheckout.headers.get('location')).searchParams.get(
					'checkout',
				),
				'already-purchased',
			);
			assert.equal(await db.$count(schema.purchases), 1);
			assert.equal(
				fixture.checkoutAttempts.length,
				1,
				'An owner never starts another Stripe checkout',
			);
			const signedInBuyer = {
				id: 'clerk_new',
				primaryEmailAddress: { emailAddress: 'signedin@example.com' },
			};
			const signedInCheckout = await fixture.POST(context(signedInBuyer));
			assert.equal(signedInCheckout.status, 303);
			assert.equal(
				fixture.checkoutAttempts[1].userId,
				(await adapter.getUserByEmail('signedin@example.com')).id,
			);

			// An existing account bought as a guest is also matched, not duplicated.
			const existing = await adapter.findOrCreateUser('existing@example.com');
			const otherSession = await fulfill(existing.user.email, 'existing');
			assert.ok(await fixture.getTicketPurchase(existing.user.id, ['ticket']));
			assert.equal(await db.$count(schema.users), 3);
			const status = await fixture.getCheckoutStatus(sessionId);
			const otherStatus = await fixture.getCheckoutStatus(otherSession);
			assert.equal(status.status, 'ready');
			assert.equal(status.buyerEmail, email);
			assert.equal(otherStatus.buyerEmail, existing.user.email);
			assert.notEqual(status.purchaseId, otherStatus.purchaseId);
			assert.equal(
				(await fixture.getCheckoutStatus('not-a-session')).status,
				'error',
			);
		} finally {
			for (const [key, value] of Object.entries(previousEnv)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
			await connection?.end();
			if (created) {
				await admin.query(`DROP DATABASE \`${schemaName}\``);
				console.info(`Guest fixture ${schemaName} dropped`);
			}
			await admin.end();
			await rm(dir, { recursive: true, force: true });
		}
	},
);
