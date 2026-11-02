import type { coupon, products } from '../db/schema';
import type { CommerceInput } from './commerce-contract';
export type CouponRow = typeof coupon.$inferSelect;
export type ProductRow = Pick<
	typeof products.$inferSelect,
	'id' | 'name' | 'organizationId'
>;
export type DiscountRow = { id: string; percentageDiscount: string | null };
export type SalesRow = {
	id: string;
	userId: string | null;
	buyerEmail: string | null;
	amount: string;
	status: string;
	createdAt: Date;
	couponId: string | null;
	couponCode: string | null;
	bulkCouponId: string | null;
	bulkCouponCode: string | null;
	redeemedBulkCouponId: string | null;
	redeemedBulkCouponCode: string | null;
};
export type SalesTotal = { purchaseCount: number; recordedAmount: string };
export interface CommerceStore {
	transaction<T>(run: (store: CommerceStore) => Promise<T>): Promise<T>;
	product(id: string, lock?: boolean): Promise<ProductRow | null>;
	sales(
		input: CommerceInput<'list_sales'>,
	): Promise<{
		purchases: SalesRow[];
		totals: SalesTotal;
		byStatus: (SalesTotal & { status: string })[];
	}>;
	coupons(input: CommerceInput<'list_coupons'>): Promise<CouponRow[]>;
	discounts(productId: string): Promise<DiscountRow[]>;
	coupon(id: string, lock?: boolean): Promise<CouponRow | null>;
	codeExists(code: string): Promise<boolean>;
	insertCoupon(row: typeof coupon.$inferInsert): Promise<void>;
	deactivateCoupon(id: string, expires: Date): Promise<void>;
}
