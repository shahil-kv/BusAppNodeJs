// Voice Controller for Twilio ConversationRelay - Simplified like Python example
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Handle voice interaction with Twilio ConversationRelay
export const voiceHandler = async (req: Request, res: Response) => {
  logger.log('Voice handler called');

  try {
    // Check for required environment variables
    const ngrokUrl = process.env.NGROK_BASE_URL;
    if (!ngrokUrl) {
      logger.error('NGROK_BASE_URL environment variable not set');
      return res.status(500).send('Configuration error: NGROK_BASE_URL not set');
    }

    // English human-like welcome greeting
    const welcomeGreeting = 'Hello! I am your English-speaking assistant. How can I help you today?';
    const webSocketUrl = `wss://${ngrokUrl.replace('https://', '').replace('http://', '')}/ws`;

    // Use Google TTS English voice
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay url="${webSocketUrl}" welcomeGreeting="${welcomeGreeting}" ttsProvider="Google" voice="en-US-Wavenet-F" />
    </Connect>
</Response>`;

    logger.log('TwiML response created with WebSocket URL:', webSocketUrl);
    res.type('text/xml').send(twiml);

  } catch (error) {
    logger.error('Error in voice handler:', error);
    res.status(500).send('Internal server error');
  }
};

// Handle WebSocket connections for ConversationRelay (for backward compatibility)
export const handleWebSocket = async (ws: any) => {
  logger.log('WebSocket handler called (legacy function)');

  // This function is kept for backward compatibility
  // The actual WebSocket handling is now done by TwilioWebSocketHandler
  ws.on('message', () => {
    logger.log('Legacy WebSocket message received');
  });

  ws.on('close', () => {
    logger.log('Legacy WebSocket connection closed');
  });

  ws.on('error', (error: Error) => {
    logger.error('Legacy WebSocket error:', error);
  });
};
