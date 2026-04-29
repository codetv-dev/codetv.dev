import { Client } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

import { DrizzleAdapter } from '@coursebuilder/adapter-drizzle';

import { getStripeProvider } from '../coursebuilder/stripe-provider';
import { mysqlTable } from './mysql-table';
import * as schema from './schema';

export const db = drizzle(
	new Client({
		url: process.env.DATABASE_URL ?? '',
	}),
	{ schema },
);

export const courseBuilderAdapter = DrizzleAdapter(
	db as any,
	mysqlTable,
	getStripeProvider() ?? undefined,
);
