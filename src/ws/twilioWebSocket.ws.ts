// Twilio WebSocket Handler for ConversationRelay - Malayalam Focus
import WebSocket from 'ws';
import { logger } from '../utils/logger';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createSystemPrompt } from '../services/ai-agent.service';
import { getWorkflowSteps } from '../services/workflow.service';
import { env } from '../config/env';

// Check for required environment variables
if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable not set');
}

// Initialize Gemini with Malayalam focus
const gemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
const model = gemini.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: `നിങ്ങൾ ഒരു സഹായകരവും സൗഹൃദവുമായ മലയാളം സംസാരിക്കുന്ന AI അസിസ്റ്റന്റ് ആണ്. ഈ സംഭാഷണം ഫോൺ കോളിലൂടെ നടക്കുന്നതിനാൽ, നിങ്ങളുടെ ഉത്തരങ്ങൾ ശബ്ദത്തിൽ പറയപ്പെടും.

ദയവായി ഈ നിയമങ്ങൾ പാലിക്കുക:
1. വ്യക്തവും ചുരുക്കവും നേരിട്ടുള്ള ഉത്തരങ്ങൾ നൽകുക
2. എല്ലാ സംഖ്യകളും വാക്കുകളിൽ പറയുക (ഉദാ: 1200-ന് പകരം 'ആയിരത്തി ഇരുനൂറ്' പറയുക)
3. ആസ്റ്ററിസ്ക്, ബുള്ളറ്റ് പോയിന്റ്, ഇമോജി എന്നിവ ഉപയോഗിക്കരുത്
4. സംഭാഷണം സ്വാഭാവികവും ആകർഷകവുമായി നിലനിർത്തുക
5. എല്ലാ ഉത്തരങ്ങളും മലയാളത്തിൽ നൽകുക`
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
        logger.success('Malayalam WebSocket server setup completed');
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

        logger.log('Malayalam setup for call:', callSid);

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
        logger.log('Malayalam setup completed for call:', callSid);
    }

    private async handlePrompt(ws: WebSocket, message: TwilioMessage) {
        const voicePrompt = message.voicePrompt || '';
        const callSid = message.callSid;

        if (!sessions[callSid]) {
            logger.error('No session found for call:', callSid);
            return;
        }

        logger.log('Processing Malayalam prompt:', voicePrompt);

        try {
            const chatSession = sessions[callSid];
            const response = await chatSession.sendMessage(voicePrompt);
            const responseText = response.response.text();

            logger.log('Gemini Malayalam response:', responseText);

            // Send the complete response back to Twilio like Python example
            await ws.send(JSON.stringify({
                type: 'text',
                token: responseText,
                last: true  // Indicate this is the full and final message
            }));

            logger.log('Malayalam response sent to Twilio');

        } catch (error) {
            logger.error('Error processing Malayalam prompt:', error);

            // Send error response in Malayalam
            await ws.send(JSON.stringify({
                type: 'text',
                token: 'ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.',
                last: true
            }));
        }
    }

    public cleanup() {
        this.wss.close();
        logger.log('Malayalam WebSocket server closed');
    }
} 