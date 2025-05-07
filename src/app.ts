import { createServer } from "http";
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import morganMiddleware from "./logger/morgan.logger";
import requestIp from "request-ip";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import limiter from "./configs/limiter";
import { errorHandler } from "./middleware/error.middleware";
import authRouter from "./routes/auth.routes";
import groupRouter from "./routes/group.routes";

const BASE_URL = process.env.BASE_URL || "http://localhost";
const PORT = process.env.PORT || 8080;
const API_PREFIX = process.env.API_PREFIX || "/api/v1";

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Bus API",
      version: "1.0.0",
      description: "API documentation for the Bus Application",
    },
    servers: [
      {
        url: `${BASE_URL}:${PORT}${API_PREFIX}`,
        description: "API Server",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts"], // Path to the API docs (your route files)
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const httpServer = createServer(app);

// global middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
})); // Use helmet for security headers

// Configure CORS based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [BASE_URL] // In production, only allow requests from BASE_URL
    : true, // In development, allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));

app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

app.use(morganMiddleware);

//user route
app.use(API_PREFIX + "/user", authRouter);
app.use(API_PREFIX + '/group', groupRouter)

// * API DOCS
// ? Serve the dynamically generated Swagger docs
app.use(
  "/", // Serve Swagger UI at the root
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      docExpansion: "none", // keep all the sections collapsed by default
    },
    customSiteTitle: "Bus Api docs",
  })
);

// common error handling middleware
app.use(errorHandler);

export { httpServer };
