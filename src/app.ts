import { createServer } from 'http';
import { environment } from './environments/environment';
import cookieParser from 'cookie-parser';
import morganMiddleware from './logger/morgan.logger';
import requestIp from 'request-ip';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import limiter from './config/limiter';
import { errorHandler } from './middleware/error.middleware';
import authRouter from './routes/auth.routes';
import groupRouter from './routes/group.routes';
import reportRouter from './routes/report.routes';
import callRouter from './routes/call.routes';
import HomeRouter from './routes/home.routes';
import WorkflowRouter from './routes/workflow.routes';
import { voiceHandler } from './controllers/voice.controller';
import { callStatusHandler, recordingStatusHandler } from './controllers/status.controller';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { TwilioStreamManager } from './ws/twilioStreamManager';
import { logger } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = environment.API_URL;
const PORT = environment.PORT;
const API_PREFIX = environment.API_PREFIX;

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bus API',
      version: '1.0.0',
      description: 'API documentation for the Bus Application',
    },
    servers: [
      {
        url: `${BASE_URL}:${PORT}${API_PREFIX}`,
        description: 'API Server',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts'], // Path to the API docs (your route files)
};

// Generate Swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const app = express();
const httpServer = createServer(app);

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins (for development); restrict in production
    methods: ['GET', 'POST'],
  },
});

const twilioManager = new TwilioStreamManager(httpServer);
logger.log('Twilio Stream Manager initialized');

// Global middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  }),
);

// Configure CORS based on environment
const corsOptions = {
  origin:
    environment.NODE_ENV === 'production'
      ? [BASE_URL] // In production, only allow requests from BASE_URL
      : true, // In development, allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-Twilio-Signature'],
};

app.use(cors(corsOptions));
app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(cookieParser());
app.use(morganMiddleware);

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, '../temp')));
app.set('io', io);

// API Routes
app.use(API_PREFIX + '/user', authRouter);
app.use(API_PREFIX + '/group', groupRouter);
app.use(API_PREFIX + '/call', callRouter);
app.use(API_PREFIX + '/home', HomeRouter);
app.use(API_PREFIX + '/report', reportRouter);
app.use(API_PREFIX + '/workflow', WorkflowRouter);

// Twilio webhook endpoints (these must be accessible without API_PREFIX)
app.post('/call-status', callStatusHandler);
app.post('/voice-update', voiceHandler);
app.post('/recording-status', recordingStatusHandler);

// Health check endpoint for WebSocket
app.get('/ws/health', (req, res) => {
  res.json({
    status: 'ok',
    websocket: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// API Documentation
app.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      docExpansion: 'none',
    },
    customSiteTitle: 'Bus Api docs',
  }),
);

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.log('Socket.IO client connected:', socket.id);

  socket.on('disconnect', () => {
    logger.log('Socket.IO client disconnected:', socket.id);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.log('SIGTERM received, shutting down gracefully');
  twilioManager.close(() => {
    logger.log('Twilio WebSocket server closed');
  });
  httpServer.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
});

export { httpServer };
