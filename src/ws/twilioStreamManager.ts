import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { GeminiLiveService } from '../ai/geminiLive.service';
import { GeminiLiveBridge } from '../voice/streaming/geminiLiveBridge';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { createSystemPrompt } from '../services/prompt.service';

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

                        const systemPrompt = await this.getSystemPromptForGroup(groupId);
                        if (!systemPrompt) {
                            logger.error(`[Connection ${connectionId}] Could not generate system prompt for groupId:`, groupId);
                            ws.send(JSON.stringify({ event: 'error', message: 'No workflow found for this group.' }));
                            return;
                        }
                        await bridge.startCall(systemPrompt);
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

    private async getSystemPromptForGroup(groupId: string | null) {
        if (!groupId) return null;
        logger.log(`[getSystemPromptForGroup] Fetching group for groupId: ${groupId}`);
        const group = await prisma.groups.findUnique({ where: { id: Number(groupId) } });
        if (!group || !group.workflow_id) {
            logger.error(`[getSystemPromptForGroup] No group or workflow_id found for groupId: ${groupId}`);
            return null;
        }
        const workflow = await prisma.workflows.findUnique({ where: { id: group.workflow_id } });
        if (!workflow) {
            logger.error(`[getSystemPromptForGroup] No workflow found for workflow_id: ${group.workflow_id}`);
            return null;
        }
        let steps;
        if (typeof workflow.steps === 'string') {
            steps = JSON.parse(workflow.steps);
        } else {
            steps = workflow.steps;
        }
        logger.log(`[getSystemPromptForGroup] Workflow steps from DB (pretty):\n${JSON.stringify(steps, null, 2)}`);
        const prompt = createSystemPrompt(steps);
        logger.log(`[getSystemPromptForGroup] Final system prompt (full):\n${prompt}`);
        return prompt;
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

    public async sendTestTone(connectionId: string) {
        const bridge = this.activeBridges.get(connectionId);
        if (bridge) {
            await bridge.sendTestTone();
            return true;
        }
        return false;
    }

    public close(callback?: () => void) {
        this.wss.close(callback);
    }
}
