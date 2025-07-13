import { GeminiLiveService } from '../../ai/geminiLive.service';
import { logger } from '../../utils/logger';
import { WebSocket } from 'ws';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AudioProcessor } from './audioProcessor';

export class GeminiLiveBridge {
    private geminiService: GeminiLiveService;
    private session: any = null;
    private ws: WebSocket | null = null;
    private audioChunkCount = 0;
    private responseChunkCount = 0;
    private sessionStartTime = 0;
    private lastAudioReceived = 0;
    private lastResponseSent = 0;
    private lastResponseTime = 0;
    private responseTimeout: NodeJS.Timeout | null = null;

    // Audio storage for testing
    private incomingAudioChunks: Buffer[] = [];
    private outgoingAudioChunks: Buffer[] = [];
    private sessionId = '';

    constructor(geminiService: GeminiLiveService) {
        this.geminiService = geminiService;
        this.sessionId = Date.now().toString();
        logger.log('[GeminiLiveBridge] Bridge initialized with session ID:', this.sessionId);

        // Create audio storage directory
        this.ensureAudioDirectory();
    }

    private ensureAudioDirectory() {
        const audioDir = join(process.cwd(), 'temp', 'audio');
        if (!existsSync(audioDir)) {
            mkdirSync(audioDir, { recursive: true });
        }
    }

    private saveAudioChunk(chunk: Buffer, type: 'incoming' | 'outgoing', chunkNumber: number) {
        try {
            const audioDir = join(process.cwd(), 'temp', 'audio');
            const filename = `${this.sessionId}_${type}_chunk_${chunkNumber}.raw`;
            const filepath = join(audioDir, filename);

            writeFileSync(filepath, new Uint8Array(chunk));

            // Log first few chunks for debugging
            if (chunkNumber <= 5) {
                logger.log(`[GeminiLiveBridge] Saved ${type} audio chunk #${chunkNumber} to ${filepath} (${chunk.length} bytes)`);
            }
        } catch (error) {
            logger.error(`[GeminiLiveBridge] Error saving ${type} audio chunk:`, error);
        }
    }

    private saveSessionSummary() {
        try {
            const audioDir = join(process.cwd(), 'temp', 'audio');
            const summaryFile = join(audioDir, `${this.sessionId}_summary.json`);

            const summary = {
                sessionId: this.sessionId,
                sessionDuration: Date.now() - this.sessionStartTime,
                incomingChunks: this.incomingAudioChunks.length,
                outgoingChunks: this.outgoingAudioChunks.length,
                totalIncomingBytes: this.incomingAudioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
                totalOutgoingBytes: this.outgoingAudioChunks.reduce((sum, chunk) => sum + chunk.length, 0),
                timestamp: new Date().toISOString()
            };

            writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
            logger.log(`[GeminiLiveBridge] Session summary saved to ${summaryFile}`);
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error saving session summary:', error);
        }
    }

    async startCall(systemPrompt: string, ws: WebSocket) {
        try {
            logger.log('[GeminiLiveBridge] Starting call with system prompt length:', systemPrompt.length);
            this.ws = ws;
            this.sessionStartTime = Date.now();
            this.audioChunkCount = 0;
            this.responseChunkCount = 0;

            // Start Gemini Live session with retry logic
            logger.log('[GeminiLiveBridge] Creating Gemini Live session...');

            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    this.session = await this.geminiService.startSession(systemPrompt, (audioChunk: Buffer) => {
                        this.handleGeminiResponse(audioChunk);
                    });

                    if (this.session) {
                        logger.log('[GeminiLiveBridge] Gemini Live session created successfully');
                        break;
                    } else {
                        throw new Error('Session creation returned null');
                    }
                } catch (sessionError) {
                    retryCount++;
                    logger.error(`[GeminiLiveBridge] Session creation attempt ${retryCount} failed:`, sessionError);

                    if (retryCount >= maxRetries) {
                        throw new Error(`Failed to create session after ${maxRetries} attempts`);
                    }

                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }

            logger.log('[GeminiLiveBridge] Call setup completed successfully');
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error starting call:', error);
            // Set session to null to prevent further processing
            this.session = null;

            // Send error message to client
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    event: 'error',
                    message: 'Failed to initialize AI session'
                }));
            }
        }
    }

    // This method will be called by the WebSocket handler with extracted audio data
    async handleTwilioAudio(audioData: Buffer) {
        try {
            this.audioChunkCount++;
            this.lastAudioReceived = Date.now();
            this.incomingAudioChunks.push(audioData);

            // Save audio chunk for testing
            this.saveAudioChunk(audioData, 'incoming', this.audioChunkCount);

            // Log first chunk and every 100th chunk for monitoring
            if (this.audioChunkCount === 1 || this.audioChunkCount % 100 === 0) {
                logger.log(`[GeminiLiveBridge] [IN] Received Twilio audio chunk #${this.audioChunkCount} (length: ${audioData.length})`);
            }

            if (!this.session) {
                logger.error('[GeminiLiveBridge] No active session, cannot process audio');
                return;
            }

            // Check if audio data is valid
            if (!audioData || audioData.length === 0) {
                logger.warn(`[GeminiLiveBridge] Empty audio chunk received #${this.audioChunkCount}`);
                return;
            }

            // Send audio to Gemini Live
            await this.geminiService.sendAudioChunk(this.session, audioData);

            if (this.audioChunkCount === 1) {
                logger.log('[GeminiLiveBridge] First audio chunk sent to Gemini Live successfully');
            }
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error handling Twilio audio:', error);
            // Don't throw error to prevent WebSocket disconnection
        }
    }

    private async handleGeminiResponse(audioChunk: Buffer) {
        try {
            this.responseChunkCount++;
            this.lastResponseSent = Date.now();
            this.lastResponseTime = Date.now();
            this.outgoingAudioChunks.push(audioChunk);

            // Clear any existing timeout since we got a response
            if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
                this.responseTimeout = null;
            }

            // Log first response and every 20th response for monitoring
            if (this.responseChunkCount === 1 || this.responseChunkCount % 20 === 0) {
                logger.log(`[GeminiLiveBridge] [OUT] Received Gemini response chunk #${this.responseChunkCount} (length: ${audioChunk.length})`);
            }

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                logger.error('[GeminiLiveBridge] WebSocket not open, cannot send audio response');
                return;
            }

            // Ensure we have valid audio data
            if (audioChunk.length === 0) {
                logger.warn(`[GeminiLiveBridge] Audio chunk is empty for chunk #${this.responseChunkCount}`);
                return;
            }

            // TEST MODE: Send first few chunks directly without downsampling to test if Twilio can handle 16kHz
            const testDirectMode = process.env.TEST_DIRECT_AUDIO === 'true' && this.responseChunkCount <= 5;

            if (testDirectMode) {
                logger.log(`[GeminiLiveBridge] TEST MODE: Sending chunk #${this.responseChunkCount} directly without downsampling`);
                await this.sendGeminiAudioDirect(audioChunk);
                return;
            }

            // Convert 16kHz PCM to 8kHz PCM for Twilio using perfect downsampling
            // Twilio expects: 8kHz, 16-bit, mono, linear PCM, little-endian
            const convertedAudio = this.downsampleAudio(audioChunk);

            // Save converted audio chunk for testing
            this.saveAudioChunk(convertedAudio, 'outgoing', this.responseChunkCount);

            // Ensure we have valid audio data after conversion
            if (convertedAudio.length === 0) {
                logger.warn(`[GeminiLiveBridge] Converted audio is empty for chunk #${this.responseChunkCount}`);
                return;
            }

            // Base64 encode the audio
            const base64Payload = convertedAudio.toString("base64");

            // Create the Twilio Media Streams message
            const jsonMessage = JSON.stringify({
                event: "media",
                media: {
                    track: "outbound",
                    payload: base64Payload
                }
            });

            // Enhanced logging for debugging
            if (this.responseChunkCount === 1 || this.responseChunkCount % 20 === 0) {
                logger.log(`[GeminiLiveBridge] [OUT] Sending JSON message to Twilio (chunk #${this.responseChunkCount}):`);
                logger.log(`[GeminiLiveBridge] Original audio length: ${audioChunk.length} bytes`);
                logger.log(`[GeminiLiveBridge] Converted audio length: ${convertedAudio.length} bytes`);
                logger.log(`[GeminiLiveBridge] Base64 payload length: ${base64Payload.length} chars`);
                logger.log(`[GeminiLiveBridge] JSON message length: ${jsonMessage.length} chars`);

                // Log first few bytes of converted audio to verify it's not all zeros
                const firstBytes = convertedAudio.slice(0, 16);
                const hasAudio = firstBytes.some(byte => byte !== 0);
                logger.log(`[GeminiLiveBridge] First 16 bytes of converted audio: ${firstBytes.toString('hex')}`);
                logger.log(`[GeminiLiveBridge] Audio contains non-zero data: ${hasAudio}`);
            }

            // Send the message to Twilio
            this.ws.send(jsonMessage, (err) => {
                if (err) {
                    logger.error(`[GeminiLiveBridge] WebSocket send error (chunk #${this.responseChunkCount}):`, err);
                } else if (this.responseChunkCount === 1) {
                    logger.log('[GeminiLiveBridge] First response chunk sent to Twilio successfully');
                }
            });

            // Set a timeout to check if Gemini stops responding
            this.responseTimeout = setTimeout(() => {
                this.checkForResponseTimeout();
            }, 5000); // 5 seconds timeout

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error handling Gemini response:', error);
        }
    }

    // Perfect audio downsampling from 16kHz to 8kHz for Twilio Media Streams
    private downsampleAudio(audioBuffer: Buffer): Buffer {
        try {
            // Get processing strategy from environment variable
            const strategy = (process.env.AUDIO_PROCESSING_STRATEGY as 'simple' | 'interpolated' | 'filtered') || 'interpolated';
            const amplification = parseFloat(process.env.AUDIO_AMPLIFICATION || '1.0');

            logger.log(`[GeminiLiveBridge] Using audio processing strategy: ${strategy}, amplification: ${amplification}`);

            // Use the AudioProcessor for perfect audio conversion
            const processedAudio = AudioProcessor.processAudioForTwilio(audioBuffer, {
                normalize: true,
                encoding: 'mulaw' // Use μ-law encoding for Twilio
            });

            // Log processing details for debugging
            if (this.responseChunkCount <= 3) {
                const analysis = AudioProcessor.analyzeAudio(processedAudio, 8000);
                logger.log(`[GeminiLiveBridge] Audio analysis:`, analysis);
            }

            return processedAudio;
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error processing audio:', error);
            return Buffer.alloc(0);
        }
    }

    private async checkForResponseTimeout() {
        const timeSinceLastResponse = Date.now() - this.lastResponseTime;
        if (timeSinceLastResponse > 5000 && this.session) {
            logger.log(`[GeminiLiveBridge] No response from Gemini Live for ${timeSinceLastResponse}ms, sending re-engagement prompt...`);
            try {
                await this.session.sendRealtimeInput({
                    text: "ഉപയോക്താവ് സംസാരിക്കുന്നുണ്ട്. ദയവായി ശ്രദ്ധാപൂർവം കേൾക്കുക."
                });
                logger.log('[GeminiLiveBridge] Re-engagement prompt sent successfully');
            } catch (error) {
                logger.error('[GeminiLiveBridge] Error sending re-engagement prompt:', error);
            }
        }
    }

    async endCall() {
        try {
            logger.log('[GeminiLiveBridge] Ending call...');

            // Clear any pending timeout
            if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
                this.responseTimeout = null;
            }

            if (this.session) {
                await this.geminiService.endSession(this.session);
                this.session = null;
            }

            const sessionDuration = Date.now() - this.sessionStartTime;
            logger.log(`[GeminiLiveBridge] Call ended. Session duration: ${sessionDuration}ms`);
            logger.log(`[GeminiLiveBridge] Audio chunks processed: ${this.audioChunkCount}`);
            logger.log(`[GeminiLiveBridge] Response chunks sent: ${this.responseChunkCount}`);

            if (this.lastAudioReceived > 0) {
                const timeSinceLastAudio = Date.now() - this.lastAudioReceived;
                logger.log(`[GeminiLiveBridge] Time since last audio received: ${timeSinceLastAudio}ms`);
            }

            if (this.lastResponseSent > 0) {
                const timeSinceLastResponse = Date.now() - this.lastResponseSent;
                logger.log(`[GeminiLiveBridge] Time since last response sent: ${timeSinceLastResponse}ms`);
            }

            // Save session summary
            this.saveSessionSummary();

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error ending call:', error);
        }
    }

    // Health check method
    getStatus() {
        return {
            sessionActive: !!this.session,
            audioChunksReceived: this.audioChunkCount,
            responseChunksSent: this.responseChunkCount,
            sessionDuration: this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0,
            timeSinceLastAudio: this.lastAudioReceived > 0 ? Date.now() - this.lastAudioReceived : 0,
            timeSinceLastResponse: this.lastResponseSent > 0 ? Date.now() - this.lastResponseSent : 0,
            wsReadyState: this.ws ? this.ws.readyState : 'no_ws'
        };
    }

    // Test method to send Gemini audio directly without downsampling
    async sendGeminiAudioDirect(audioChunk: Buffer) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logger.error('[GeminiLiveBridge] WebSocket not open, cannot send direct Gemini audio');
            return;
        }

        try {
            logger.log('[GeminiLiveBridge] Sending Gemini audio directly without downsampling...');
            logger.log(`[GeminiLiveBridge] Direct audio length: ${audioChunk.length} bytes`);

            // Base64 encode the audio directly
            const base64Payload = audioChunk.toString("base64");

            // Create the Twilio Media Streams message
            const jsonMessage = JSON.stringify({
                event: "media",
                media: {
                    track: "outbound",
                    payload: base64Payload
                }
            });

            logger.log(`[GeminiLiveBridge] Direct audio base64 length: ${base64Payload.length} chars`);
            logger.log(`[GeminiLiveBridge] Direct audio JSON length: ${jsonMessage.length} chars`);

            // Log first few bytes to verify it's not all zeros
            const firstBytes = audioChunk.slice(0, 16);
            const hasAudio = firstBytes.some(byte => byte !== 0);
            logger.log(`[GeminiLiveBridge] First 16 bytes of direct audio: ${firstBytes.toString('hex')}`);
            logger.log(`[GeminiLiveBridge] Direct audio contains non-zero data: ${hasAudio}`);

            this.ws.send(jsonMessage, (err) => {
                if (err) {
                    logger.error('[GeminiLiveBridge] Error sending direct Gemini audio:', err);
                } else {
                    logger.log('[GeminiLiveBridge] Direct Gemini audio sent successfully');
                }
            });

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error sending direct Gemini audio:', error);
        }
    }

    // Test method to send a simple tone to verify audio works
    async sendTestTone() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            logger.error('[GeminiLiveBridge] WebSocket not open, cannot send test tone');
            return;
        }

        try {
            // Generate test tone using AudioProcessor
            const audioBuffer = AudioProcessor.generateTestTone(1000, 2.0, 8000);

            // Convert to μ-law for Twilio
            const mulawBuffer = AudioProcessor.processAudioForTwilio(audioBuffer, {
                encoding: 'mulaw'
            });

            const base64Payload = mulawBuffer.toString("base64");
            const jsonMessage = JSON.stringify({
                event: "media",
                media: {
                    track: "outbound",
                    payload: base64Payload
                }
            });

            logger.log('[GeminiLiveBridge] Sending test tone to Twilio...');
            logger.log(`[GeminiLiveBridge] Test tone: ${mulawBuffer.length} bytes (μ-law)`);
            logger.log(`[GeminiLiveBridge] Base64 payload length: ${base64Payload.length} chars`);

            this.ws.send(jsonMessage, (err) => {
                if (err) {
                    logger.error('[GeminiLiveBridge] Error sending test tone:', err);
                } else {
                    logger.log('[GeminiLiveBridge] Test tone sent successfully');
                    logger.log('[GeminiLiveBridge] You should hear a 2-second beep tone now');
                }
            });

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error generating test tone:', error);
        }
    }
}
