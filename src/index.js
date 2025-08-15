import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import errorHandling from "./middlewares/errorHandler.js";
import emailVerificationRequestRoutes from "./routes/emailVerificationRequestRoutes.js"
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger/swagger.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors());

// Generate swagger UI:
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Routes
app.use("/api/emailVerificationRequests", emailVerificationRequestRoutes)

// Error Handling
app.use(errorHandling);

// Server running
app.listen(port, () => {
    console.log(`Service is running on http://localhost:${port}`);
});