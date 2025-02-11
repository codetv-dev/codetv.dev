import { defineConfig, envField } from 'astro/config';
import clerk from '@clerk/astro';
import netlify from '@astrojs/netlify';
import { imageService } from '@unpic/astro/service';
import mdx from '@astrojs/mdx';

import react from '@astrojs/react';

import sitemap from '@astrojs/sitemap';

import expressiveCode from 'astro-expressive-code';

// https://astro.build/config
export default defineConfig({
	site: 'https://codetv.dev',
	output: 'server',
	trailingSlash: 'never',
	integrations: [
		clerk({
			afterSignInUrl: '/dashboard',
			afterSignUpUrl: '/dashboard',
		}),
		expressiveCode({
			themes: ['night-owl'],
		}),
		mdx(),
		react(),
		sitemap(),
	],
	image: {
		domains: ['img.clerk.com'],
		service: imageService(),
	},
	adapter: netlify(),
	security: {
		checkOrigin: false,
	},
	env: {
		schema: {
			NETLIFY_PERSONAL_ACCESS_TOKEN: envField.string({
				access: 'secret',
				context: 'server',
			}),
			PUBLIC_CLERK_PUBLISHABLE_KEY: envField.string({
				access: 'public',
				context: 'client',
			}),
			PUBLIC_CLERK_SIGN_IN_URL: envField.string({
				access: 'public',
				context: 'client',
			}),
			PUBLIC_CLERK_SIGN_UP_URL: envField.string({
				access: 'public',
				context: 'client',
			}),
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
			TIER_SILVER_PRICE_ID: envField.string({
				access: 'secret',
				context: 'server',
			}),
			TIER_GOLD_PRICE_ID: envField.string({
				access: 'secret',
				context: 'server',
			}),
			TIER_PLATINUM_PRICE_ID: envField.string({
				access: 'secret',
				context: 'server',
			}),
			MUX_JWT_SIGNING_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			// MUX_JWT_PRIVATE_KEY: envField.string({
			// 	access: 'secret',
			// 	context: 'server',
			// }),
			MUX_TOKEN_ID: envField.string({
				access: 'secret',
				context: 'server',
			}),
			MUX_TOKEN_SECRET: envField.string({
				access: 'secret',
				context: 'server',
			}),
			CLOUDINARY_CLOUD_NAME: envField.string({
				access: 'secret',
				context: 'server',
			}),
			CLOUDINARY_API_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			CLOUDINARY_API_SECRET: envField.string({
				access: 'secret',
				context: 'server',
			}),
			CONVERTKIT_API_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			CONVERTKIT_SECRET_KEY: envField.string({
				access: 'secret',
				context: 'server',
			}),
			SANITY_SECRET_TOKEN: envField.string({
				access: 'secret',
				context: 'server',
			}),
			DISCORD_BOT_TOKEN: envField.string({
				access: 'secret',
				context: 'server',
			}),
			PUBLIC_ALGOLIA_API_KEY: envField.string({
				access: 'public',
				context: 'client',
			}),
			PUBLIC_ALGOLIA_APP_ID: envField.string({
				access: 'public',
				context: 'client',
			}),
		},
	},
});
