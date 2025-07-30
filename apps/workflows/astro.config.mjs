// @ts-check
import { defineConfig, envField } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	server: {
		port: 8765,
	},
	adapter: netlify(),
	env: {
		schema: {
			CLERK_SECRET_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			STRIPE_SECRET_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			STRIPE_WEBHOOK_SECRET: envField.string({
				access: 'secret',
				context: 'server',
			}),
			KIT_API_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			KIT_SECRET_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			SANITY_SECRET_TOKEN: envField.string({
				access: 'secret',
				context: 'server',
			}),
			INNGEST_SIGNING_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			INNGEST_EVENT_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			DISCORD_BOT_TOKEN: envField.string({
				access: 'secret',
				context: 'server',
			}),
			GOOGLE_API_SERVICE_ACCOUNT: envField.string({
				access: 'secret',
				context: 'server',
			}),
		},
	},
});
