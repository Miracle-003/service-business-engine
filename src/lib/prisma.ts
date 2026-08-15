import { PrismaClient } from "@/src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var __prisma__: InstanceType<typeof PrismaClient> | undefined;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to initialize Prisma client");
}

export const prisma =
  global.__prisma__ ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
