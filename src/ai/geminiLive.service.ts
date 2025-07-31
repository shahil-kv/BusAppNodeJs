import { GoogleGenAI, Modality } from '@google/genai';
import { logger } from '../utils/logger';

// Define a structured set of callbacks for the service to use
export interface GeminiSessionCallbacks {
    onAudio: (audioChunk: Buffer) => void;
    onTurnComplete: () => void;
    onError: (error: Error) => void;
    onClose: () => void;
}

export class GeminiLiveService {
    private ai: GoogleGenAI;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async startSession(systemPrompt: string, callbacks: GeminiSessionCallbacks) {
        const sessionId = Date.now();
        logger.log(`[GeminiLiveService] [Session ${sessionId}] Starting new session.`);

        const config = {
            responseModalities: [Modality.AUDIO],
            systemInstruction: systemPrompt,
        };
        const model = 'gemini-2.5-flash-preview-native-audio-dialog';

        try {
            if (!this.ai || !this.ai.live) {
                throw new Error('GoogleGenAI Live API not available');
            }

            const session = await this.ai.live.connect({
                model,
                config,
                callbacks: {
                    onmessage: (msg: any) => {
                        if (msg.data) {
                            try {
                                const buffer = Buffer.from(msg.data, 'base64');
                                callbacks.onAudio(buffer);
                            } catch (error) {
                                logger.error(`[GeminiLiveService] [Session ${sessionId}] Error processing audio data:`, error);
                                callbacks.onError(error as Error);
                            }
                        } else if (msg.serverContent?.turnComplete) {
                            logger.log(`[GeminiLiveService] [Session ${sessionId}] Received turnComplete signal.`);
                            callbacks.onTurnComplete();
                        } else {
                            logger.warn(`[GeminiLiveService] [Session ${sessionId}] Unhandled message:`, JSON.stringify(msg));
                        }
                    },
                    onerror: (error: any) => {
                        logger.error(`[GeminiLiveService] [Session ${sessionId}] Session error:`, error);
                        callbacks.onError(error);
                    },
                    onclose: () => {
                        logger.log(`[GeminiLiveService] [Session ${sessionId}] Session closed.`);
                        callbacks.onClose();
                    }
                },
            });

            return session;

        } catch (error) {
            logger.error(`[GeminiLiveService] [Session ${sessionId}] Failed to start session:`, error);
            callbacks.onError(error as Error);
            return null;
        }
    }

    async sendAudioChunk(session: any, chunk: Buffer) {
        if (!session) return;
        try {
            const audioData = {
                data: chunk.toString('base64'),
                mimeType: 'audio/pcm;rate=16000',
            };
            await session.sendRealtimeInput({ audio: audioData });
        } catch (error) {
            logger.error(`[GeminiLiveService] Error sending audio chunk:`, error);
        }
    }

    async sendText(session: any, text: string) {
        if (!session) return;
        try {
            logger.log(`[GeminiLiveService] Sending text input: "${text}"`);
            await session.sendRealtimeInput({
                text,
                responseModality: [Modality.AUDIO],
            });
        } catch (error) {
            logger.error(`[GeminiLiveService] Error sending text input:`, error);
        }
    }

    async endSession(session: any) {
        if (!session) return;
        try {
            await session.close();
        } catch (error) {
            logger.error(`[GeminiLiveService] Error ending session:`, error);
        }
    }
}