import { inngest } from '../../client.js';
import { tagSubscriber as tagSubscriberKit } from '@codetv/kit';

export const tagSubscriber = inngest.createFunction(
	{ id: 'kit/subscriber.tag.add' },
	{ event: 'kit/subscriber.tag.add' },
	async function ({
		event,
		step,
	}: {
		event: any;
		step: any;
	}): Promise<{ subscription: any }> {
		return await step.run('tag-subscriber', async () => {
			return await tagSubscriberKit(event.data.email, event.data.tagName);
		});
	},
);
