import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

async function ensureDatabase() {
    try {
        // Check if the table exists
        const tableCheck = await prisma.$queryRaw<
            Array<{ tablename: string }>
        >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='VerificationRequest'`;

        if (tableCheck.length === 0) {
            console.log("🛠 Table 'VerificationRequest' does not exist — applying migrations...");

            // Run Prisma CLI migrate deploy synchronously
            execSync("npx prisma migrate deploy", { stdio: "inherit" });

            console.log("✅ Database is ready.");
        } else {
            console.log("✅ Database already has required tables.");
        }
    } catch (err) {
        console.error("❌ Error ensuring database:", err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

ensureDatabase();
