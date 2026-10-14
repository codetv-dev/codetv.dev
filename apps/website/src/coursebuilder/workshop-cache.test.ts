import assert from 'node:assert/strict';
import { it } from 'node:test';
import workshopCacheKey from '../../netlify/edge-functions/workshop-cache-key.js';
import {
	guardWorkshopCache,
	workshopCacheControl,
	WORKSHOP_SESSION_HEADER,
} from './workshop-cache';

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
const anonymousRequest = (headers: Record<string, string> = {}) =>
	new Request(url, {
		headers: { [WORKSHOP_SESSION_HEADER]: 'anonymous', ...headers },
	});

it('analytics and signed-out Clerk cookies share the anonymous key, but every session variant bypasses', async () => {
	const cases: Array<{ headers: Record<string, string>; expected: string }> = [
		{ headers: {}, expected: 'anonymous' },
		{ headers: { Cookie: '_fbp=fb.test' }, expected: 'anonymous' },
		{
			headers: {
				Cookie: '_fbp=fb.test; __client_uat=0; __client_uat_instance=0',
			},
			expected: 'anonymous',
		},
		{
			headers: { Cookie: '__session=fake; __client_uat=1700000000' },
			expected: 'session',
		},
		{ headers: { Cookie: '__session_instance=' }, expected: 'session' },
		{
			headers: { Cookie: '__client_uat_future_instance=123' },
			expected: 'session',
		},
		{ headers: { Cookie: '__client_uat=' }, expected: 'session' },
		{ headers: { Authorization: 'Bearer fake' }, expected: 'session' },
	];
	for (const { headers, expected } of cases) {
		// Attempt to spoof the opposite classification. The edge MUST overwrite it.
		const request = new Request(url, {
			headers: {
				...headers,
				[WORKSHOP_SESSION_HEADER]:
					expected === 'session' ? 'anonymous' : 'session',
			},
		});
		const response = await workshopCacheKey(request, {
			next: async (forwarded: Request) => {
				assert.equal(forwarded.headers.get(WORKSHOP_SESSION_HEADER), expected);
				assert.equal(
					forwarded.headers.get('Cookie'),
					request.headers.get('Cookie'),
				);
				return guardWorkshopCache(forwarded, shell());
			},
		});
		assert.equal(
			response.headers.get('Netlify-Vary'),
			`query, header=${WORKSHOP_SESSION_HEADER}, country=us`,
		);
		assert.equal(response.headers.get('Vary'), 'Accept-Encoding');
		if (expected === 'session') {
			assert.equal(
				response.headers.get('Netlify-CDN-Cache-Control'),
				'no-store',
			);
			assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
			assert.equal(response.headers.get('Netlify-Cache-Tag'), null);
		} else {
			assert.match(
				response.headers.get('Netlify-CDN-Cache-Control')!,
				/public/,
			);
		}
	}
});

it('refuses to cache Clerk cookie mutation, handshake auth, missing gate, errors and failed price lookup', () => {
	for (const response of [
		shell({ 'Set-Cookie': '__session=token' }),
		shell({}, 307),
		shell({}, 404),
	]) {
		assert.equal(
			guardWorkshopCache(anonymousRequest(), response).headers.get(
				'Netlify-CDN-Cache-Control',
			),
			'no-store',
		);
	}
	assert.equal(
		guardWorkshopCache(
			new Request(`${url}?code=buyer-code`, {
				headers: { [WORKSHOP_SESSION_HEADER]: 'anonymous' },
			}),
			shell(),
		).headers.get('Netlify-CDN-Cache-Control'),
		'no-store',
	);
	assert.equal(
		guardWorkshopCache(new Request(url), shell()).headers.get(
			'Netlify-CDN-Cache-Control',
		),
		'no-store',
	);
	assert.equal(
		guardWorkshopCache(anonymousRequest(), shell(), true).headers.get(
			'Netlify-CDN-Cache-Control',
		),
		'no-store',
	);
	// Even a forged anonymous classification cannot make an authenticated origin response public.
	assert.equal(
		guardWorkshopCache(
			anonymousRequest({ Cookie: '__session_instance=fake' }),
			shell(),
		).headers.get('Netlify-CDN-Cache-Control'),
		'no-store',
	);
	assert.equal(
		guardWorkshopCache(
			anonymousRequest(),
			shell({ 'Netlify-CDN-Cache-Control': 'no-store' }),
		).headers.get('Netlify-CDN-Cache-Control'),
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
	}
	// A quiet ten-minute spell must not send a signed-out visitor back to SSR.
	const quiet = workshopCacheControl(
		[end],
		new Date(end.getTime() - 3_600_000),
	);
	const usable =
		Number(quiet.match(/s-maxage=(\d+)/)![1]) +
		Number(quiet.match(/stale-while-revalidate=(\d+)/)![1]);
	assert.ok(usable > 600);
	assert.ok(usable < 3_600);
	for (const seconds of [5, 1, 0, -1]) {
		assert.equal(
			workshopCacheControl([end], new Date(end.getTime() - seconds * 1000)),
			'no-store',
		);
	}
});
