import { Client } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

import { DrizzleAdapter } from '@coursebuilder/adapter-drizzle';

import { getStripeProvider } from '../coursebuilder/stripe-provider';
import { mysqlTable } from './mysql-table';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error(
		'DATABASE_URL is required to initialize the CourseBuilder database',
	);
}

export const db = drizzle(
	new Client({
		url: databaseUrl,
	}),
	{ schema },
);

export const courseBuilderAdapter = DrizzleAdapter(
	db as any,
	mysqlTable,
	getStripeProvider() ?? undefined,
);
