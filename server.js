const { createServer } = require("http");
const next = require("next");
const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

const prisma = new PrismaClient();
const port = process.env.PORT || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

async function main() {
    await app.prepare();

    // ✅ Start cron jobs (every 15 minutes)
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

    // ✅ Start Next.js server
    createServer((req, res) => handle(req, res)).listen(port, () => {
        console.log(`🚀 Server ready on http://localhost:${port}`);
    });
}

main();
