import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
	chapterUnlockLabel,
	getLessonPlayback,
	publicWorkshopContent,
} from './workshop-lessons.ts';

it('never loads video for a non-buyer or a buyer before release, including malformed schedules', async () => {
	for (const input of [
		{ hasTicket: false, startsAt: '2026-11-09T08:00:00Z' },
		{ hasTicket: true, startsAt: '2026-11-10T08:00:00Z' },
		{ hasTicket: true, startsAt: null },
		{ hasTicket: true, startsAt: 'broken' },
	]) {
		assert.equal(
			await getLessonPlayback({
				...input,
				now: new Date('2026-11-09T08:00:00Z'),
				loadVideo: async () => {
					assert.fail('video must not be queried');
				},
			}),
			null,
		);
	}
});

it('releases signed playback to buyers at the stored instant, never public playback', async () => {
	const input = {
		hasTicket: true,
		startsAt: '2026-11-09T08:00:00Z',
		now: new Date('2026-11-09T08:00:00Z'),
	};
	assert.deepEqual(
		await getLessonPlayback({
			...input,
			loadVideo: async () => ({
				playback_ids: [
					{ id: 'public-id', policy: 'public' },
					{ id: 'signed-id', policy: 'signed' },
				],
			}),
		}),
		{ id: 'signed-id', policy: 'signed' },
	);
	assert.equal(
		await getLessonPlayback({
			...input,
			loadVideo: async () => ({
				playback_ids: [{ id: 'public-id', policy: 'public' }],
			}),
		}),
		null,
	);
	assert.equal(
		chapterUnlockLabel('2026-11-10T08:00:00Z'),
		'Unlocks Tue, Nov 10 (Pacific)',
	);
});

it('public content projections remove playback and exercises through nested resource/edge API shapes', () => {
	const video = {
		id: 'video',
		type: 'videoResource',
		fields: {
			title: 'Video',
			playback_ids: [{ id: 'secret', policy: 'signed' }],
			muxAssetId: 'asset-secret',
		},
	};
	const lesson = {
		id: 'lesson',
		slug: 'lesson',
		type: 'lesson',
		fields: {
			title: 'Chapter',
			startsAt: '2026-11-09T08:00:00Z',
			body: 'exercise-secret',
			videoResourceId: 'video-secret',
		},
		resources: [{ resource: video }],
	};
	for (const shape of [
		lesson,
		video,
		{
			type: 'workshop',
			resources: [
				{ resource: { type: 'section', resources: [{ resource: lesson }] } },
			],
		},
		{ edges: [{ resource: video }] },
	]) {
		const serialized = JSON.stringify(publicWorkshopContent(shape));
		assert.doesNotMatch(
			serialized,
			/secret|playback_ids|muxAssetId|videoResourceId/,
		);
	}
});
