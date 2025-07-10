import { httpServer } from './app';
import { logger } from './utils/logger'
import { environment } from './environments/environment';

// dotenv.config() is called in app.ts, no need to call it again here

const PORT = environment.PORT;
const BASE_URL = environment.API_URL;

const startServer = () => {
  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    // Store the server instances
    logger.success(`🔍 Server is running at: ${BASE_URL}`);
  });
};

startServer();
