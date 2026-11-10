/** ctv_User.name and ctv_User.image are varchar(255). */
const PROFILE_COLUMN_MAX = 255;

function fit(field: 'name' | 'image', value: string | null | undefined) {
	if (typeof value !== 'string') return null;
	const length = [...value].length;
	if (length <= PROFILE_COLUMN_MAX) return value;
	console.warn('Dropped oversized Clerk profile field', { field, length });
	return null;
}

/**
 * Cosmetic Clerk profile values for a CodeTV user row. A value too long for its
 * column is dropped, so a long avatar URL can never fail the write that links a
 * Clerk login to a guest-checkout purchase (and with it, Workshop Access).
 * Count MySQL characters (code points), not UTF-16 units. The linker retries
 * without cosmetic values if an older utf8mb3 table cannot store them.
 */
export function profileColumns(input: {
	name: string | null | undefined;
	image: string | null | undefined;
}) {
	return { name: fit('name', input.name), image: fit('image', input.image) };
}
