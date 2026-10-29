import assert from 'node:assert/strict';
import { it, mock } from 'node:test';
import { createWorkshopKit } from './kit-workshops.ts';
import { createInlineCommerceEvents } from './fulfillment.ts';
import { scoreInterest, workshopMarketing } from './workshop-interest.ts';
import { POST } from '../pages/api/workshops/interest.ts';

const productId = 'product-4gmhd';
const slug = workshopMarketing[productId].productSlug;
const purchasedAt = new Date('2026-10-29T12:00:00Z');

it('drops malformed, unconfigured and forged purchase beacons and returns 204 during a Kit outage', async () => {
	const fetchMock = mock.method(globalThis, 'fetch', async () => {
		throw new Error('Kit offline');
	});
	const logs = mock.method(console, 'error', () => {});
	const oldSecret = process.env.KIT_SECRET_KEY;
	process.env.KIT_SECRET_KEY = 'fixture-key';
	try {
		const invalid = [
			'not json',
			JSON.stringify({
				subscriberId: '../42',
				signal: 'landing',
				workshop: 'agentic-frontend-engineering',
			}),
			JSON.stringify({
				subscriberId: '42',
				signal: 'purchase',
				workshop: 'agentic-frontend-engineering',
			}),
			JSON.stringify({
				subscriberId: '42',
				signal: 'landing',
				workshop: 'unknown',
			}),
			JSON.stringify({ subscriberId: '42', signal: 'landing', workshop: slug }),
		];
		for (const body of invalid) {
			const response = await POST({
				request: new Request('https://codetv.dev/api/workshops/interest', {
					method: 'POST',
					body,
				}),
			} as any);
			assert.equal(response.status, 204);
		}
		assert.equal(fetchMock.mock.callCount(), 0);
		const response = await POST({
			request: new Request('https://codetv.dev/api/workshops/interest', {
				method: 'POST',
				body: JSON.stringify({
					subscriberId: '42',
					signal: 'landing',
					workshop: 'agentic-frontend-engineering',
				}),
			}),
		} as any);
		assert.equal(response.status, 204);
		assert.equal(response.headers.get('Cache-Control'), 'no-store');
		assert.equal(fetchMock.mock.callCount(), 1);
	} finally {
		fetchMock.mock.restore();
		logs.mock.restore();
		if (oldSecret === undefined) delete process.env.KIT_SECRET_KEY;
		else process.env.KIT_SECRET_KEY = oldSecret;
	}
});

/** Stateful v3 HTTP fixture, including multiple pages and secret placement. */
function kitFixture() {
	const subscriber = {
		id: 42,
		email_address: 'buyer@example.com',
		fields: {} as Record<string, string>,
	};
	let exists = false;
	const fields: { key: string }[] = [];
	const memberships = new Set<number>();
	const tags = [{ id: 20, name: 'afe-warm' }];
	const adds: number[] = [];
	const updates: Record<string, string>[] = [];
	const fetcher = (async (
		input: string | URL | Request,
		init?: RequestInit,
	) => {
		const url = new URL(String(input));
		const body = init?.body ? JSON.parse(String(init.body)) : {};
		const method = init?.method ?? 'GET';
		assert.equal(
			method === 'GET' ? url.searchParams.get('api_secret') : body.api_secret,
			'fixture-key',
		);
		if (method !== 'GET')
			assert.equal(url.searchParams.has('api_secret'), false);
		let result: unknown;
		const page = (key: string, items: unknown[]) => ({
			[key]: items,
			total_pages: 1,
		});
		if (url.pathname === '/v3/subscribers') {
			assert.equal(method, 'GET');
			result = page('subscribers', exists ? [subscriber] : []);
		} else if (url.pathname === '/v3/subscribers/42') {
			if (method === 'PUT') {
				for (const key of Object.keys(body.fields))
					assert.ok(
						fields.some((field) => field.key === key),
						`missing field ${key}`,
					);
				updates.push(body.fields);
				Object.assign(subscriber.fields, body.fields);
			}
			result = { subscriber };
		} else if (url.pathname === '/v3/subscribers/42/tags')
			result = page(
				'tags',
				[...memberships].map((id) => ({ id })),
			);
		else if (url.pathname === '/v3/custom_fields') {
			if (method === 'POST') {
				const field = { key: body.label };
				fields.push(field);
				result = field;
			} else result = page('custom_fields', fields);
		} else if (url.pathname === '/v3/tags') {
			if (method === 'POST') {
				const tag = { id: 50, name: body.tag.name };
				tags.push(tag);
				result = tag;
			} else if (url.searchParams.get('page') === '1')
				result = { tags: [], total_pages: 2 };
			else result = page('tags', tags);
		} else if (/^\/v3\/tags\/\d+\/subscribe$/.test(url.pathname)) {
			assert.equal(method, 'POST');
			assert.equal(body.email, subscriber.email_address);
			const id = Number(url.pathname.split('/')[3]);
			if (body.fields) {
				for (const key of Object.keys(body.fields))
					assert.ok(fields.some((field) => field.key === key));
				Object.assign(subscriber.fields, body.fields);
			}
			exists = true;
			adds.push(id);
			memberships.add(id);
			result = { subscription: { subscriber: { id: 42 } } };
		} else
			throw new Error(
				`Unexpected Kit fixture request ${method} ${url.pathname}`,
			);
		return Response.json(result);
	}) as typeof fetch;
	return { subscriber, memberships, adds, updates, fetcher };
}

it('a real purchase event creates the subscriber, projects date/score, and never adds the welcome tag again on replay', async () => {
	const fixture = kitFixture();
	const fetchMock = mock.method(globalThis, 'fetch', fixture.fetcher);
	const oldKey = process.env.KIT_SECRET_KEY;
	process.env.KIT_SECRET_KEY = 'fixture-key';
	try {
		const events = createInlineCommerceEvents({
			getAdapter: () =>
				({
					getPurchase: async () => ({
						id: 'purchase-1',
						productId,
						userId: 'user-1',
						createdAt: purchasedAt,
					}),
					getProduct: async () => ({ type: 'cohort', fields: { slug } }),
					getUserById: async () => ({ email: 'buyer@example.com' }),
				}) as any,
			getPaymentProvider: () => null,
			siteRootUrl: 'https://codetv.dev',
		});
		const event = {
			name: 'commerce/new-purchase-created',
			data: { purchaseId: 'purchase-1' },
		};
		await events.send(event);
		await events.send(event);
		assert.deepEqual(fixture.adds, [25083512, 20, 50]);
		assert.equal(fixture.subscriber.fields.afe_interest, '100');
		assert.match(
			fixture.subscriber.fields[`purchased_${slug.replace(/-/g, '_')}_on`],
			/^2026-10-29 \d{2}:\d{2}:\d{2} GMT/,
		);
		await createWorkshopKit({
			apiSecret: 'fixture-key',
			fetcher: fixture.fetcher,
		}).interest('42', 'landing');
		assert.equal(fixture.subscriber.fields.afe_interest, '100');
	} finally {
		fetchMock.mock.restore();
		if (oldKey === undefined) delete process.env.KIT_SECRET_KEY;
		else process.env.KIT_SECRET_KEY = oldKey;
	}
});

it('caps landings at three UTC days and one-time signals at one, including repeated server requests', async () => {
	let log: string | undefined;
	for (let day = 1; day <= 5; day++) {
		for (let visit = 0; visit < 3; visit++)
			log = scoreInterest(
				log,
				'landing',
				new Date(`2026-10-0${day}T12:00:00Z`),
			).log;
	}
	assert.equal(scoreInterest(log, 'landing').score, 30);
	for (const signal of ['pricing', 'code', 'checkout'] as const) {
		log = scoreInterest(log, signal).log;
		assert.equal(scoreInterest(log, signal).log, log);
	}
	assert.equal(scoreInterest(log, 'checkout').score, 80);
	assert.equal(scoreInterest(log, 'purchase').score, 100);
	const fixture = kitFixture();
	const kit = createWorkshopKit({
		apiSecret: 'fixture-key',
		fetcher: fixture.fetcher,
	});
	await kit.interest('42', 'checkout');
	await kit.interest('42', 'checkout');
	assert.equal(fixture.subscriber.fields.afe_interest, '30');
	assert.equal(fixture.updates.length, 1);
	fixture.memberships.add(25091646);
	await kit.interest('42', 'pricing');
	await kit.purchase({
		email: 'buyer@example.com',
		productId,
		slug,
		purchasedAt,
	});
	assert.equal(
		fixture.subscriber.fields.afe_interest,
		'30',
		'opted-out buyer does not get a score increase',
	);
	assert.ok(
		fixture.memberships.has(25083512),
		'buyer suppression still applies',
	);
});
