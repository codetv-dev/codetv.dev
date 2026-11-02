export type OwnershipNode = {
	id: string;
	createdById: string;
	contributors: string[];
	parentIds: string[];
};

/** Follow parent links only: a workshop owner owns descendants, not siblings. */
export async function contentOwnerIds(
	id: string,
	load: (id: string) => Promise<OwnershipNode | null>,
) {
	const visited = new Set<string>();
	const owners = new Set<string>();
	const pending = [id];
	while (pending.length) {
		const current = pending.pop()!;
		if (visited.has(current)) continue;
		visited.add(current);
		const node = await load(current);
		if (!node) continue;
		owners.add(node.createdById);
		for (const owner of node.contributors) owners.add(owner);
		pending.push(...node.parentIds);
	}
	return [...owners];
}
