// Gemini Live Service for streaming Malayalam conversational AI
// Handles session management, audio streaming, and workflow context integration
// TODO: Install and configure @google/genai or relevant Gemini Live SDK

import { GoogleGenAI, Modality } from '@google/genai';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class GeminiLiveService {
    private ai: GoogleGenAI;
    private sessionCount = 0;
    private audioChunkCount = 0; // Added for new_code

    constructor(apiKey: string) {
        logger.log('[GeminiLiveService] Initializing GoogleGenAI with API key length:', apiKey ? apiKey.length : 0);
        this.ai = new GoogleGenAI({ apiKey });
        logger.log('[GeminiLiveService] GoogleGenAI initialized successfully');
    }

    async startSession(systemPrompt: string, onAudioResponse: (audioChunk: Buffer) => void) {
        this.sessionCount++;
        const sessionId = this.sessionCount;
        logger.log(`[GeminiLiveService] [Session ${sessionId}] Starting Gemini Live session`);
        logger.log(`[GeminiLiveService] [Session ${sessionId}] System prompt length: ${systemPrompt.length}`);
        logger.log(`[GeminiLiveService] [Session ${sessionId}] System prompt preview: ${systemPrompt.substring(0, 100)}...`);

        const config = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemPrompt,
        };
        const model = 'gemini-2.5-flash-preview-native-audio-dialog';

        let retries = 0;
        const maxRetries = 3;
        let session = null;
        while (retries < maxRetries) {
            try {
                if (!this.ai) throw new Error('GoogleGenAI not initialized');
                if (!this.ai.live) throw new Error('Live API not available');
                session = await this.ai.live.connect({
                    model,
                    config,
                    callbacks: {
                        onmessage: (msg: any) => {
                            if (msg.data) {
                                try {
                                    const buffer = Buffer.from(msg.data, 'base64');
                                    onAudioResponse(buffer);
                                } catch (error) {
                                    logger.error(`[GeminiLiveService] [Session ${sessionId}] Error processing audio data:`, error);
                                }
                            } else {
                                logger.warn(`[GeminiLiveService] [Session ${sessionId}] [IN] No audio data in message:`, msg);
                            }
                        },
                        onerror: (error: any) => {
                            logger.error(`[GeminiLiveService] [Session ${sessionId}] Session error:`, error);
                        },
                        onclose: () => {
                            logger.log(`[GeminiLiveService] [Session ${sessionId}] Session closed`);
                        }
                    },
                });
                if (session) break;
            } catch (error) {
                retries++;
                logger.error(`[GeminiLiveService] [Session ${sessionId}] Session creation attempt ${retries} failed:`, error);
                if (retries >= maxRetries) throw error;
                await new Promise(res => setTimeout(res, 1000 * retries));
            }
        }
        if (!session) throw new Error('Session creation returned null');

        logger.log(`[GeminiLiveService] [Session ${sessionId}] Gemini Live session started successfully`);

        // Send initial text prompt to trigger AI to start speaking
        logger.log(`[GeminiLiveService] [Session ${sessionId}] Sending initial text prompt to start conversation...`);
        try {
            await session.sendRealtimeInput({
                text: "ഹലോ, ഞാൻ നിങ്ങളുമായി സംസാരിക്കാൻ തയ്യാറാണ്. എന്താണ് നിങ്ങൾക്ക് സഹായിക്കാൻ കഴിയുക?"
            });
            logger.log(`[GeminiLiveService] [Session ${sessionId}] Initial text prompt sent successfully`);
        } catch (promptError) {
            logger.error(`[GeminiLiveService] [Session ${sessionId}] Error sending initial prompt:`, promptError);
            // Don't throw error, session can still work without initial prompt
        }

        return session;
    }

    async sendAudioChunk(session: any, chunk: Buffer) {
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
            try {
                this.audioChunkCount++;
                const isSilence = chunk.every(byte => byte === 0 || Math.abs(byte) < 10);
                if (isSilence) {
                    logger.warn(`[GeminiLiveService] [OUT] Skipping silence chunk #${this.audioChunkCount}`);
                    return;
                }
                const audioData = {
                    data: chunk.toString('base64'),
                    mimeType: 'audio/pcm;rate=8000',
                };
                await session.sendRealtimeInput({ audio: audioData });
                if (this.audioChunkCount === 1) {
                    logger.log(`[GeminiLiveService] [OUT] Audio chunk sent successfully`);
                }
                break;
            } catch (error) {
                retries++;
                logger.error(`[GeminiLiveService] [OUT] Error sending audio chunk (attempt ${retries}):`, error);
                if (retries >= maxRetries) return;
                await new Promise(res => setTimeout(res, 1000 * retries));
            }
        }
    }

    updateSystemPrompt(session: any, newPrompt: string) {
        if (session && session.sendRealtimeInput) {
            session.sendRealtimeInput({ text: newPrompt });
            logger.log('[GeminiLiveService] System prompt updated dynamically');
        }
    }

    async endSession(session: any) {
        try {
            logger.log(`[GeminiLiveService] Ending Gemini Live session`);
            await session.close();
            logger.log(`[GeminiLiveService] Gemini Live session closed successfully`);
        } catch (error) {
            logger.error(`[GeminiLiveService] Error ending Gemini Live session:`, error);
            logger.error(`[GeminiLiveService] Error details:`, {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            // Don't throw error to prevent WebSocket disconnection
        }
    }

    async testConnection() {
        try {
            logger.log(`[GeminiLiveService] Testing Gemini Live connection...`);
            const testPrompt = "Say 'Hello, this is a test' in Malayalam";

            const session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-preview-native-audio-dialog',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: testPrompt,
                },
                callbacks: {
                    onmessage: (msg: any) => {
                        logger.log(`[GeminiLiveService] Test message received:`, msg);
                        if (msg.data) {
                            logger.log(`[GeminiLiveService] Test audio received (length: ${msg.data.length})`);
                        }
                    },
                    onerror: (error: any) => {
                        logger.error(`[GeminiLiveService] Test session error:`, error);
                    },
                    onclose: () => {
                        logger.log(`[GeminiLiveService] Test session closed`);
                    }
                },
            });

            // Send a test audio chunk (silence)
            const testAudio = Buffer.alloc(160, 0); // 160 bytes of silence
            await session.sendRealtimeInput({
                audio: {
                    data: testAudio.toString('base64'),
                    mimeType: 'audio/pcm;rate=16000',
                },
            });

            logger.log(`[GeminiLiveService] Test audio sent, waiting for response...`);

            // Wait a bit for response
            setTimeout(async () => {
                await session.close();
                logger.log(`[GeminiLiveService] Test completed`);
            }, 3000);

        } catch (error) {
            logger.error(`[GeminiLiveService] Test connection failed:`, error);
        }
    }
} 