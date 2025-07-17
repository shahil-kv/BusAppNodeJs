// Gemini Live Service for streaming Malayalam conversational AI
// Handles session management, audio streaming, and workflow context integration
// TODO: Install and configure @google/genai or relevant Gemini Live SDK

import { GoogleGenAI, Modality } from '@google/genai';

import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class GeminiLiveService {
    private ai: GoogleGenAI;


    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async startSession(systemPrompt: string, onAudioResponse: (audioChunk: Buffer) => void) {
        const sessionId = Date.now();

        const config = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemPrompt,
        };
        const model = 'gemini-2.5-flash-preview-native-audio-dialog';

        let retries = 0;
        const maxRetries = 3;
        let session = null;
        let firstAudioChunkReceived = false;
        let firstAudioChunkResolver: (() => void) | null = null;
        const firstAudioPromise = new Promise<void>((resolve) => {
            firstAudioChunkResolver = resolve;
        });
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
                                    if (!firstAudioChunkReceived) {
                                        firstAudioChunkReceived = true;
                                        if (firstAudioChunkResolver) firstAudioChunkResolver();
                                    }
                                    onAudioResponse(buffer);
                                } catch (error) {
                                    logger.error(`[GeminiLiveService] [Session ${sessionId}] Error processing audio data:`, error);
                                }
                            } else {
                                logger.warn(`[GeminiLiveService] [Session ${sessionId}] [IN] Message without audio data:`, JSON.stringify(msg));
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

        const extractFirstQuestion = (prompt: string): string => {
            const workflowSection = prompt.split('**Workflow ചോദ്യങ്ങൾ:**')[1];
            if (workflowSection) {
                const firstQuestionMatch = workflowSection.match(/\d+\.\s*(.*)/);
                if (firstQuestionMatch && firstQuestionMatch[1]) {
                    return firstQuestionMatch[1].trim();
                }
            }
            return "ഹലോ, ഞാൻ നിങ്ങളുമായി സംസാരിക്കാൻ തയ്യാറാണ്. എന്താണ് നിങ്ങൾക്ക് സഹായിക്കാൻ കഴിയുക?";
        };

        const initialPrompt = extractFirstQuestion(systemPrompt);
        logger.log(`[GeminiLiveService] [Session ${sessionId}] Attempting to send initial prompt: ${initialPrompt}`);

        try {
            await session.sendRealtimeInput({
                text: initialPrompt
            });
            logger.log(`[GeminiLiveService] [Session ${sessionId}] Initial prompt sent successfully.`);
            await firstAudioPromise; // Wait for the first audio chunk
            logger.log(`[GeminiLiveService] [Session ${sessionId}] First audio chunk received for initial prompt.`);
        } catch (promptError) {
            logger.error(`[GeminiLiveService] [Session ${sessionId}] Error sending initial prompt or waiting for audio:`, promptError);
            // Don't throw error, session can still work without initial prompt
        }

        return session;
    }

    async sendAudioChunk(session: any, chunk: Buffer) {
        let retries = 0;
        const maxRetries = 3;
        while (retries < maxRetries) {
            try {
                const audioData = {
                    data: chunk.toString('base64'),
                    mimeType: 'audio/pcm;rate=16000', // We are now sending 16kHz PCM
                };
                await session.sendRealtimeInput({ audio: audioData });

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
            await session.close();
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
            const testPrompt = "Say 'Hello, this is a test' in Malayalam";

            const session = await this.ai.live.connect({
                model: 'gemini-2.5-flash-preview-native-audio-dialog',
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: testPrompt,
                },
                callbacks: {
                    onmessage: (msg: any) => {
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


            // Wait a bit for response
            setTimeout(async () => {
                await session.close();
            }, 3000);

        } catch (error) {
            logger.error(`[GeminiLiveService] Test connection failed:`, error);
        }
    }
} 