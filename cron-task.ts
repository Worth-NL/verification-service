import { exec } from "child_process";
import util from "util";
import { PrismaClient } from "@prisma/client";
import cron from "node-cron";

const prisma = new PrismaClient();
const execAsync = util.promisify(exec);

// 1️⃣ Ensure database exists and migrations are applied
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

// 2️⃣ Wait for database to be reachable
async function waitForDatabase() {
    while (true) {
        try {
            await prisma.$queryRaw`SELECT 1`;
            console.log("verification-db:5432 - database ready");
            break;
        } catch {
            await new Promise((r) => setTimeout(r, 1000));
        }
    }
}

// 3️⃣ Main cron logic
async function startCron() {
    console.log("Starting cron task...");

    cron.schedule("*/15 * * * *", async () => {
        try {
            const cutoff = new Date(Date.now() - 14 * 60 * 1000); // 14 minutes ago
            const result = await prisma.verificationRequest.deleteMany({
                where: { createdAt: { lt: cutoff } },
            });
            console.log(`🧹 Deleted ${result.count} expired verification requests`);
        } catch (err) {
            console.error("❌ Cron job failed:", err);
        }
    });

    console.log("Cron container started. Waiting for scheduled tasks...");
    // Keep the container alive
    setInterval(() => { }, 1 << 30);
}

// 4️⃣ Run setup + wait + cron
(async () => {
    await setupDatabase();
    await waitForDatabase();
    await startCron();
})();
