import {
	handleWebhookUserCreatedOrUpdated,
	userGetById,
	userGetExternalAccountId,
	userSubscriptionUpdate,
} from './integrations/clerk/steps.js';
import { imageUpload } from './integrations/cloudinary/steps.js';
import {
	messageSend,
	discordUpdateUserRole,
} from './integrations/discord/steps.js';
import {
	bookableDatesGet,
	calendarEventList,
	eventsGetUnbookedDates,
	hostFreeBusy,
	sheetRowAppend,
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
} from './integrations/website/steps.js';

export { inngest } from './client.js';

export const functions = [
	handleWebhookUserCreatedOrUpdated,
	userGetById,
	userGetExternalAccountId,
	userSubscriptionUpdate,
	imageUpload,
	messageSend,
	discordUpdateUserRole,
	bookableDatesGet,
	calendarEventList,
	eventsGetUnbookedDates,
	hostFreeBusy,
	sheetRowAppend,
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
];
