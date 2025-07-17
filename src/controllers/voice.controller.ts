// Voice Controller for Gemini Live Streaming - Malayalam Focus
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { PrismaClient } from '@prisma/client';
import { GeminiLiveService } from '../ai/geminiLive.service';

const prisma = new PrismaClient();

export const voiceHandler = async (req: Request, res: Response) => {
  try {

    // Construct proper WebSocket URL
    let mediaStreamUrl: string;

    if (env.MEDIA_STREAM_WSS_URL) {
      // Use the explicitly set WebSocket URL
      mediaStreamUrl = env.MEDIA_STREAM_WSS_URL;
    } else if (env.NGROK_BASE_URL) {
      // Convert ngrok HTTP URL to WebSocket URL
      // Remove trailing slash and ensure proper wss:// scheme
      const baseUrl = env.NGROK_BASE_URL.replace(/\/$/, '');
      mediaStreamUrl = baseUrl.replace('https://', 'wss://') + '/ws/twilio-audio';
    } else {
      logger.error('Neither MEDIA_STREAM_WSS_URL nor NGROK_BASE_URL environment variables are set');
      return res.status(500).send('Configuration error: WebSocket URL not configured');
    }


    // Validate WebSocket URL format
    if (!mediaStreamUrl.startsWith('wss://')) {
      logger.error('WebSocket URL must use wss:// scheme for Twilio Media Streams');
      return res.status(500).send('Configuration error: WebSocket URL must use wss:// scheme');
    }

    // Extract callSid and groupId for context
    const callSid = req.body.CallSid || req.query.CallSid;
    let groupId = req.body.groupId || req.query.groupId;


    // If groupId is not present, look it up from call_context using callSid
    if (!groupId && callSid) {
      try {
        const ctx = await prisma.call_context.findUnique({
          where: { call_sid: callSid },
        });
        if (ctx) {
          groupId = ctx.group_id;
        } else {
          logger.warn('No call_context found for callSid:', callSid);
        }
      } catch (dbError) {
        logger.error('Error looking up groupId from database:', dbError);
      }
    }

    // Check for pending AI response URL for this callSid
    let aiResponseUrl: string | null = null;
    if (callSid) {
      const ctx = await prisma.call_context.findUnique({ where: { call_sid: callSid } });
      if (ctx && ctx.ai_response_url) {
        aiResponseUrl = ctx.ai_response_url;
      }
    }

    let twiml: string;
    if (aiResponseUrl) {
      // Respond with <Play> and then <Connect><Stream> for next turn
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${aiResponseUrl}</Play>
  <Connect>
    <Stream url="${mediaStreamUrl}">
      ${callSid ? `<Parameter name="CallSid" value="${callSid}" />` : ''}
      ${groupId ? `<Parameter name="groupId" value="${groupId}" />` : ''}
    </Stream>
  </Connect>
</Response>`;
      // Clear the ai_response_url for the next turn
      await prisma.call_context.update({
        where: { call_sid: callSid },
        data: { ai_response_url: null },
      });
    } else {
      // Initial or no pending AI response: just <Connect><Stream>
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="hi-IN">Connecting you to our Malayalam AI assistant...</Say>
  <Connect>
    <Stream url="${mediaStreamUrl}">
      ${callSid ? `<Parameter name="CallSid" value="${callSid}" />` : ''}
      ${groupId ? `<Parameter name="groupId" value="${groupId}" />` : ''}
    </Stream>
  </Connect>
</Response>`;
    }


    // Set proper headers for TwiML response
    res.set({
      'Content-Type': 'text/xml',
      'Cache-Control': 'no-cache',
    });

    res.send(twiml);
  } catch (error) {
    logger.error('Error in voice handler:', error);
    res.status(500).send('Internal server error');
  }
};

// Additional helper function to validate WebSocket connection
export const validateWebSocketConnection = async (wsUrl: string): Promise<boolean> => {
  try {
    // Basic URL validation
    const url = new URL(wsUrl);
    if (url.protocol !== 'wss:') {
      logger.error('WebSocket URL must use wss:// protocol');
      return false;
    }

    // You can add additional validation here
    return true;
  } catch (error) {
    logger.error('Invalid WebSocket URL:', error);
    return false;
  }
};
