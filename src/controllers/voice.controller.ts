// Voice Controller for Twilio ConversationRelay - Malayalam Focus with Google STT
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// Handle voice interaction with Twilio ConversationRelay
export const voiceHandler = async (req: Request, res: Response) => {
  logger.log('Malayalam voice handler called');

  try {
    // Check for required environment variables
    const ngrokUrl = env.NGROK_BASE_URL;
    if (!ngrokUrl) {
      logger.error('NGROK_BASE_URL environment variable not set');
      return res.status(500).send('Configuration error: NGROK_BASE_URL not set');
    }

    // Malayalam welcome greeting
    const welcomeGreeting =
      'നമസ്കാരം! എൻട്രി ആപ്പിന്റെ AI അസിസ്റ്റന്റ് ആണ് ഞാൻ. ഏത് കോഴ്സിനെപ്പറ്റിയാണ് നിങ്ങൾക്ക് അറിയേണ്ടത്?';
    const webSocketUrl = `wss://${ngrokUrl
      .replace('https://', '')
      .replace('http://', '')}/ws`;

    // Use Google TTS Malayalam voice and Google STT for Malayalam speech recognition
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <ConversationRelay 
            url="${webSocketUrl}" 
            welcomeGreeting="${welcomeGreeting}" 
              ttsProvider="Google"
    voice="ml-IN-Wavenet-A"
    sttProvider="Google"
    language="ml-IN"
    speechTimeout="auto"
        />
    </Connect>
</Response>`;

    logger.log(
      'Malayalam TwiML response created with Google STT and WebSocket URL:',
      webSocketUrl,
    );
    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Error in Malayalam voice handler:', error);
    res.status(500).send('Internal server error');
  }
};

