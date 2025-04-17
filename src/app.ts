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
import { Server } from "socket.io";
import limiter from "./configs/limiter";
import busOwnerRouter from "./routes/BusOwner/busOwner.routes";
import busRouter from "./routes/Bus/Bus.routes";
import driverRouter from './routes/Driver/driver.routes'
import { errorHandler } from "./middleware/error.middleware";
import { SocketService } from "./services/socket.service";

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
        url: `${process.env.BASE_URL || "http://localhost"}:${process.env.PORT || 8080
          }${process.env.API_PREFIX || "/api/v1"}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/**/*.ts"], // Path to the API docs (your route files)
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN === "*"
      ? "*"
      : process.env.CORS_ORIGIN?.split(","),
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Initialize Socket Service
new SocketService(io);

// global middlewares
app.use(helmet()); // Use helmet for security headers
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === "*"
        ? "*" // This might give CORS error for some origins due to credentials set to true
        : process.env.CORS_ORIGIN?.split(","), // For multiple cors origin for production.
    credentials: true,
  })
);

app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

app.use(morganMiddleware);

//user route
app.use("/api/v1/bus-owner", busOwnerRouter);
//bus route
app.use("/api/v1/bus", busRouter);
//driver route
app.use('/api/v1/driver', driverRouter)

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
