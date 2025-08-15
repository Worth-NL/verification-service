import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import pool from "./config/db.js"
import errorHandling from "./middlewares/errorHandler.js";
import userRoutes from "./routes/userRoutes.js";
import createUserTable from "./data/createUserTable.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use("/api", userRoutes)

// Error Handling
app.use(errorHandling);

// Initialize User table if necessary
createUserTable();

// Test Postgres Connection
app.get("/", async (req, res) => {
    console.log("Start connection test");

    const result = await pool.query("SELECT current_database()");
    res.send(`The database name is: ${result.rows[0].current_database}`);

    console.log("End connection test");
});

// Server running
app.listen(port, () => {
    console.log(`Service is running on http://localhost:${port}`);
});