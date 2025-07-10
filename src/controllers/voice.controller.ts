// Voice Controller for Twilio ConversationRelay - Malayalam Focus with Google STT
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { getWorkflowStepsByGroupId } from '../services/workflow.service';

// Handle voice interaction with Twilio ConversationRelay
export const voiceHandler = async (req: Request, res: Response) => {
  logger.log('Malayalam voice handler called');

  try {
    const ngrokUrl = env.NGROK_BASE_URL;
    if (!ngrokUrl) {
      logger.error('NGROK_BASE_URL environment variable not set');
      return res.status(500).send('Configuration error: NGROK_BASE_URL not set');
    }

    // 1. Get callSid from Twilio request
    const callSid = req.body.CallSid || req.query.CallSid;
    if (!callSid) {
      logger.error('Missing CallSid');
      return res.status(400).send('Missing CallSid');
    }

    // 2. Find call_history by callSid, include call_session
    const prisma = new PrismaClient();
    const callHistory = await prisma.call_history.findFirst({
      where: { call_sid: callSid },
      include: { call_session: true },
    });
    if (!callHistory || !callHistory.call_session) {
      logger.error('Call session not found for CallSid:', callSid);
      return res.status(404).send('Call session not found');
    }

    // 3. Get groupId from call_session
    const groupId = callHistory.call_session.group_id;
    if (!groupId) {
      logger.error('Group not found for this call');
      return res.status(404).send('Group not found for this call');
    }

    // 4. Fetch workflow steps for this group
    const steps = await getWorkflowStepsByGroupId(groupId);

    // 5. Use the first step's Malayalam question as the greeting if available
    const welcomeGreeting = steps[0]?.malayalam || steps[0]?.question || 'Default greeting';

    const webSocketUrl = `wss://${ngrokUrl.replace('https://', '').replace('http://', '')}/ws`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Connect>\n        <ConversationRelay \n            url="${webSocketUrl}" \n            welcomeGreeting="${welcomeGreeting}" \n            ttsProvider="Google"\n            voice="ml-IN-Wavenet-A"\n            sttProvider="Google"\n            language="ml-IN"\n            speechTimeout="auto"\n        />\n    </Connect>\n</Response>`;

    logger.log('Malayalam TwiML response created with Google STT and WebSocket URL:', webSocketUrl);
    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error('Error in Malayalam voice handler:', error);
    res.status(500).send('Internal server error');
  }
};

