import { execFileSync } from "child_process";
import path from "path";

function ensureDatabase() {
    try {
        // Always run migrate deploy: it only applies migrations that haven't
        // run yet, so existing databases pick up new ones too. Invoked via node
        // directly because the runtime image doesn't ship npm/npx.
        console.log("🛠 Applying pending database migrations...");
        const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
        execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], { stdio: "inherit" });
        console.log("✅ Database is ready.");
    } catch (err) {
        console.error("❌ Error ensuring database:", err);
        process.exit(1);
    }
}

ensureDatabase();
