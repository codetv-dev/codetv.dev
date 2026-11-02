import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { getAbility, type AbilityUser } from './ability-rules';
import { privateLessonHeaders } from '../coursebuilder/workshop-lessons';
import {
	ContentError,
	contentInputs,
	adminOperations,
	readOperations,
	type ContentOperation,
} from './content-contract';
import type { OperationRunner } from './content-operations';

const descriptions: Record<ContentOperation, string> = {
	list_resources:
		'List content you can read. Pagination counts scanned rows: continue nextOffset even after an empty page.',
	get_resource: 'Read a content resource and its accessible child relations.',
	create_resource:
		'Create owned content. Contributor workshops must use a server-generated slug and remain unlisted drafts until an admin publishes.',
	update_resource:
		'Merge fields on owned content. Workshop slug/state/visibility and raw Mux identity are admin-only. videoResourceId must reference an owned video.',
	delete_resource:
		'Soft-delete owned content after confirmation. Workshops require admin. Does not delete descendants or Mux assets.',
	publish: 'Publish owned content. Workshops require admin.',
	unpublish: 'Move owned content back to draft. Workshops require admin.',
	archive: 'Archive owned content. Workshops require admin.',
	add_to_workshop:
		'Attach owned content: workshop to section/lesson, section to lesson, or lesson to videoResource. Both endpoints must be owned.',
	update_relation:
		'Update position or metadata on a relation between owned resources.',
	remove_from_workshop:
		'Detach a relation between owned resources. Does not delete content.',
	reorder:
		'Set the complete ordered child-id list on owned content. Each current child must appear exactly once.',
	attach_mux_asset:
		'Admin only: attach an imported Mux asset and signed playback id to a videoResource. Contributors must reuse owned videos.',
	list_contributors:
		'Admin only: list direct active ContentContribution assignments, including user email and role.',
	add_contributor:
		'Admin only: add an existing user by userId or email to a content resource. User roles are not changed.',
	remove_contributor:
		'Admin only: deactivate all direct contribution rows for an existing user on a resource. Creator/ancestor ownership and roles remain.',
	find_user:
		'Admin only: look up an existing user by exact email, including role and purchases. Never creates users.',
	set_user_role:
		'Admin only: set an existing user role after explicit confirmation. Cannot self-demote or remove the last admin.',
};

export function visibleContentTools(user: AbilityUser) {
	const ability = getAbility({ user });
	return (Object.keys(contentInputs) as ContentOperation[]).filter((name) => {
		if (adminOperations.has(name)) return ability.can('manage', 'all');
		const action = readOperations.has(name)
			? 'read'
			: name === 'create_resource'
				? 'create'
				: name === 'delete_resource'
					? 'delete'
					: ['publish', 'unpublish', 'archive'].includes(name)
						? name
						: 'update';
		// Discovery asks whether any rule supports the operation, not whether an
		// unknown resource is authorized. Execution always checks real subjects.
		return ability.rulesFor(action, 'Content').some((rule) => !rule.inverted);
	});
}

/** Stateless Streamable HTTP: no process-local sessions or cross-user tool state. */
export async function handleContentMcp(
	request: Request,
	user: AbilityUser,
	execute: OperationRunner,
) {
	if (request.method !== 'POST')
		return Response.json(
			{
				error: 'Method not allowed',
				why: 'This stateless MCP endpoint accepts POST only.',
				next: 'POST initialize, tools/list or tools/call using Streamable HTTP.',
			},
			{ status: 405, headers: { ...privateLessonHeaders, Allow: 'POST' } },
		);
	const server = new McpServer({ name: 'codetv-content', version: '1.0.0' });
	for (const name of visibleContentTools(user)) {
		const readOnly =
			readOperations.has(name) ||
			name === 'find_user' ||
			name === 'list_contributors';
		server.registerTool(
			name,
			{
				description: descriptions[name],
				inputSchema: contentInputs[name],
				annotations: {
					readOnlyHint: readOnly,
					destructiveHint:
						!readOnly &&
						!['create_resource', 'add_to_workshop', 'add_contributor'].includes(
							name,
						),
					openWorldHint: false,
				},
			},
			async (input: unknown) => {
				try {
					const data = await execute(name, input);
					const result = { data };
					return {
						content: [{ type: 'text' as const, text: JSON.stringify(result) }],
						structuredContent: result,
					};
				} catch (error) {
					const result =
						error instanceof ContentError
							? error.toJSON()
							: {
									error: 'Request failed',
									why: 'The content operation could not be completed.',
									next: 'Reload the resource and try again.',
								};
					return {
						isError: true,
						content: [{ type: 'text' as const, text: JSON.stringify(result) }],
						structuredContent: result,
					};
				}
			},
		);
	}
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
		maxRequestBodySize: 2_000_000,
	});
	try {
		await server.connect(transport);
		const response = await transport.handleRequest(request);
		const headers = new Headers(response.headers);
		for (const [key, value] of Object.entries(privateLessonHeaders))
			headers.set(key, value);
		return new Response(response.body, { status: response.status, headers });
	} finally {
		await server.close();
	}
}
