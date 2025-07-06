// Twilio WebSocket Handler for ConversationRelay - Simplified like Python example
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSystemPrompt } from '../services/ai-agent.service';
import { getWorkflowSteps } from '../services/workflow.service';

// Check for required environment variables
if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable not set');
}

// Initialize Gemini
const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: `You are a helpful and friendly voice assistant. This conversation is happening over a phone call, so your responses will be spoken aloud. 
Please adhere to the following rules:
1. Provide clear, concise, and direct answers.
2. Spell out all numbers (e.g., say 'one thousand two hundred' instead of 1200).
3. Do not use any special characters like asterisks, bullet points, or emojis.
4. Keep the conversation natural and engaging.`
});

interface TwilioMessage {
    type: string;
    callSid?: string;
    voicePrompt?: string;
}

// Store active chat sessions like Python example
const sessions: { [key: string]: any } = {};

export class TwilioWebSocketHandler {
    private wss: WebSocket.Server;

    constructor(server: any) {
        this.wss = new WebSocket.Server({ server, path: '/ws' });
        this.setupWebSocket();
        logger.success('WebSocket server setup completed');
    }

    private setupWebSocket() {
        this.wss.on('connection', (ws: WebSocket & { callSid?: string }, req: any) => {
            logger.log('New WebSocket connection from:', req.socket.remoteAddress);

            ws.on('message', async (data: Buffer) => {
                try {
                    const message: TwilioMessage = JSON.parse(data.toString());
                    // Store callSid on ws after setup
                    if (message.type === 'setup' && message.callSid) {
                        ws.callSid = message.callSid;
                    }
                    // If callSid is missing in message, use ws.callSid
                    if (!message.callSid && ws.callSid) {
                        message.callSid = ws.callSid;
                    }
                    await this.handleMessage(ws, message);
                } catch (error) {
                    logger.error('Error handling WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                logger.log('WebSocket connection closed');
            });

            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
            });
        });
    }

    private async handleMessage(ws: WebSocket, message: TwilioMessage) {
        logger.log('Received message type:', message.type);

        switch (message.type) {
            case 'setup':
                await this.handleSetup(ws, message);
                break;
            case 'prompt':
                await this.handlePrompt(ws, message);
                break;
            case 'interrupt':
                logger.log('Handling interruption for call:', message.callSid);
                break;
            default:
                logger.warn('Unknown message type:', message.type);
        }
    }

    private async handleSetup(ws: WebSocket, message: TwilioMessage) {
        const callSid = message.callSid;
        if (!callSid) {
            logger.error('No callSid in setup message');
            return;
        }

        logger.log('Setup for call:', callSid);

        // Fetch workflow for this call (for now, use demo workflow)
        const workflow = await getWorkflowSteps(null); // Pass groupId if available
        // Generate a rich Malayalam system prompt for this call
        const systemPrompt = createSystemPrompt(workflow, { id: callSid }, null);

        // Start a new chat session for this call with the Malayalam system prompt
        sessions[callSid] = gemini.getGenerativeModel({
            model: 'gemini-2.0-flash-exp',
            systemInstruction: systemPrompt
        }).startChat({
            history: [],
            generationConfig: {
                temperature: 0.3,
                topK: 1,
                topP: 0.9,
                maxOutputTokens: 1024,
                candidateCount: 1,
            },
        });

        // Send setup confirmation
        ws.send(JSON.stringify({ type: 'setup', status: 'ready' }));
        logger.log('Setup completed for call:', callSid);
    }

    private async handlePrompt(ws: WebSocket, message: TwilioMessage) {
        const voicePrompt = message.voicePrompt || '';
        const callSid = message.callSid;

        if (!callSid || !sessions[callSid]) {
            logger.error('No session found for call:', callSid);
            return;
        }

        logger.log('Processing prompt:', voicePrompt);

        try {
            const chatSession = sessions[callSid];
            const response = await chatSession.sendMessage(voicePrompt);
            const responseText = response.response.text();

            logger.log('Gemini response:', responseText);

            // Send the complete response back to Twilio like Python example
            await ws.send(JSON.stringify({
                type: 'text',
                token: responseText,
                last: true  // Indicate this is the full and final message
            }));

            logger.log('Response sent to Twilio');

        } catch (error) {
            logger.error('Error processing prompt:', error);

            // Send error response
            await ws.send(JSON.stringify({
                type: 'text',
                token: 'Sorry, an error occurred. Please try again.',
                last: true
            }));
        }
    }

    public cleanup() {
        this.wss.close();
        logger.log('WebSocket server closed');
    }
} 