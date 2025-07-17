import { httpServer } from './app';
import { logger } from './utils/logger'
import { environment } from './environments/environment';
import { AudioProcessor } from './voice/streaming/audioProcessor';

// dotenv.config() is called in app.ts, no need to call it again here

const PORT = environment.PORT;
const BASE_URL = environment.API_URL;

const startServer = async () => {
  // Initialize the audio processor
  await AudioProcessor.initialize();

  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    // Store the server instances
    logger.success(`✅ Server is running at: ${BASE_URL}`);
  });
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.log('SIGINT signal received: closing HTTP server');
  AudioProcessor.destroy();
  httpServer.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  logger.log('SIGTERM signal received: closing HTTP server');
  AudioProcessor.destroy();
  httpServer.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
});
