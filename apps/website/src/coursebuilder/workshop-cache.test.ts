import assert from 'node:assert/strict';
import { it } from 'node:test';
import { guardWorkshopCache, workshopCacheControl } from './workshop-cache';

const url = 'https://codetv.dev/workshops/agentic-frontend-engineering';
const shell = (headers = {}, status = 200) =>
	new Response('public shell', {
		status,
		headers: {
			'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=60',
			'Netlify-Cache-Tag': 'workshop:example',
			Vary: 'Accept-Encoding',
			...headers,
		},
	});

it('partitions cache lookup by all credentials and refuses to store personalized responses', () => {
	const anonymous = guardWorkshopCache(new Request(url), shell());
	assert.match(anonymous.headers.get('Netlify-CDN-Cache-Control')!, /public/);
	assert.equal(
		anonymous.headers.get('Vary'),
		'Accept-Encoding, Cookie, Authorization',
	);
	const credentials: Array<Record<string, string>> = [
		{ Cookie: '__session=buyer-session' },
		{ Cookie: '__session_app=buyer-session; __client_uat=123' },
		{ Cookie: 'unknown_future_auth=buyer' },
		{ Authorization: 'Bearer buyer-token' },
	];
	for (const headers of credentials) {
		const response = guardWorkshopCache(new Request(url, { headers }), shell());
		assert.equal(response.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
		assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
		assert.equal(response.headers.get('Netlify-Cache-Tag'), null);
		assert.equal(response.headers.get('Vary'), anonymous.headers.get('Vary'));
	}
});

it('refuses to cache a Clerk cookie mutation, redirect, missing workshop or failed price lookup', () => {
	for (const response of [
		shell({ 'Set-Cookie': '__session=token' }),
		shell({}, 307),
		shell({}, 404),
	]) {
		assert.equal(
			guardWorkshopCache(new Request(url), response).headers.get(
				'Netlify-CDN-Cache-Control',
			),
			'no-store',
		);
	}
	// Clerk can authenticate via a handshake query as well as request headers.
	const handshake = guardWorkshopCache(
		new Request(`${url}?__clerk_handshake=opaque`),
		shell(),
		true,
	);
	assert.equal(handshake.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
	const failedPrice = shell({ 'Netlify-CDN-Cache-Control': 'no-store' });
	assert.equal(
		guardWorkshopCache(new Request(url), failedPrice).headers.get(
			'Netlify-CDN-Cache-Control',
		),
		'no-store',
	);
});

it('never serves stale sale HTML across the early-bird or enrollment boundary', () => {
	const end = new Date('2026-11-04T07:59:00Z');
	for (const seconds of [1000, 300, 61, 30, 6]) {
		const now = new Date(end.getTime() - seconds * 1000);
		const policy = workshopCacheControl([end], now);
		const fresh = Number(policy.match(/s-maxage=(\d+)/)![1]);
		const stale = Number(policy.match(/stale-while-revalidate=(\d+)/)![1]);
		assert.ok(
			fresh + stale < seconds,
			`${policy} could cross the price change`,
		);
		assert.ok(fresh + stale <= 300);
	}
	for (const seconds of [5, 1, 0, -1]) {
		assert.equal(
			workshopCacheControl([end], new Date(end.getTime() - seconds * 1000)),
			'no-store',
		);
	}
});
