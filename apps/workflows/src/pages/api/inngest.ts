import { serve } from 'inngest/astro';
import { inngest, functions } from '@codetv/inngest';

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions,
});
