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
import { setupTwilioWebSocket } from './ws/twilioMediaStream.ws'; // Updated import
import { logger } from './utils/logger';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

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

// IMPORTANT: Setup Twilio WebSocket BEFORE other middleware
// This ensures the WebSocket server is ready when Twilio tries to connect
const twilioWss = setupTwilioWebSocket(httpServer);
logger.log('Twilio WebSocket server initialized');

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

// Manual test tone endpoint
app.post('/test-tone/:connectionId', (req, res) => {
  const { connectionId } = req.params;

  if (twilioWss.sendTestTone) {
    twilioWss.sendTestTone(connectionId).then(success => {
      if (success) {
        res.json({ success: true, message: 'Test tone sent to connection ' + connectionId });
      } else {
        res.status(404).json({ success: false, message: 'Connection not found' });
      }
    }).catch(error => {
      res.status(500).json({ success: false, error: error.message });
    });
  } else {
    res.status(500).json({ success: false, message: 'WebSocket server not available' });
  }
});

// Audio playback test endpoint
app.get('/play-audio/:sessionId/:type', (req, res) => {
  const { sessionId, type } = req.params;

  if (!['incoming', 'outgoing'].includes(type)) {
    return res.status(400).json({ error: 'Invalid audio type. Use "incoming" or "outgoing"' });
  }

  const audioDir = join(process.cwd(), 'temp', 'audio');
  const summaryFile = join(audioDir, `${sessionId}_summary.json`);

  try {
    if (!existsSync(summaryFile)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
    const chunks = type === 'incoming' ? summary.incomingChunks : summary.outgoingChunks;

    res.json({
      sessionId,
      audioType: type,
      totalChunks: chunks,
      summary: summary,
      files: Array.from({ length: Math.min(chunks, 10) }, (_, i) => `${sessionId}_${type}_chunk_${i + 1}.raw`)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error reading session data' });
  }
});

// Download audio chunk endpoint
app.get('/download-audio/:sessionId/:type/:chunkNumber', (req, res) => {
  const { sessionId, type, chunkNumber } = req.params;

  if (!['incoming', 'outgoing'].includes(type)) {
    return res.status(400).json({ error: 'Invalid audio type' });
  }

  const audioDir = join(process.cwd(), 'temp', 'audio');
  const filename = `${sessionId}_${type}_chunk_${chunkNumber}.raw`;
  const filepath = join(audioDir, filename);

  try {
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: 'Audio chunk not found' });
    }

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ error: 'Error downloading audio chunk' });
  }
});

// Health check endpoint for WebSocket
app.get('/ws/health', (req, res) => {
  res.json({
    status: 'ok',
    websocket: 'ready',
    timestamp: new Date().toISOString(),
  });
});

// WebSocket stats endpoint
app.get('/ws/stats', (req, res) => {
  const stats = twilioWss.getBridgeStats ? twilioWss.getBridgeStats() : { error: 'Stats not available' };
  res.json(stats);
});

// Enhanced diagnostic endpoint
app.get('/diagnostic', (req, res) => {
  const diagnostic = {
    server: {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    },
    websocket: {
      status: 'ready',
      connections: twilioWss.getBridgeStats ? twilioWss.getBridgeStats() : { error: 'Stats not available' }
    },
    environment: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      geminiApiKey: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
      ngrokUrl: process.env.NGROK_BASE_URL || 'not configured',
      mediaStreamUrl: process.env.MEDIA_STREAM_WSS_URL || 'not configured'
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? 'configured' : 'missing',
      authToken: process.env.TWILIO_AUTH_TOKEN ? 'configured' : 'missing',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'not configured'
    },
    database: {
      url: process.env.DATABASE_URL ? 'configured' : 'missing'
    }
  };

  res.json(diagnostic);
});

// WebSocket connection test endpoint
app.get('/ws-test', (req, res) => {
  const wsUrl = process.env.NGROK_BASE_URL ?
    process.env.NGROK_BASE_URL.replace('https://', 'wss://') + '/ws/twilio-audio' :
    'wss://localhost:8080/ws/twilio-audio';

  res.json({
    websocketUrl: wsUrl,
    testInstructions: 'Use a WebSocket client to connect to this URL and send a test message'
  });
});

// Test audio endpoint to verify audio works
app.get('/test-audio', (req, res) => {
  res.set({
    'Content-Type': 'text/xml',
    'Cache-Control': 'no-cache',
  });

  // Simple TwiML that plays a test tone
  const testTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">Testing audio playback. You should hear this message clearly.</Say>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="hi-IN">If you can hear this, your audio is working correctly.</Say>
</Response>`;

  res.send(testTwiML);
});

// Test WebSocket audio endpoint
app.get('/test-websocket-audio', (req, res) => {
  res.set({
    'Content-Type': 'text/xml',
    'Cache-Control': 'no-cache',
  });

  const mediaStreamUrl = process.env.MEDIA_STREAM_WSS_URL ||
    (process.env.NGROK_BASE_URL ? process.env.NGROK_BASE_URL.replace('https://', 'wss://') + '/ws/twilio-audio' : '');

  const testTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">Testing WebSocket audio streaming...</Say>
  <Connect>
    <Stream url="${mediaStreamUrl}">
      <Parameter name="CallSid" value="test123" />
      <Parameter name="groupId" value="1" />
    </Stream>
  </Connect>
</Response>`;

  res.send(testTwiML);
});

// Audio testing endpoint for debugging Twilio Media Streams
app.get('/test-audio-pipeline', (req, res) => {
  res.set({
    'Content-Type': 'text/xml',
    'Cache-Control': 'no-cache',
  });

  const mediaStreamUrl = process.env.MEDIA_STREAM_WSS_URL ||
    (process.env.NGROK_BASE_URL ? process.env.NGROK_BASE_URL.replace('https://', 'wss://') + '/ws/twilio-audio' : '');

  const strategy = req.query.strategy || 'interpolated';
  const amplification = req.query.amplification || '1.0';
  const testDirect = req.query.direct === 'true';

  // Set environment variables for this test
  process.env.AUDIO_PROCESSING_STRATEGY = strategy as string;
  process.env.AUDIO_AMPLIFICATION = amplification as string;
  process.env.TEST_DIRECT_AUDIO = testDirect ? 'true' : 'false';

  const testTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">Testing audio pipeline with strategy: ${strategy}, amplification: ${amplification}${testDirect ? ', direct mode' : ''}...</Say>
  <Connect>
    <Stream url="${mediaStreamUrl}">
      <Parameter name="CallSid" value="test_audio_pipeline" />
      <Parameter name="groupId" value="1" />
      <Parameter name="strategy" value="${strategy}" />
      <Parameter name="amplification" value="${amplification}" />
      <Parameter name="testDirect" value="${testDirect}" />
    </Stream>
  </Connect>
</Response>`;

  res.send(testTwiML);
});

// Audio processing strategy test endpoint
app.get('/test-audio-strategies', (req, res) => {
  const { AudioProcessor } = require('./voice/streaming/audioProcessor');

  // Generate a test audio buffer (simulate Gemini output)
  const testBuffer = Buffer.alloc(3200); // 100ms of 16kHz audio
  for (let i = 0; i < 1600; i++) {
    const sample = Math.sin(2 * Math.PI * 440 * i / 16000) * 8000; // 440Hz tone
    testBuffer.writeInt16LE(Math.floor(sample), i * 2);
  }

  const strategies = ['simple', 'interpolated', 'filtered'];
  const results = {};

  strategies.forEach(strategy => {
    const processed = AudioProcessor.processAudioForTwilio(testBuffer, { strategy });
    const analysis = AudioProcessor.analyzeAudio(processed, 8000);
    results[strategy] = {
      inputSize: testBuffer.length,
      outputSize: processed.length,
      analysis
    };
  });

  res.json({
    message: 'Audio processing strategy comparison',
    inputAudio: AudioProcessor.analyzeAudio(testBuffer, 16000),
    strategies: results
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
  twilioWss.close(() => {
    logger.log('Twilio WebSocket server closed');
  });
  httpServer.close(() => {
    logger.log('HTTP server closed');
    process.exit(0);
  });
});

export { httpServer };
