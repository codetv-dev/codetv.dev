import { Client } from '@planetscale/database';
import { drizzle } from 'drizzle-orm/planetscale-serverless';

import { DrizzleAdapter } from '@coursebuilder/adapter-drizzle';

import { getStripeProvider } from '../coursebuilder/stripe-provider';
import { mysqlTable } from './mysql-table';
import * as schema from './schema';

function getDatabaseUrl() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error(
			'DATABASE_URL is required to use the CourseBuilder database',
		);
	}

	return databaseUrl;
}

function createDb() {
	return drizzle(
		new Client({
			url: getDatabaseUrl(),
		}),
		{ schema },
	);
}

type CourseBuilderDb = ReturnType<typeof createDb>;

let dbInstance: CourseBuilderDb | null = null;

export function getDb() {
	dbInstance ??= createDb();

	return dbInstance;
}

export const db = new Proxy({} as CourseBuilderDb, {
	get(_target, property, receiver) {
		return Reflect.get(getDb() as object, property, receiver);
	},
});

function createCourseBuilderAdapter() {
	return DrizzleAdapter(
		getDb() as any,
		mysqlTable,
		getStripeProvider() ?? undefined,
	);
}

type CourseBuilderAdapter = ReturnType<typeof createCourseBuilderAdapter>;

let courseBuilderAdapterInstance: CourseBuilderAdapter | null = null;

export function getCourseBuilderAdapter() {
	courseBuilderAdapterInstance ??= createCourseBuilderAdapter();

	return courseBuilderAdapterInstance;
}

export const courseBuilderAdapter = new Proxy({} as CourseBuilderAdapter, {
	get(_target, property, receiver) {
		return Reflect.get(getCourseBuilderAdapter() as object, property, receiver);
	},
});
