import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { profileColumns } from './user-profile-fields.ts';

// A buyer's Discord-sourced Clerk avatar URL was 256 chars; ctv_User.image is varchar(255).
// The linking update failed with "Data too long for column 'image'" and every lesson 500ed.
const longUrl = `https://img.clerk.com/${'a'.repeat(234)}`;

describe('profileColumns', () => {
	it('drops an avatar URL longer than the column instead of failing the write', () => {
		assert.equal(longUrl.length, 256);
		assert.equal(profileColumns({ name: 'Ada', image: longUrl }).image, null);
	});

	it('keeps values that fit, including exactly 255 chars', () => {
		const fits = longUrl.slice(0, 255);
		assert.deepEqual(profileColumns({ name: 'Ada', image: fits }), {
			name: 'Ada',
			image: fits,
		});
	});

	it('drops an over-long name too and passes null through', () => {
		assert.deepEqual(profileColumns({ name: 'n'.repeat(256), image: null }), {
			name: null,
			image: null,
		});
	});
});
