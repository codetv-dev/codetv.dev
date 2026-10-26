import assert from 'node:assert/strict';
import { it } from 'node:test';
import fc from 'fast-check';
import { workshopCacheControl } from './workshop-cache.ts';

it('the whole cache lifetime stays before every sales boundary, regardless of order or missing dates', () => {
	fc.assert(
		fc.property(
			fc.integer({ min: -2_000_000_000_000, max: 2_000_000_000_000 }),
			// Millisecond precision exercises rounding as well as near/past boundaries.
			fc.array(fc.integer({ min: -10_000, max: 200_000_000 }), {
				maxLength: 8,
			}),
			(now, offsets) => {
				const boundaries = offsets.map((offset) => new Date(now + offset));
				const policy = workshopCacheControl(boundaries, new Date(now));
				assert.equal(
					workshopCacheControl(
						[null, ...boundaries.toReversed(), null],
						new Date(now),
					),
					policy,
				);
				const nextBoundary = Math.min(...offsets);
				if (nextBoundary < 6_000) {
					assert.equal(policy, 'no-store');
					return;
				}
				// Also require usable caching when safe; always returning no-store is not a fix.
				const match =
					/^public, durable, s-maxage=(\d+), stale-while-revalidate=(\d+)$/.exec(
						policy,
					);
				assert.ok(match, `expected a usable cache policy, got ${policy}`);
				const fresh = Number(match[1]);
				const stale = Number(match[2]);
				assert.ok(fresh > 0 && fresh <= 60);
				assert.ok(fresh + stale <= 86_460);
				// Include stale serving, not just freshness, and retain the five-second safety margin.
				assert.ok((fresh + stale) * 1_000 <= nextBoundary - 5_000, policy);
			},
		),
		{ seed: 20261026, numRuns: 1_000 },
	);
});
