import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { purchases, users } from '../db/schema';
import { roleChangeError, type AdminRole } from './admin-access';

export class AdminInputError extends Error {
	constructor(
		message: string,
		public status = 400,
	) {
		super(message);
	}
}

export async function findAdminUser(email: string) {
	if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email))
		throw new AdminInputError('Enter a complete email address.');
	const user = await db.query.users.findFirst({
		where: eq(users.email, email),
	});
	if (!user)
		return {
			user: null,
			purchases: [],
			message: 'This user needs to sign in once first. No user was created.',
		};
	const orders = await db.query.purchases.findMany({
		where: eq(purchases.userId, user.id),
		orderBy: desc(purchases.createdAt),
		with: { product: true },
		limit: 100,
	});
	return {
		user: { id: user.id, email: user.email, name: user.name, role: user.role },
		purchases: orders.map((p) => ({
			id: p.id,
			productId: p.productId,
			productName: p.product?.name,
			status: p.status,
			amount: p.totalAmount,
			createdAt: p.createdAt,
		})),
	};
}

export async function setAdminUserRole(
	actorId: string,
	targetId: string,
	role: AdminRole,
) {
	if (!targetId || targetId.length > 255)
		throw new AdminInputError('Invalid user id.');
	return db.transaction(async (tx) => {
		// Lock a common set in a stable order. Recheck the actor under the same
		// locks so two admins cannot concurrently demote each other to zero.
		const admins = await tx
			.select({ id: users.id })
			.from(users)
			.where(eq(users.role, 'admin'))
			.orderBy(users.id)
			.for('update');
		const [target] = await tx
			.select()
			.from(users)
			.where(eq(users.id, targetId))
			.for('update');
		if (!target)
			throw new AdminInputError('This user needs to sign in once first.', 404);
		const error = roleChangeError({
			actorId,
			targetId,
			role,
			currentRole: target.role,
			adminIds: admins.map((u) => u.id),
		});
		if (error) throw new AdminInputError(error, 409);
		await tx.update(users).set({ role }).where(eq(users.id, targetId));
		return { user: { id: target.id, email: target.email, role } };
	});
}
