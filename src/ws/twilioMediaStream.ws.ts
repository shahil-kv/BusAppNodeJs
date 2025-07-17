// Enhanced WebSocket setup for Twilio Media Streams
import { WebSocket, WebSocketServer, Data } from 'ws';
import { logger } from '../utils/logger';
import { GeminiLiveService } from '../ai/geminiLive.service';
import { GeminiLiveBridge } from '../voice/streaming/geminiLiveBridge';
import { AudioProcessor } from '../voice/streaming/audioProcessor';
import { PrismaClient } from '@prisma/client';
import { createSystemPrompt } from '../services/prompt.service';

const prisma = new PrismaClient();

export const setupTwilioWebSocket = (httpServer: any) => {
    // Create WebSocket server for Twilio Media Streams
    const wss = new WebSocketServer({
        server: httpServer,
        path: '/ws/twilio-audio',
    });

    // Initialize Gemini Live Service
    const geminiService = new GeminiLiveService(process.env.GEMINI_API_KEY || '');

    // Store active bridges for each connection
    const activeBridges = new Map<string, GeminiLiveBridge>();

    wss.on('connection', (ws: WebSocket, req: any) => {
        const connectionId = Date.now().toString();
        logger.log(`[Connection ${connectionId}] NEW TWILIO WEBSOCKET CONNECTION from: ${req.connection.remoteAddress}`);

        let streamSid: string | null = null;
        let callSid: string | null = null;
        let groupId: string | null = null;
        let bridge: GeminiLiveBridge | null = null;
        let sessionStartTimestamp = 0;
        let sessionReadyTimestamp = 0;

        ws.on('message', async (message: Data) => {
            try {
                const data = JSON.parse(message.toString());
                switch (data.event) {
                    case 'connected':
                        ws.send(JSON.stringify({ event: 'connected', message: 'Connection acknowledged' }));
                        logger.log(`[Connection ${connectionId}] Twilio Media Stream connected`);
                        break;
                    case 'start': {
                        sessionStartTimestamp = Date.now();
                        streamSid = data.streamSid;
                        callSid = data.start?.callSid;
                        if (data.start?.customParameters) {
                            callSid = data.start.customParameters.CallSid || callSid;
                            groupId = data.start.customParameters.groupId;
                        }
                        // Create Gemini Live Bridge for this connection (pass ws as third argument)
                        bridge = new GeminiLiveBridge(geminiService, callSid, ws);
                        activeBridges.set(connectionId, bridge);
                        if (streamSid) bridge.setStreamSid(streamSid);
                        // Generate system prompt based on groupId
                        const systemPrompt = await getSystemPromptForGroup(groupId);
                        if (!systemPrompt) {
                            logger.error(`[Connection ${connectionId}] No workflow found for groupId: ${groupId}`);
                            ws.send(JSON.stringify({ event: 'error', message: 'No workflow found for this group.' }));
                            return;
                        }
                        // Start Gemini session ASAP, before acknowledging Twilio
                        await bridge.startCall(systemPrompt);
                        sessionReadyTimestamp = Date.now();
                        logger.log(`[Connection ${connectionId}] Gemini session startup time: ${sessionReadyTimestamp - sessionStartTimestamp}ms`);
                        ws.send(JSON.stringify({ event: 'start', message: 'Start acknowledged' }));
                        if (ws.readyState === WebSocket.OPEN && streamSid) {
                            try {
                                const pcmSilence = Buffer.alloc(16000 * 2 * 0.1, 0);
                                const mulawSilence = await AudioProcessor.processAudioForTwilio(pcmSilence);
                                ws.send(JSON.stringify({
                                    event: 'media',
                                    streamSid: streamSid,
                                    media: { payload: mulawSilence.toString('base64') },
                                    track: 'outbound',
                                    chunk: 1,
                                    timestamp: Date.now()
                                }));
                            } catch (err) {
                                logger.error(`[Connection ${connectionId}] Error sending initial silence:`, err);
                            }
                        }
                        setTimeout(async () => {
                            try {
                                await bridge.sendTestTone();
                            } catch (error) {
                                logger.error(`[Connection ${connectionId}] Error sending test tone:`, error);
                            }
                        }, 2000);
                        break;
                    }
                    case 'media':
                        if (data.media?.payload && bridge) {
                            try {
                                const audioBuffer = Buffer.from(data.media.payload, 'base64');
                                await bridge.handleTwilioAudio(audioBuffer);
                            } catch (error) {
                                logger.error(`[Connection ${connectionId}] Error processing audio:`, error);
                            }
                        } else if (!bridge) {
                            logger.error(`[Connection ${connectionId}] Media received but no bridge available`);
                        }
                        break;
                    case 'stop':
                        ws.send(JSON.stringify({ event: 'stop', message: 'Stop acknowledged' }));
                        if (bridge) {
                            try {
                                await bridge.endCall();
                            } catch (error) {
                                logger.error(`[Connection ${connectionId}] Error ending call:`, error);
                            }
                            activeBridges.delete(connectionId);
                        }
                        logger.log(`[Connection ${connectionId}] Media Stream stopped for streamSid: ${streamSid}`);
                        break;
                    default:
                        logger.error(`[Connection ${connectionId}] Unknown event: ${data.event}`);
                }
            } catch (error) {
                logger.error(`[Connection ${connectionId}] Error processing WebSocket message:`, error);
            }
        });

        ws.on('close', async (code: number, reason: string) => {
            logger.log(`[Connection ${connectionId}] Twilio WebSocket connection closed: code=${code}, reason=${reason}, streamSid=${streamSid}`);
            if (bridge) {
                try {
                    await bridge.endCall();
                } catch (error) {
                    logger.error(`[Connection ${connectionId}] Error ending call on close:`, error);
                }
                activeBridges.delete(connectionId);
            }
        });

        ws.on('error', (error: Error) => {
            logger.error(`[Connection ${connectionId}] Twilio WebSocket error:`, error);
        });

        // Send keep-alive pings
        const keepAliveInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
            } else {
                clearInterval(keepAliveInterval);
            }
        }, 30000);
        ws.on('close', () => clearInterval(keepAliveInterval));
    });

    // Handle WebSocket server errors
    wss.on('error', (error: Error) => {
        logger.error('WebSocket server error:', error);
    });

    // Add methods to the returned WebSocket server for external access
    (wss as any).getBridgeStats = () => {
        const stats = {
            totalConnections: activeBridges.size,
            bridges: Array.from(activeBridges.entries()).map(([id, bridge]) => ({
                connectionId: id,
                status: bridge.getStatus()
            }))
        };
        return stats;
    };

    (wss as any).sendTestTone = async (connectionId: string) => {
        const bridge = activeBridges.get(connectionId);
        if (bridge) {
            await bridge.sendTestTone();
            return true;
        }
        return false;
    };

    return wss;
};

async function getSystemPromptForGroup(groupId: string | null) {
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


