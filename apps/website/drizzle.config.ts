import type { Config } from 'drizzle-kit';

function getDatabaseCredentials() {
	const databaseUrl = process.env.DATABASE_URL;

	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required for drizzle-kit');
	}

	const url = new URL(databaseUrl);

	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : 3306,
		user: decodeURIComponent(url.username),
		password: decodeURIComponent(url.password),
		database: url.pathname.replace(/^\//, ''),
		ssl: { rejectUnauthorized: true },
	};
}

export default {
	schema: ['./src/db/schema.ts'],
	dialect: 'mysql',
	dbCredentials: getDatabaseCredentials(),
	tablesFilter: ['ctv_*'],
	out: './src/db/generated',
} satisfies Config;
