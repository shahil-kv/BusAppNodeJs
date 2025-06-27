import { Server as HTTPServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { createClient } from '@deepgram/sdk';
import twilio from 'twilio';
import { analyzeUserResponse } from '../services/ai-agent.service';
import { generateSpeech, getOrCreateAudioUrl } from '../services/speech.service';
import { uploadAudioToSupabase } from '../services/audioUpload.service';

// Initialize Deepgram streaming client
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export function setupTwilioAudioWebSocket(server: HTTPServer) {
    // Attach a WebSocket server to the existing HTTP server
    const wss = new WebSocketServer({ server, path: '/ws/twilio-audio' });

    wss.on('connection', (ws, req) => {
        console.log('[TwilioAudioWS] New connection from', req.socket.remoteAddress);
        let dgConnection: any = null;
        let isDeepgramReady = false;
        let callSid: string | null = null;
        let useAgent = false;
        let agentContext: any = {};

        ws.on('message', async (data) => {
            try {
                // Twilio sends JSON messages
                const msg = JSON.parse(data.toString());
                if (msg.event === 'start') {
                    callSid = msg.start.callSid;
                    // Optionally, check for useAgent flag in the start payload or query
                    useAgent = msg.start.customParameters?.useAgent === 'true' || req.url?.includes('useAgent=true');
                    // Optionally, store context for the agent (sessionId, etc.)
                    agentContext = msg.start.customParameters || {};
                    // Start Deepgram streaming
                    dgConnection = deepgram.listen.live({
                        model: 'nova-2', // Malayalam supported
                        language: 'ml',
                        interim_results: true,
                        punctuate: true,
                        encoding: 'mulaw',
                        sample_rate: 8000,
                    });
                    isDeepgramReady = true;
                    dgConnection.on('transcriptReceived', async (transcription: any) => {
                        const transcript = transcription.channel.alternatives[0]?.transcript;
                        if (transcript && transcript.length > 0) {
                            console.log('[Deepgram Transcript]', transcript);
                            if (useAgent && callSid) {
                                try {
                                    // 1. Call agent logic
                                    const agentResponse = await analyzeUserResponse({
                                        ...agentContext,
                                        userResponse: transcript,
                                    });
                                    // 2. Generate TTS audio
                                    const ttsPath = await generateSpeech(agentResponse.documentAnswer || agentResponse.reasoning || '');
                                    // 3. Upload audio to Supabase (or your storage)
                                    const audioUrl = await getOrCreateAudioUrl(agentResponse.documentAnswer || agentResponse.reasoning || '', ttsPath);
                                    // 4. Play audio in the call using Twilio REST API
                                    await twilioClient.calls(callSid).update({
                                        twiml: `<Response><Play>${audioUrl}</Play></Response>`
                                    });
                                    console.log('[TwilioAudioWS] Played agent response in call:', audioUrl);
                                } catch (err) {
                                    console.error('[TwilioAudioWS] Error in agent response playback:', err);
                                }
                            }
                        }
                    });
                    dgConnection.on('error', (err: any) => {
                        console.error('[Deepgram Error]', err);
                    });
                } else if (msg.event === 'media' && isDeepgramReady && dgConnection) {
                    // Forward audio payload to Deepgram
                    const audio = Buffer.from(msg.media.payload, 'base64');
                    dgConnection.send(audio);
                } else if (msg.event === 'stop') {
                    if (dgConnection) {
                        dgConnection.finish();
                        dgConnection = null;
                        isDeepgramReady = false;
                    }
                }
            } catch (err) {
                console.error('[TwilioAudioWS] Error handling message:', err);
            }
        });

        ws.on('close', () => {
            if (dgConnection) {
                dgConnection.finish();
            }
            console.log('[TwilioAudioWS] Connection closed');
        });

        ws.on('error', (err) => {
            console.error('[TwilioAudioWS] WebSocket error:', err);
        });
    });

    wss.on('error', (err) => {
        console.error('[TwilioAudioWS] Server error:', err);
    });

    console.log('[TwilioAudioWS] WebSocket server listening on /ws/twilio-audio');
} 