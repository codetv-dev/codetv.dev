import { z } from 'zod';
import {
	WebDevChallengeFormSubmit,
	HackathonSubmission,
} from '../website/types.ts';

export const CalendarEvent = z.object({
	kind: z.literal('calendar#event'),
	etag: z.string(),
	id: z.string(),
	status: z.string(),
	htmlLink: z.string(),
	created: z.string(),
	updated: z.string(),
	summary: z.string(),
	description: z.string(),
	location: z.string(),
	creator: z.object({
		email: z.string(),
		displayName: z.string().optional(),
	}),
	organizer: z.object({
		email: z.string(),
		displayName: z.string().optional(),
		self: z.boolean(),
	}),
	start: z.object({
		dateTime: z.string(),
		timeZone: z.string(),
	}),
	end: z.object({
		dateTime: z.string(),
		timeZone: z.string(),
	}),
	recurringEventId: z.string().optional(),
	originalStartTime: z
		.object({
			dateTime: z.string(),
			timeZone: z.string(),
		})
		.optional(),
	iCalUID: z.string(),
	sequence: z.number(),
	reminders: z.object({
		useDefault: z.boolean(),
	}),
	eventType: z.string(),
});

export const EventList = z.object({
	kind: z.literal('calendar#events'),
	etag: z.string(),
	summary: z.string(),
	description: z.string(),
	updated: z.coerce.date(),
	timeZone: z.string(),
	accessRole: z.string(),
	defaultReminders: z.array(z.any()),
	nextPageToken: z.string().optional(),
	items: z.array(CalendarEvent),
});

export const FreeBusy = z.object({
	kind: z.literal('calendar#freeBusy'),
	timeMin: z.string(),
	timeMax: z.string(),
	calendars: z.record(
		z.string(),
		z.object({
			busy: z.array(
				z.object({
					start: z.string(),
					end: z.string(),
				}),
			),
		}),
	),
});

export const schema = {
	'google/token.generate': {},
	'google/sheet.row.append': {
		data: z.union([
			WebDevChallengeFormSubmit.extend({
				formType: z.literal('wdc').optional(),
			}),
			HackathonSubmission.extend({ formType: z.literal('hackathon') }),
		]),
	},
	'google/calendar.events.list': {
		data: z.object({
			token: z.string(),
		}),
	},
	'google/events.filter.unbooked': {
		data: z.object({
			events: z.array(CalendarEvent),
		}),
	},
	'google/host.free-busy.get': {
		data: z.object({
			token: z.string(),
			dates: z.array(z.string()),
		}),
	},
	'google/bookable-dates.get': {
		data: z.object({
			dates: z.array(FreeBusy),
		}),
	},
};
