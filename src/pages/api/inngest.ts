import { serve } from 'inngest/astro';
import { inngest } from '../../util/inngest/client';
import { functions } from '../../util/inngest';

export const { GET, POST, PUT } = serve({
	client: inngest,
	functions,
});
