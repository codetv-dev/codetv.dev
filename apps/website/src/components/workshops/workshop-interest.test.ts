import assert from 'node:assert/strict';
import { it, mock } from 'node:test';
import { trackWorkshopInterest } from './workshop-interest.ts';

it('beacons the real workshop page, retains attribution without the query, and starts checkout before navigation', async () => {
	const globals = ['location', 'sessionStorage', 'localStorage'] as const;
	const previous = globals.map((key) =>
		Object.getOwnPropertyDescriptor(globalThis, key),
	);
	const storage = () => {
		const data = new Map<string, string>();
		return {
			getItem: (key: string) => data.get(key) ?? null,
			setItem: (key: string, value: string) => data.set(key, value),
		};
	};
	const location = {
		pathname: '/workshops/agentic-frontend-engineering',
		search: '?ck_subscriber_id=42&code=fixture',
	};
	const requests: Record<string, string>[] = [];
	// Leave landing in flight to prove checkout is not stranded behind a promise on unload.
	let finishLanding: (response: Response) => void = () => {};
	const fetchMock = mock.method(
		globalThis,
		'fetch',
		async (_url: string | URL | Request, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			requests.push(body);
			assert.equal(init?.keepalive, true);
			if (body.signal === 'landing')
				return new Promise<Response>((resolve) => {
					finishLanding = resolve;
				});
			return new Response(null, { status: 204 });
		},
	);
	try {
		for (const [key, value] of Object.entries({
			location,
			sessionStorage: storage(),
			localStorage: storage(),
		}))
			Object.defineProperty(globalThis, key, { value, configurable: true });
		trackWorkshopInterest('landing');
		await Promise.resolve();
		location.search = '';
		trackWorkshopInterest('checkout');
		trackWorkshopInterest('checkout');
		assert.deepEqual(requests, [
			{
				subscriberId: '42',
				signal: 'landing',
				workshop: 'agentic-frontend-engineering',
			},
			{
				subscriberId: '42',
				signal: 'checkout',
				workshop: 'agentic-frontend-engineering',
			},
		]);
		finishLanding(new Response(null, { status: 204 }));
	} finally {
		fetchMock.mock.restore();
		globals.forEach((key, index) => {
			const descriptor = previous[index];
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		});
	}
});
