import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import path from "path";

const prisma = new PrismaClient();

async function ensureDatabase() {
    try {
        // Check if the table exists
        const tableCheck = await prisma.$queryRaw<
            Array<{ tablename: string }>
        >`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='VerificationRequest'`;

        if (tableCheck.length === 0) {
            console.log("🛠 Table 'VerificationRequest' does not exist — applying migrations...");

            // Run Prisma CLI migrate deploy synchronously. Invoked via node
            // directly because the runtime image doesn't ship npm/npx.
            const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
            execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit" });

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
