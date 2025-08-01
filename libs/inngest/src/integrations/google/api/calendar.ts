import { add, set } from 'date-fns';
import { config } from '../config.ts';
import { EventList, FreeBusy } from '../types.ts';

const apiUrl = new URL(
	`https://www.googleapis.com/calendar/v3/calendars/${config.calendar.public.id}/events`,
);

/**
 * Queries the public calendar for the next 60 days of events
 *
 * @see https://developers.google.com/workspace/calendar/api/v3/reference/events/list
 */
export async function getCalendarEvents({ token }: { token: string }) {
	const today = new Date();

	const url = new URL(apiUrl);
	url.searchParams.set('orderBy', 'startTime');
	url.searchParams.set('singleEvents', 'true');
	url.searchParams.set('timeMin', today.toISOString());
	url.searchParams.set('timeMax', add(today, { days: 60 }).toISOString());

	const res = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
	});

	if (!res.ok) {
		throw new Error(res.statusText, {
			cause: res,
		});
	}

	const data = await res.json();
	const parsed = EventList.parse(data);

	return parsed.items;
}

/**
 * Check Jason’s personal calendar for things like vacations, conflicts, etc.
 * One call per available show date; parallelize for performance.
 *
 * @see https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
 */
export async function getHostFreeBusy({
	token,
	dates,
}: {
	token: string;
	dates: Date[];
}) {
	return await Promise.all(
		dates.map((date) => {
			return fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					// Magic numbers: the show is always scheduled 9:30–11am Pacific
					timeMin: set(date, { hours: 9, minutes: 30 }),
					timeMax: set(date, { hours: 11, minutes: 0 }),
					timeZone: 'America/Los_Angeles',
					items: [
						{
							id: config.calendar.host.id,
						},
					],
				}),
			})
				.then((res) => res.json())
				.then((rawData) => FreeBusy.parse(rawData));
		}),
	);
}
