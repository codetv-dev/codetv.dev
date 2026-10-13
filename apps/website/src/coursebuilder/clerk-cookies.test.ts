import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	dedupeClerkCookies,
	expireStrayClerkCookies,
	fixClerkCookieResponse,
	withRootPath,
} from './clerk-cookies.ts';

describe('withRootPath', () => {
	it('adds Path=/ to a path-less Clerk cookie', () => {
		assert.equal(
			withRootPath('__session_v16EnlIb=abc; SameSite=Lax; Secure'),
			'__session_v16EnlIb=abc; Path=/; SameSite=Lax; Secure',
		);
	});

	it('replaces a non-root Clerk path', () => {
		assert.equal(
			withRootPath('__refresh_v16EnlIb=x; Path=/api; HttpOnly'),
			'__refresh_v16EnlIb=x; Path=/; HttpOnly',
		);
	});

	it('leaves other cookies alone', () => {
		assert.equal(withRootPath('other=1; HttpOnly'), 'other=1; HttpOnly');
	});
});

describe('dedupeClerkCookies', () => {
	it('keeps the last (root-path) copy of each Clerk cookie', () => {
		assert.equal(
			dedupeClerkCookies(
				'__session=old; _fbp=1; __client_uat=1; __session=new; __client_uat=2',
			),
			'_fbp=1; __session=new; __client_uat=2',
		);
	});

	it('does not touch non-Clerk duplicates', () => {
		assert.equal(dedupeClerkCookies('a=1; a=2'), 'a=1; a=2');
	});
});

describe('fixClerkCookieResponse', () => {
	it('pins Clerk cookies to / and expires the /api/coursebuilder copies', () => {
		const response = new Response(null);
		response.headers.append('set-cookie', '__session=fresh; SameSite=Lax');
		fixClerkCookieResponse(response, '__session=old; _fbp=1; __session=old2');
		assert.deepEqual(response.headers.getSetCookie(), [
			'__session=fresh; Path=/; SameSite=Lax',
			'__session=; Max-Age=0; Path=/api/coursebuilder',
		]);
	});

	it('expires only Clerk names', () => {
		assert.deepEqual(expireStrayClerkCookies('_fbp=1; muxData=2'), []);
	});
});
