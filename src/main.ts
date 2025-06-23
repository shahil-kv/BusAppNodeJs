import { httpServer } from './app';
import logger from './logger/winston.logger';
import { environment } from './environments/environment';

// dotenv.config() is called in app.ts, no need to call it again here

const PORT = environment.PORT;
const BASE_URL = environment.API_URL;

console.log(BASE_URL);
console.log(PORT);

const startServer = () => {
  const server = httpServer.listen(Number(PORT), '0.0.0.0', () => {
    // Store the server instances
    logger.info(`🔍 Server is running at: ${BASE_URL}`);
    logger.info(`  Server is running on port: ${PORT}`);
  });
};

startServer();
