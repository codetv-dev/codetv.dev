import type { APIRoute } from 'astro';

export const GET: APIRoute = async () =>
	Response.json(
		{
			id: 'codetv',
			displayName: 'CodeTV',
			description: 'CodeTV CourseBuilder API entrypoint',
			_links: {
				self: '/api',
				discovery: '/.well-known/coursebuilder-app',
				resources: '/api/resources',
				resourceEdges: '/api/resources/edges',
				lessons: '/api/lessons',
				workshops: '/api/workshops',
				products: '/api/products',
				coursebuilder: '/api/coursebuilder',
				trpc: '/api/trpc',
			},
			capabilities: {
				content: {
					api: '/api',
					resources: '/api/resources',
					resourceEdges: '/api/resources/edges',
					lessons: '/api/lessons',
					workshops: '/api/workshops',
					products: '/api/products',
				},
			},
			next_actions: [
				{
					command: 'cb auth whoami --app codetv',
					description: 'Confirm CourseBuilder CLI authentication',
				},
				{
					command: 'cb resource get <slug-or-id> --app codetv',
					description: 'Fetch a CourseBuilder content resource',
				},
			],
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
			},
		},
	);
