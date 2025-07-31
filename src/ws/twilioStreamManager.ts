import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { GeminiLiveService } from '../ai/geminiLive.service';
import { GeminiLiveBridge } from '../voice/streaming/geminiLiveBridge';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { createSystemPrompt, createInitialPrompt } from '../services/prompt.service';
import { getWorkflowStepsByGroupId } from '../services/workflow.service';

const prisma = new PrismaClient();

export class TwilioStreamManager {
    private wss: WebSocketServer;
    private geminiService: GeminiLiveService;
    private activeBridges = new Map<string, GeminiLiveBridge>();

    constructor(server: Server) {
        this.wss = new WebSocketServer({
            server,
            path: '/ws/twilio-audio',
        });
        this.geminiService = new GeminiLiveService(process.env.GEMINI_API_KEY || '');
        this.initialize();
    }

    private initialize() {
        logger.log('WebSocket server created for Twilio Media Streams on path: /ws/twilio-audio');
        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', (error: Error) => {
            logger.error('WebSocket server error:', error);
        });
    }

    private handleConnection(ws: WebSocket, req: any) {
        const connectionId = Date.now().toString();
        logger.log(`[Connection ${connectionId}] === NEW TWILIO WEBSOCKET CONNECTION ===`);

        let bridge: GeminiLiveBridge | null = null;

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                switch (data.event) {
                    case 'start': {
                        const { streamSid, callSid, customParameters } = data.start;
                        const groupId = customParameters?.groupId;

                        bridge = new GeminiLiveBridge(this.geminiService, callSid, ws);
                        this.activeBridges.set(connectionId, bridge);
                        bridge.setStreamSid(streamSid);

                        const workflow = await getWorkflowStepsByGroupId(groupId);
                        if (!workflow) {
                            logger.error(`[Connection ${connectionId}] No workflow found for groupId:`, groupId);
                            ws.send(JSON.stringify({ event: 'error', message: 'No workflow found for this group.' }));
                            return;
                        }

                        const systemPrompt = createSystemPrompt(workflow);
                        const initialPrompt = createInitialPrompt(workflow);

                        await bridge.startCall(systemPrompt, workflow);
                        break;
                    }
                    case 'media':
                        if (data.media?.payload && bridge) {
                            const audioBuffer = Buffer.from(data.media.payload, 'base64');
                            await bridge.handleTwilioAudio(audioBuffer);
                        }
                        break;
                    case 'stop':
                        if (bridge) {
                            await bridge.endCall();
                            this.activeBridges.delete(connectionId);
                        }
                        break;
                }
            } catch (error) {
                logger.error(`[Connection ${connectionId}] Error processing WebSocket message:`, error);
            }
        });

        ws.on('close', async () => {
            logger.log(`[Connection ${connectionId}] Twilio WebSocket connection closed.`);
            if (bridge) {
                await bridge.endCall();
                this.activeBridges.delete(connectionId);
            }
        });

        ws.on('error', (error: Error) => {
            logger.error(`[Connection ${connectionId}] Twilio WebSocket error:`, error);
        });
    }

    public getBridgeStats() {
        return {
            totalConnections: this.activeBridges.size,
            bridges: Array.from(this.activeBridges.entries()).map(([id, bridge]) => ({
                connectionId: id,
                status: bridge.getStatus(),
            })),
        };
    }

    public close(callback?: () => void) {
        this.wss.close(callback);
    }
}
