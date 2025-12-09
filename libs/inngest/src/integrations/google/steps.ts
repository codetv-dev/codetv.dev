import { z } from 'zod';
import {
	add,
	eachDayOfInterval,
	isSameDay,
	isThursday,
	nextThursday,
} from 'date-fns';
import { inngest } from '../../client.js';
import { getGoogleAccessToken } from './api/auth.ts';
import { getCalendarEvents, getHostFreeBusy } from './api/calendar.ts';
import { appendValue, appendHackathonValue } from './api/sheets.ts';
import { CalendarEvent } from './types.ts';

type CalendarEvent = z.infer<typeof CalendarEvent>;

export const tokenGenerate = inngest.createFunction(
	{ id: 'google/token.generate' },
	{ event: 'google/token.generate' },
	async () => {
		return await getGoogleAccessToken();
	},
);

export const sheetRowAppend = inngest.createFunction(
	{ id: 'google/sheet.row.append' },
	{ event: 'google/sheet.row.append' },
	async ({ event, step }) => {
		const {
			signature,
			role,
			reimbursement,
			email,
			phone,
			groupchat,
			dietaryRequirements,
			foodAdventurousness,
			coffee,
		} = event.data;

		return step.run('google/sheet.row.append', async () => {
			return await appendValue({
				signature,
				role,
				reimbursement,
				email,
				phone,
				groupchat,
				dietaryRequirements,
				foodAdventurousness,
				coffee,
			});
		});
	},
);

export const hackathonSheetRowAppend = inngest.createFunction(
	{ id: 'google/hackathon.sheet.row.append' },
	{ event: 'google/hackathon.sheet.row.append' },
	async ({ event, step }) => {
		const {
			userId,
			fullName,
			email,
			githubRepo,
			deployedUrl,
			agreeTerms,
			optOutSponsorship,
		} = event.data;

		return step.run('google/hackathon.sheet.row.append', async () => {
			return await appendHackathonValue({
				userId,
				fullName,
				email,
				githubRepo,
				deployedUrl,
				agreeTerms,
				optOutSponsorship,
			});
		});
	},
);

export const calendarEventList = inngest.createFunction(
	{ id: 'google/calendar.events.list' },
	{ event: 'google/calendar.events.list' },
	async ({ event, step }): Promise<CalendarEvent[] | undefined> => {
		return step.run('google/calendar.events.list', async () => {
			return getCalendarEvents({ token: event.data.token });
		});
	},
);

export const eventsGetUnbookedDates = inngest.createFunction(
	{ id: 'google/events.filter.unbooked' },
	{ event: 'google/events.filter.unbooked' },
	async function ({ event, step }) {
		return step.run('filter-for-unbooked-events', async () => {
			const today = new Date();
			const parsedEvents = z.array(CalendarEvent).parse(event.data.events);

			const bookedShows = parsedEvents.filter((event) => {
				return isThursday(event.start.dateTime);
			});

			// Get a list of every date that falls on a Thursday for the next 60 days.
			const possibleShowDates = eachDayOfInterval(
				{
					start: nextThursday(today),
					end: add(today, { days: 60 }),
				},
				{
					step: 7,
				},
			);

			// Figure out which dates don’t already have shows booked on them.
			return possibleShowDates.filter((showDate) => {
				return bookedShows.every((bookedShow) => {
					return !isSameDay(showDate, bookedShow.start.dateTime);
				});
			});
		});
	},
);

export const hostFreeBusy = inngest.createFunction(
	{ id: 'google/host.free-busy.get' },
	{ event: 'google/host.free-busy.get' },
	async ({ event, step }) => {
		return step.run('google/calendar.free-busy.get', async () => {
			const dates = z.array(z.coerce.date()).parse(event.data.dates);

			return getHostFreeBusy({ token: event.data.token, dates });
		});
	},
);

export const bookableDatesGet = inngest.createFunction(
	{ id: 'google/bookable-dates.get' },
	{ event: 'google/bookable-dates.get' },
	async ({ event, step }) => {
		return step.run('get-bookable-lwj-dates', async () => {
			return event.data.dates
				.filter((fb) => {
					const calendars = Object.values(fb.calendars);
					return !calendars.some((cal) => cal.busy.length > 0);
				})
				.map((free) => free.timeMin);
		});
	},
);
