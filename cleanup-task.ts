import { exec } from "child_process";
import { PrismaClient } from "@prisma/client";
import util from "util";


const prisma = new PrismaClient();
const execAsync = util.promisify(exec);

console.log("Starting cron task...");

async function setupDatabase() {
    try {
        console.log("Ensuring database exists and migrations are applied...");
        await execAsync("node dist/dbsetup.js");
        console.log("Database ready ✅");
    } catch (err) {
        console.error("Database setup failed:", err);
        process.exit(1);
    }
}

async function waitForDatabase() {
    try {
        prisma.$queryRaw`SELECT 1`;
        console.log("verification-db:5432 - database ready");
    } catch {
        await new Promise((r) => setTimeout(r, 1000));
    }
}

async function startCron() {
    try {
        const cutoff = new Date(Date.now() - 14 * 60 * 1000); // 14 minutes ago
        const result = await prisma.verificationRequest.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });
        console.log(`🧹 Deleted ${result.count} expired verification requests`);
    } catch (err) {
        console.error("❌ Cron job failed:", err);
    }
}

(async () => {
    await setupDatabase();
    await waitForDatabase();
    await startCron();
})();