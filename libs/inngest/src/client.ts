import { EventSchemas, Inngest } from 'inngest';
import { schema as clerkSchema } from './integrations/clerk/index.js';
import { schema as cloudinarySchema } from './integrations/cloudinary/index.js';
import { schema as discordSchema } from './integrations/discord/index.js';
import { schema as googleSchema } from './integrations/google/index.js';
import { schema as sanitySchema } from './integrations/sanity/index.js';
import { schema as stripeSchema } from './integrations/stripe/index.js';
import { schema as websiteSchema } from './integrations/website/index.js';
import { schema as kitSchema } from './integrations/kit/index.js';

// TODO pin Zod to 3 or figure out other workaround for
// https://github.com/inngest/inngest-js/issues/1014
export const schemas = new EventSchemas()
	.fromZod(clerkSchema)
	.fromZod(cloudinarySchema)
	.fromZod(discordSchema)
	.fromZod(googleSchema)
	.fromZod(sanitySchema)
	.fromZod(stripeSchema)
	.fromZod(websiteSchema)
	.fromZod(kitSchema);

if (!process.env.INNGEST_EVENT_KEY) {
	console.error('missing INNGEST_EVENT_KEY. Workflows will not run.');
}

if (!process.env.INNGEST_SIGNING_KEY) {
	console.error('missing INNGEST_SIGNING_KEY. Workflows will not run.');
}

export const inngest = new Inngest({
	id: 'codetv',
	schemas,
	eventKey: process.env.INNGEST_EVENT_KEY,
});
