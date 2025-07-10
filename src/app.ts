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
import {
  callStatusHandler,
  recordingStatusHandler,
} from './controllers/status.controller';
import { Server } from 'socket.io';
import path from 'path';
import { TwilioWebSocketHandler } from './ws/twilioWebSocket.ws';
import { logger } from './utils/logger';

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

const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins (for development); restrict in production
    methods: ['GET', 'POST'],
  },
});

// global middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  }),
); // Use helmet for security headers

// Configure CORS based on environment
const corsOptions = {
  origin:
    environment.NODE_ENV === 'production'
      ? [BASE_URL] // In production, only allow requests from BASE_URL
      : true, // In development, allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));

app.use(requestIp.mw());

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public')); // configure static file to save images locally
app.use(cookieParser());

app.use(morganMiddleware);
// Serve static audio files (add this to your app.ts)
app.use('/audio', express.static(path.join(__dirname, '../temp')));
app.set('io', io);

//user route
app.use(API_PREFIX + '/user', authRouter);
app.use(API_PREFIX + '/group', groupRouter);
app.use(API_PREFIX + '/call', callRouter);
app.use(API_PREFIX + '/home', HomeRouter);
app.use(API_PREFIX + '/report', reportRouter);
app.use(API_PREFIX + '/workflow', WorkflowRouter);

//for calling purpose from twilio api
app.post('/call-status', callStatusHandler);
app.post('/voice-update', voiceHandler);
app.post('/recording-status', recordingStatusHandler);

// Socket.IO connection handler
io.on('connection', (socket) => {
  logger.log('Socket.IO client connected:', socket.id);

  socket.on('disconnect', () => {
    logger.log('Socket.IO client disconnected:', socket.id);
  });
});

// * API DOCS
// ? Serve the dynamically generated Swagger docs
app.use(
  '/', // Serve Swagger UI at the root
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      docExpansion: 'none', // keep all the sections collapsed by default
    },
    customSiteTitle: 'Bus Api docs',
  }),
);

// common error handling middleware
app.use(errorHandler);

// Setup Twilio WebSocket for ConversationRelay
new TwilioWebSocketHandler(httpServer);

export { httpServer };
