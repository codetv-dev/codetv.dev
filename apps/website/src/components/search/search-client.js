import { liteClient } from 'algoliasearch/lite';
import { ALGOLIA_APP_ID, ALGOLIA_API_KEY } from 'astro:env/client';

export const searchClient = liteClient(ALGOLIA_APP_ID, ALGOLIA_API_KEY);
