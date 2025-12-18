import { inngest } from '../../client.js';
import {
	getCurrentActiveHackathon,
	hackathonSubmissionCreate,
	personAssociateWithHackathon,
	personAssociateWithHackathonSubmission,
	personGetByClerkId,
	personUpdateDetails,
} from '../sanity/steps.ts';
import {
	bookableDatesGet,
	calendarEventList,
	eventsGetUnbookedDates,
	hostFreeBusy,
	sheetRowAppend,
	tokenGenerate,
} from '../google/steps.ts';
import {
	addUserBadge,
	getDiscordMemberId,
	messageSend,
} from '../discord/steps.ts';
import { userGetById } from '../clerk/steps.ts';

export const handleUpdateUserProfile = inngest.createFunction(
	{ id: 'codetv/user.profile.update' },
	{ event: 'codetv/user.profile.update' },
	async function ({ event, step }) {
		const { id, bio, links } = event.data;

		await step.invoke('update-sanity-user', {
			function: personUpdateDetails,
			data: {
				id,
				bio,
				links,
			},
		});
	},
);

export const handleWDCIntakeSubmit = inngest.createFunction(
	{ id: 'codetv/forms.wdc.submit' },
	{ event: 'codetv/forms.wdc.submit' },
	async function ({ event, step }) {
		const { id, bio = '', signature, links } = event.data;

		const userUpdatePromise = step.invoke('update-sanity-user', {
			function: personUpdateDetails,
			data: {
				id,
				bio,
				links,
			},
		});

		// these details are only relevant to the production, so don’t store in Sanity/Clerk
		const appendPromise = step.invoke('append-row-to-google-sheet', {
			function: sheetRowAppend,
			data: event.data,
		});

		const [, sheetUrl] = await Promise.all([userUpdatePromise, appendPromise]);

		await step.invoke('send-discord-message', {
			function: messageSend,
			data: {
				message: `${signature} filled out the WDC onboarding form ([view submission](${sheetUrl}))`,
			},
		});
	},
);

export const handleLWJIntake = inngest.createFunction(
	{ id: 'codetv/forms.lwj.book' },
	{ event: 'codetv/forms.lwj.book' },
	async function ({ step }) {
		const token = await step.invoke('get-google-token', {
			function: tokenGenerate,
		});

		const events = await step.invoke('google-get-calendar-events', {
			function: calendarEventList,
			data: {
				token,
			},
		});

		const datesWithoutShows = await step.invoke(
			'google-get-dates-without-shows',
			{
				function: eventsGetUnbookedDates,
				data: {
					events,
				},
			},
		);

		const freeBusy = await step.invoke('google-get-host-free-busy', {
			function: hostFreeBusy,
			data: {
				token,
				dates: datesWithoutShows,
			},
		});

		const bookableShowDates = await step.invoke('get-bookable-show-dates', {
			function: bookableDatesGet,
			data: {
				dates: freeBusy,
			},
		});

		console.log(bookableShowDates);
		// TODO how do we handle human in the loop workflows with Inngest

		// const confirmationUUid = 'abc123';
		// await publish(
		// 	testChannel().messages({
		// 		message: 'Did this work?',
		// 		confirmationUUid,
		// 	}),
		// );

		// const confirmation = await step.waitForEvent('test-confirmation', {
		// 	event: 'codetv/test-confirmation',
		// 	timeout: '15m',
		// 	if: `async.data.confirmationUUid == \"${confirmationUUid}\"`,
		// });

		// if (confirmation) {
		// 	await step.run('log-the-output', async () => {
		// 		return confirmation;
		// 	});
		// }

		return bookableShowDates;

		// TODO create a calendar event for the following people:
		// submitter (guest), Jason, captioner (WCC), operations (Aodhan)
		// https://developers.google.com/workspace/calendar/api/v3/reference/events/insert

		// TODO add Notion entry (⚠️ do we need this if we have the Sanity draft?)
		// TODO send notification to Discord
		// TODO wait for the title/description to be written
		// TODO generate social images for the episode
		// TODO create an event in the Discord after ^^ is complete
		// TODO create a draft event in Sanity (release?)
	},
);

export const handleHackathonSubmission = inngest.createFunction(
	{ id: 'codetv/forms.hackathon.submission' },
	{ event: 'codetv/forms.hackathon.submission' },
	async function ({ event, step }) {
		await step.run('log-the-output', async () => {
			return event.data;
		});

		// Parallelize independent data fetches
		const [user, hackathon, person] = await Promise.all([
			step.invoke('get-user-by-id', {
				function: userGetById,
				data: {
					userId: event.data.userId,
				},
			}),
			step.invoke('get-current-active-hackathon', {
				function: getCurrentActiveHackathon,
				data: {},
			}),
			step.invoke('get-sanity-person', {
				function: personGetByClerkId,
				data: {
					clerkUserId: event.data.userId,
				},
			}),
		]);

		const [discordUserId, submission] = await Promise.all([
			step.invoke('get-discord-user-id', {
				function: getDiscordMemberId,
				data: {
					user: user,
				},
			}),
			step.invoke('create-hackathon-submission', {
				function: hackathonSubmissionCreate,
				data: {
					hackathonId: hackathon?._id ?? '',
					personId: person?._id,
					email: event.data.email,
					fullName: event.data.fullName,
					githubRepo: event.data.githubRepo,
					deployedUrl: event.data.deployedUrl,
					demoVideo: event.data.demoVideo,
					agreeTerms: event.data.agreeTerms,
					optOutSponsorship: event.data.optOutSponsorship,
				},
			}),
		]);

		// Parallelize all remaining operations that depend on the results above
		await Promise.all([
			// Associate person with hackathon (if not already associated)
			person?._id && hackathon?._id
				? step.invoke('associate-person-with-hackathon', {
						function: personAssociateWithHackathon,
						data: {
							personId: person._id,
							hackathonId: hackathon._id,
						},
					})
				: Promise.resolve(),
			// Associate person with hackathon submission
			person?._id && submission?._id
				? step.invoke('associate-person-with-hackathon-submission', {
						function: personAssociateWithHackathonSubmission,
						data: {
							personId: person._id,
							submissionId: submission._id,
						},
					})
				: Promise.resolve(),
			// Add hackathon participant badge on Discord
			step.invoke('add-hackathon-badge', {
				function: addUserBadge,
				data: {
					memberId: discordUserId,
					badge: 'hackathon_participant',
				},
			}),
			// Log submission to Google Sheet
			step.invoke('append-row-to-hackathon-google-sheet', {
				function: sheetRowAppend,
				data: {
					formType: 'hackathon' as const,
					userId: event.data.userId,
					fullName: event.data.fullName,
					email: event.data.email,
					githubRepo: event.data.githubRepo,
					deployedUrl: event.data.deployedUrl,
					demoVideo: event.data.demoVideo,
					agreeTerms: event.data.agreeTerms,
					optOutSponsorship: event.data.optOutSponsorship,
				},
			}),
		]);

		return submission;
	},
);
