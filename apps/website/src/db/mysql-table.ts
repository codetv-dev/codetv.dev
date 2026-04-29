import { mysqlTableCreator } from 'drizzle-orm/mysql-core';

/**
 * Prefix CourseBuilder tables for CodeTV. This mirrors the existing CourseBuilder
 * app pattern while keeping the CodeTV database namespace explicit.
 */
export const mysqlTable = mysqlTableCreator((name) => `ctv_${name}`);
