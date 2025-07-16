// Enhanced WebSocket setup for Twilio Media Streams
import { WebSocket, WebSocketServer } from 'ws';
import { logger } from '../utils/logger';
import { GeminiLiveService } from '../ai/geminiLive.service';
import { GeminiLiveBridge } from '../voice/streaming/geminiLiveBridge';

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

    logger.log('WebSocket server created for Twilio Media Streams on path: /ws/twilio-audio');

    wss.on('connection', (ws: WebSocket, req: any) => {
        const connectionId = Date.now().toString();
        logger.log(`[Connection ${connectionId}] === NEW TWILIO WEBSOCKET CONNECTION ===`);
        logger.log(`[Connection ${connectionId}] Connection from:`, req.connection.remoteAddress);

        let streamSid: string | null = null;
        let callSid: string | null = null;
        let groupId: string | null = null;
        let bridge: GeminiLiveBridge | null = null;
        let isConnected = false;

        ws.on('message', async (message: WebSocket.Data) => {
            try {
                const data = JSON.parse(message.toString());
                // Only log important events
                if (['connected', 'start', 'stop', 'error'].includes(data.event)) {
                    logger.log(`[Connection ${connectionId}] Received event: ${data.event}`);
                }

                switch (data.event) {
                    case 'connected':
                        logger.log(`[Connection ${connectionId}] Twilio Media Stream connected`);
                        isConnected = true;

                        // Send acknowledgment immediately
                        ws.send(JSON.stringify({
                            event: 'connected',
                            message: 'Connection acknowledged'
                        }));
                        break;

                    case 'start': {
                        streamSid = data.streamSid;
                        callSid = data.start?.callSid;

                        // Extract parameters from custom parameters
                        if (data.start?.customParameters) {
                            callSid = data.start.customParameters.CallSid || callSid;
                            groupId = data.start.customParameters.groupId;
                        }

                        logger.log(`[Connection ${connectionId}] Media Stream started:`, {
                            streamSid,
                            callSid,
                            groupId,
                            mediaFormat: data.start?.mediaFormat,
                        });

                        // Send start acknowledgment immediately
                        ws.send(JSON.stringify({
                            event: 'start',
                            message: 'Start acknowledged'
                        }));

                        // Send a hardcoded beep immediately to Twilio
                        if (ws.readyState === WebSocket.OPEN && streamSid) {
                            const beep = generateMulawBeep();
                            ws.send(JSON.stringify({
                                event: 'media',
                                streamSid: streamSid,
                                media: { payload: beep.toString('base64') },
                                track: 'outbound',
                                chunk: 1,
                                timestamp: Date.now()
                            }));
                            logger.log(`[Connection ${connectionId}] ✅ Sent hardcoded beep to Twilio after start event`);
                        }

                        // Create Gemini Live Bridge for this connection
                        bridge = new GeminiLiveBridge(geminiService, callSid);
                        activeBridges.set(connectionId, bridge);

                        // IMPORTANT: Set the streamSid in the bridge
                        if (streamSid) {
                            bridge.setStreamSid(streamSid);
                        }

                        // Generate system prompt based on groupId
                        const systemPrompt = generateSystemPrompt(groupId);
                        logger.log(`[Connection ${connectionId}] System prompt: ${systemPrompt.substring(0, 100)}...`);

                        // Start the bridge
                        try {
                            await bridge.startCall(systemPrompt, ws);
                            logger.log(`[Connection ${connectionId}] Bridge started successfully`);

                            // Send a test tone after 2 seconds to verify audio works
                            setTimeout(async () => {
                                try {
                                    logger.log(`[Connection ${connectionId}] Sending test tone to verify audio...`);
                                    await bridge.sendTestTone();
                                    logger.log(`[Connection ${connectionId}] Test tone sent successfully`);
                                } catch (error) {
                                    logger.error(`[Connection ${connectionId}] Error sending test tone:`, error);
                                }
                            }, 2000);

                        } catch (error) {
                            logger.error(`[Connection ${connectionId}] Error starting bridge:`, error);
                            ws.send(JSON.stringify({
                                event: 'error',
                                message: 'Failed to start session'
                            }));
                        }
                        break;
                    }

                    case 'media':
                        // Handle incoming audio data
                        if (data.media?.payload && bridge) {
                            try {
                                const audioBuffer = Buffer.from(data.media.payload, 'base64');

                                // Only log first few chunks to avoid spam
                                if (bridge.getStatus().audioChunksReceived < 5) {
                                    logger.log(`[Connection ${connectionId}] Processing audio chunk (length: ${audioBuffer.length})`);
                                }

                                // Send audio to Gemini Live Bridge
                                await bridge.handleTwilioAudio(audioBuffer);

                            } catch (error) {
                                logger.error(`[Connection ${connectionId}] Error processing audio:`, error);
                            }
                        } else if (!bridge) {
                            logger.warn(`[Connection ${connectionId}] Media received but no bridge available`);
                        }
                        break;

                    case 'stop':
                        logger.log(`[Connection ${connectionId}] Media Stream stopped for streamSid:`, streamSid);

                        // Send stop acknowledgment immediately
                        ws.send(JSON.stringify({
                            event: 'stop',
                            message: 'Stop acknowledged'
                        }));

                        // End the bridge
                        if (bridge) {
                            await bridge.endCall();
                            activeBridges.delete(connectionId);
                        }
                        break;

                    default:
                        logger.log(`[Connection ${connectionId}] Unknown event:`, data.event);
                }
            } catch (error) {
                logger.error(`[Connection ${connectionId}] Error processing WebSocket message:`, error);
            }
        });

        ws.on('close', async (code: number, reason: string) => {
            logger.log(`[Connection ${connectionId}] Twilio WebSocket connection closed:`, { code, reason, streamSid });

            // Clean up bridge
            if (bridge) {
                await bridge.endCall();
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
        }, 30000); // 30 seconds

        // Clean up interval on connection close
        ws.on('close', () => {
            clearInterval(keepAliveInterval);
        });
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

// Function to generate system prompt based on groupId
function generateSystemPrompt(groupId: string | null): string {
    const basePrompt = `You are a helpful Malayalam AI assistant. You should:
1. Always respond in Malayalam
2. Be polite and professional
3. Provide accurate and helpful information
4. Keep responses concise but informative
5. Ask clarifying questions when needed`;

    // Add group-specific context
    let groupContext = '';
    switch (groupId) {
        case '1':
            groupContext = ' This is a customer service call for a bus transportation company. Help customers with booking, schedules, and general inquiries.';
            break;
        case '2':
            groupContext = ' This is a technical support call. Help users with technical issues and troubleshooting.';
            break;
        default:
            groupContext = ' This is a general inquiry call. Provide helpful assistance to the caller.';
    }

    return basePrompt + groupContext;
}

// Add μ-law beep generator
function generateMulawBeep(durationSeconds = 1, sampleRate = 8000, frequency = 1000) {
    const numSamples = sampleRate * durationSeconds;
    const samples = new Int16Array(numSamples);
    const samplesPerCycle = sampleRate / frequency;
    for (let i = 0; i < numSamples; i++) {
        const cyclePosition = (i % samplesPerCycle) / samplesPerCycle;
        const value = cyclePosition < 0.5 ? 16384 : -16384;
        samples[i] = Math.round(value);
    }
    // μ-law encoding
    const mulawSamples = new Uint8Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        const sample = samples[i];
        let sign = 0;
        let exponent = 0;
        let mantissa = 0;
        const absSample = Math.abs(sample);
        if (sample < 0) sign = 0x80;
        if (absSample < 256) { exponent = 0; mantissa = absSample >> 4; }
        else if (absSample < 512) { exponent = 1; mantissa = absSample >> 5; }
        else if (absSample < 1024) { exponent = 2; mantissa = absSample >> 6; }
        else if (absSample < 2048) { exponent = 3; mantissa = absSample >> 7; }
        else if (absSample < 4096) { exponent = 4; mantissa = absSample >> 8; }
        else if (absSample < 8192) { exponent = 5; mantissa = absSample >> 9; }
        else if (absSample < 16384) { exponent = 6; mantissa = absSample >> 10; }
        else { exponent = 7; mantissa = absSample >> 11; }
        mulawSamples[i] = sign | (exponent << 4) | mantissa;
    }
    return Buffer.from(mulawSamples);
}
