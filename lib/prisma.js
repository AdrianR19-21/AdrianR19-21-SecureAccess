import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL =
		process.env.NODE_ENV === 'production'
			? 'file:/tmp/dev.db'
			: 'file:./prisma/dev.db';
}

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

let databaseReadyPromise = null;

async function ensureSqliteSchema() {
	if (!databaseReadyPromise) {
		databaseReadyPromise = (async () => {
			await prisma.$executeRawUnsafe(`
				CREATE TABLE IF NOT EXISTS "User" (
					"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
					"username" TEXT NOT NULL UNIQUE,
					"password" TEXT NOT NULL
				);
			`);

			await prisma.$executeRawUnsafe(`
				CREATE TABLE IF NOT EXISTS "Link" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"title" TEXT,
					"url" TEXT NOT NULL,
					"notes" TEXT,
					"keywords" TEXT,
					"imageDataUrl" TEXT,
					"imageUrl" TEXT,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"userId" INTEGER NOT NULL,
					CONSTRAINT "Link_userId_fkey"
						FOREIGN KEY ("userId") REFERENCES "User" ("id")
						ON DELETE RESTRICT ON UPDATE CASCADE
				);
			`);

			await prisma.$executeRawUnsafe(`
				CREATE INDEX IF NOT EXISTS "Link_userId_idx" ON "Link" ("userId");
			`);

			await prisma.$executeRawUnsafe(`
				CREATE TABLE IF NOT EXISTS "VaultEntry" (
					"id" TEXT NOT NULL PRIMARY KEY,
					"title" TEXT NOT NULL,
					"siteUrl" TEXT,
					"loginName" TEXT,
					"secretValue" TEXT,
					"notes" TEXT,
					"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
					"userId" INTEGER NOT NULL,
					CONSTRAINT "VaultEntry_userId_fkey"
						FOREIGN KEY ("userId") REFERENCES "User" ("id")
						ON DELETE RESTRICT ON UPDATE CASCADE
				);
			`);

			await prisma.$executeRawUnsafe(`
				CREATE INDEX IF NOT EXISTS "VaultEntry_userId_idx" ON "VaultEntry" ("userId");
			`);
		})().catch((error) => {
			databaseReadyPromise = null;
			throw error;
		});
	}

	return databaseReadyPromise;
}

export async function ensureDatabaseReady() {
	return ensureSqliteSchema();
}
