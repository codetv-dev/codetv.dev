/** ctv_User.name and ctv_User.image are varchar(255). */
const PROFILE_COLUMN_MAX = 255;

function fit(value: string | null | undefined) {
	return typeof value === 'string' && value.length <= PROFILE_COLUMN_MAX
		? value
		: null;
}

/**
 * Cosmetic Clerk profile values for a CodeTV user row. A value too long for its
 * column is dropped, so a long avatar URL can never fail the write that links a
 * Clerk login to a guest-checkout purchase (and with it, Workshop Access).
 */
export function profileColumns(input: {
	name: string | null | undefined;
	image: string | null | undefined;
}) {
	return { name: fit(input.name), image: fit(input.image) };
}
