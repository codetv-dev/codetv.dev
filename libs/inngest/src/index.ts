import {
	handleWebhookUserCreatedOrUpdated,
	userGetById,
	userGetExternalAccountId,
	userGetOAuthToken,
	userSubscriptionUpdate,
} from './integrations/clerk/steps.js';
import { imageUpload } from './integrations/cloudinary/steps.js';
import {
	addAlumniRole,
	addMemberToServer,
	discordUpdateUserRole,
	getDiscordMemberId,
	messageSend,
} from './integrations/discord/steps.js';
import {
	bookableDatesGet,
	calendarEventList,
	eventsGetUnbookedDates,
	hostFreeBusy,
	sheetRowAppend,
	hackathonSheetRowAppend,
	tokenGenerate,
} from './integrations/google/steps.js';
import {
	personGetByClerkId,
	personUpdateDetails,
	personUpdateSubscription,
	personUpsert,
} from './integrations/sanity/steps.js';
import {
	handleStripeSubscriptionUpdatedWebhook,
	handleWebhookStripeSubscriptionCompleted,
	retrieveStripeProduct,
	retrieveStripeSubscription,
} from './integrations/stripe/steps.js';
import {
	handleLWJIntake,
	handleUpdateUserProfile,
	handleWDCIntakeSubmit,
	handleWDCHackathonSubmit,
} from './integrations/website/steps.js';

export { inngest } from './client.js';

/**
 * The `any` here is to avoid TS7056
 *
 * Because there are so many functions here, we end up triggering this error:
 *
 * > error TS7056: The inferred type of this node exceeds the maximum length the
 * > compiler will serialize. An explicit type annotation is needed.
 *
 * Since this is only exported for use in the Inngest endpoint (which we don’t
 * interact with directly and therefore don’t need type checking for), we can
 * get away with shenanigans like these.
 *
 * @see https://github.com/colinhacks/zod/issues/1040
 */
export const functions: any[] = [
	handleWebhookUserCreatedOrUpdated,
	userGetById,
	userGetExternalAccountId,
	userGetOAuthToken,
	userSubscriptionUpdate,
	imageUpload,
	addAlumniRole,
	addMemberToServer,
	discordUpdateUserRole,
	getDiscordMemberId,
	messageSend,
	bookableDatesGet,
	calendarEventList,
	eventsGetUnbookedDates,
	hostFreeBusy,
	sheetRowAppend,
	hackathonSheetRowAppend,
	tokenGenerate,
	personGetByClerkId,
	personUpdateDetails,
	personUpdateSubscription,
	personUpsert,
	handleStripeSubscriptionUpdatedWebhook,
	handleWebhookStripeSubscriptionCompleted,
	retrieveStripeProduct,
	retrieveStripeSubscription,
	handleLWJIntake,
	handleUpdateUserProfile,
	handleWDCIntakeSubmit,
	handleWDCHackathonSubmit,
];
