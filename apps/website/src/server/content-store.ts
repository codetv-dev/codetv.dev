import type { OwnershipNode } from './content-ownership';
import type { ResourceType } from './content-contract';

export type ContentResourceRow = {
	id: string;
	type: string;
	createdById: string;
	fields: Record<string, any> | null;
	deletedAt?: Date | null;
	createdAt?: Date | null;
	updatedAt?: Date | null;
};
export type ContentEdge = {
	resourceOfId: string;
	resourceId: string;
	position: number;
	metadata: Record<string, any> | null;
};
export type ContentUser = { id: string; email: string; role: string };
export type ContributorRow = {
	id: string;
	userId: string;
	email: string | null;
	role: string | null;
	contributionTypeId: string;
};

/** Database-only boundary; the service owns permissions and validation. */
export interface ContentStore {
	transaction<T>(run: (store: ContentStore) => Promise<T>): Promise<T>;
	lock(ids: string[]): Promise<void>;
	get(id: string): Promise<ContentResourceRow | null>;
	list(input: {
		type?: ResourceType;
		limit: number;
		offset: number;
	}): Promise<ContentResourceRow[]>;
	ownership(id: string): Promise<OwnershipNode | null>;
	edges(parentId: string): Promise<ContentEdge[]>;
	insert(resource: ContentResourceRow): Promise<void>;
	patch(
		id: string,
		fields: Record<string, any>,
		deletedAt?: Date,
	): Promise<void>;
	insertEdge(edge: ContentEdge): Promise<void>;
	patchEdge(edge: ContentEdge): Promise<void>;
	removeEdge(parentId: string, childId: string): Promise<void>;
	findUser(input: {
		userId?: string;
		email?: string;
	}): Promise<ContentUser | null>;
	contributors(id: string): Promise<ContributorRow[]>;
	addContributor(id: string, userId: string): Promise<void>;
	removeContributor(id: string, userId: string): Promise<void>;
}
