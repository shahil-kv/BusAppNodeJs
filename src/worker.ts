// Worker-only entry point - completely isolated from server code
import logger from './logger/winston.logger';

// Ensure this is a worker process, not a server
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.IS_WORKER = 'true';

// Prevent any server-like behavior by setting different port
// This ensures worker doesn't conflict with main app
process.env.PORT = process.env.PORT || '8081';
process.env.HOST = 'localhost';

logger.info('Document processing worker started');
logger.info(`Worker process ID: ${process.pid}`);
logger.info(`Node environment: ${process.env.NODE_ENV}`);
logger.info(`Worker port: ${process.env.PORT}`);
logger.info('Worker is running in background mode - no HTTP server');

// Import the worker logic directly
import('./jobs/document.worker.js').then(() => {
    logger.info('Document worker module loaded successfully');
}).catch((error) => {
    logger.error('Failed to load document worker module:', error);
    process.exit(1);
});

// Keep the process alive
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
}); 