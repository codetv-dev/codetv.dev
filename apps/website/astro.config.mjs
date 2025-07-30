import { defineConfig, envField } from 'astro/config';
import clerk from '@clerk/astro';
import { dark } from '@clerk/themes';
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
			appearance: {
				baseTheme: dark,
				variables: {
					colorBackground: '#18151f',
				},
			},
		}),
		expressiveCode({ themes: ['night-owl'] }),
		mdx(),
		react(),
		sitemap(),
	],
	image: { domains: ['img.clerk.com'], service: imageService() },
	adapter: netlify(),
	security: { checkOrigin: false },
	env: {
		schema: {
			PUBLIC_CLERK_PUBLISHABLE_KEY: envField.string({
				access: 'public',
				context: 'client',
			}),
			MUX_JWT_SIGNING_KEY: envField.string({
				access: 'secret',
				context: 'server',
				default: '',
			}),
			MUX_TOKEN_ID: envField.string({
				access: 'secret',
				context: 'server',
				default: '',
			}),
			MUX_TOKEN_SECRET: envField.string({
				access: 'secret',
				context: 'server',
				default: '',
			}),
			ALGOLIA_API_KEY: envField.string({
				access: 'public',
				context: 'client',
			}),
			ALGOLIA_APP_ID: envField.string({
				access: 'public',
				context: 'client',
			}),
		},
	},
});
