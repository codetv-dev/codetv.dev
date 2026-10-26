import assert from 'node:assert/strict';
import { it } from 'node:test';
import fc from 'fast-check';
import { getLessonPlayback, isChapterUnlocked } from './workshop-lessons.ts';

// Keep arithmetic inside Date's finite range, including after translation.
const instant = fc.integer({ min: -2_000_000_000_000, max: 2_000_000_000_000 });
const elapsed = fc.integer({ min: 0, max: 100_000_000 });
const options = { seed: 20261026, numRuns: 1_000 };

it('a released chapter stays unlocked as time advances, independent of the calendar origin', () => {
	fc.assert(
		fc.property(
			instant,
			elapsed,
			elapsed,
			instant,
			(release, since, later, shift) => {
				const startsAt = new Date(release).toISOString();
				assert.equal(isChapterUnlocked(startsAt, new Date(release)), true);
				assert.equal(
					isChapterUnlocked(startsAt, new Date(release + since)),
					true,
				);
				assert.equal(
					isChapterUnlocked(startsAt, new Date(release + since + later)),
					true,
				);
				assert.equal(
					isChapterUnlocked(
						new Date(release + shift).toISOString(),
						new Date(release + shift + since + later),
					),
					true,
				);
			},
		),
		options,
	);
});

it('missing and malformed schedules fail closed even as time advances', () => {
	fc.assert(
		fc.property(
			fc.oneof(
				fc.constant(null),
				fc.constant(''),
				fc.string().map((suffix) => `invalid:${suffix}`),
			),
			instant,
			elapsed,
			(startsAt, now, later) => {
				assert.equal(isChapterUnlocked(startsAt, new Date(now)), false);
				assert.equal(isChapterUnlocked(startsAt, new Date(now + later)), false);
			},
		),
		options,
	);
});

it('playback requires both access gates, performs no denied lookup, and ignores public IDs', async () => {
	await fc.assert(
		fc.asyncProperty(
			fc.record({
				hasTicket: fc.boolean(),
				release: instant,
				offset: fc.integer({ min: -100_000_000, max: 100_000_000 }),
				schedule: fc.constantFrom('valid', 'missing', 'malformed'),
				signedId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
				publicIds: fc.array(fc.string({ minLength: 1 }), { maxLength: 8 }),
			}),
			async ({ hasTicket, release, offset, schedule, signedId, publicIds }) => {
				const startsAt =
					schedule === 'missing'
						? null
						: schedule === 'malformed'
							? 'invalid:date'
							: new Date(release).toISOString();
				const permitted = hasTicket && schedule === 'valid' && offset >= 0;
				let lookups = 0;
				const playback = await getLessonPlayback({
					hasTicket,
					startsAt,
					now: new Date(release + offset),
					loadVideo: async () => {
						lookups++;
						return {
							// Public entries come first: they must not shadow a signed entry.
							playback_ids: [
								...publicIds.map((id) => ({ id, policy: 'public' })),
								...(signedId === null
									? []
									: [{ id: signedId, policy: 'signed' }]),
							],
						};
					},
				});
				assert.equal(lookups, permitted ? 1 : 0);
				assert.deepEqual(
					playback,
					permitted && signedId !== null
						? { id: signedId, policy: 'signed' }
						: null,
				);
			},
		),
		options,
	);
});
