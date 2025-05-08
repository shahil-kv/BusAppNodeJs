import { httpServer } from "./app";
import logger from "./logger/winston.logger";
import { environment } from "./environments/environment";

// dotenv.config() is called in app.ts, no need to call it again here

const PORT = environment.PORT;
const BASE_URL = environment.API_URL;

const startServer = () => {
  const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
    // Store the server instances
    logger.info(`🔍 Server is running at: ${BASE_URL}`);
    logger.info(`  Server is running on port: ${PORT}`);
  });

  const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Closing http server.`);
    server.close((err) => {
      if (err) {
        logger.error("Error during server close:", err);
        process.exit(1); // Exit with error code
      } else {
        logger.info("Http server closed.");
        // Add any other cleanup logic here (e.g., close database connections)
        process.exit(0); // Exit successfully
      }
    });

    // Optional: Force shutdown after a timeout if cleanup takes too long
    setTimeout(() => {
      logger.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000); // 10 seconds timeout
  };

  // Listen for termination signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Catches Ctrl+C
};

startServer();
