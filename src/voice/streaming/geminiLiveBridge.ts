import { GeminiLiveService } from '../../ai/geminiLive.service';
import { logger } from '../../utils/logger';
import { WebSocket } from 'ws';
import { writeFileSync, mkdirSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { uploadAudioToSupabase } from '../../utils/supabaseUpload';
import { client as twilioClient } from '../../utils/twilioClient';
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
    private callSid: string | null = null;

    private streamSid: string | null = null; // Added to manage the stream SID

    private isAgentSpeaking = false;
    private agentSpeechBuffer: Buffer[] = [];

    private endOfTurnTimer: NodeJS.Timeout | null = null;
    private backchannelTimer: NodeJS.Timeout | null = null;
    private fillerSounds: Buffer[] = []; // To be loaded with pre-recorded audio

    // New: Buffer for incoming audio before Gemini session is ready
    private audioBufferQueue: Buffer[] = [];
    private comfortNoiseInterval: NodeJS.Timeout | null = null;


    constructor(geminiService: GeminiLiveService, callSid: string | null = null) {
        this.geminiService = geminiService;
        this.sessionId = Date.now().toString();
        this.callSid = callSid;
        logger.log('[GeminiLiveBridge] Bridge initialized with session ID:', this.sessionId);

        // Create audio storage directory
        this.ensureAudioDirectory();
        this.loadFillerSounds();
    }

    // Method to set the stream SID once it's available
    public setStreamSid(streamSid: string) {
        this.streamSid = streamSid;
        logger.log(`[GeminiLiveBridge] Stream SID set: ${streamSid}`);
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
                        // New: Process any buffered audio after session is ready
                        await this.processBufferedAudio();
                        // New: Start sending comfort noise
                        this.startComfortNoise();
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

    // New: Process buffered audio chunks
    private async processBufferedAudio() {
        logger.log(`[GeminiLiveBridge] Processing ${this.audioBufferQueue.length} buffered audio chunks.`);
        while (this.audioBufferQueue.length > 0) {
            const audioData = this.audioBufferQueue.shift();
            if (audioData) {
                await this.sendAudioToGemini(audioData);
            }
        }
    }

    // New: Send audio to Gemini (extracted from handleTwilioAudio)
    private async sendAudioToGemini(audioData: Buffer) {
        if (!audioData || audioData.length === 0) {
            logger.warn(`[GeminiLiveBridge] Empty audio chunk received for Gemini.`);
            return;
        }

        const pcmAudio = await AudioProcessor.processAudioForGemini(audioData);
        // logger.log(`[GeminiLiveBridge] Converted incoming mulaw (${audioData.length} bytes) to PCM (${pcmAudio.length} bytes) for Gemini.`);

        await this.geminiService.sendAudioChunk(this.session, pcmAudio);
    }

    // This method will be called by the WebSocket handler with extracted audio data
    private async loadFillerSounds() {
        const fillerDir = join(process.cwd(), 'src', 'assets', 'audio', 'fillers');
        if (existsSync(fillerDir)) {
            const files = readdirSync(fillerDir);
            for (const file of files) {
                if (file.endsWith('.raw')) {
                    const filePath = join(fillerDir, file);
                    const pcmBuffer = readFileSync(filePath);
                    // Assuming filler sounds are 16kHz PCM and converting to 8kHz μ-law
                    const mulawBuffer = await AudioProcessor.processAudioForTwilio(pcmBuffer);
                    this.fillerSounds.push(mulawBuffer);
                }
            }
            logger.log(`[GeminiLiveBridge] Loaded ${this.fillerSounds.length} filler sounds.`);
        }
    }

    private playFillerSound() {
        if (this.fillerSounds.length === 0 || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        const sound = this.fillerSounds[Math.floor(Math.random() * this.fillerSounds.length)];
        const base64Payload = sound.toString('base64');

        const twilioMessage = JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
                track: 'outbound',
                payload: base64Payload,
            },
        });

        this.ws.send(twilioMessage);
        logger.log('[GeminiLiveBridge] Played backchannel filler sound.');
    }

    async handleTwilioAudio(audioData: Buffer) {
        try {
            this.audioChunkCount++;
            this.lastAudioReceived = Date.now();

            // VAD: Clear any existing timers
            if (this.endOfTurnTimer) clearTimeout(this.endOfTurnTimer);
            if (this.backchannelTimer) clearTimeout(this.backchannelTimer);

            if (this.isAgentSpeaking) {
                logger.log('[GeminiLiveBridge] Barge-in detected! User is speaking while agent is talking.');
                this.agentSpeechBuffer = []; // Clear the agent's speech buffer
            }

            this.incomingAudioChunks.push(audioData);

            // Save audio chunk for testing
            this.saveAudioChunk(audioData, 'incoming', this.audioChunkCount);

            if (!this.session) {
                // New: Buffer audio if session is not yet active
                this.audioBufferQueue.push(audioData);
                logger.warn('[GeminiLiveBridge] Session not active, buffering audio chunk.');
                return;
            }

            await this.sendAudioToGemini(audioData);

            // Set timers for VAD and backchanneling
            this.backchannelTimer = setTimeout(() => this.playFillerSound(), 450); // Play filler after 450ms pause
            this.endOfTurnTimer = setTimeout(() => {
                logger.log('[GeminiLiveBridge] End of turn detected (700ms of silence).');
            }, 700);

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error handling Twilio audio:', error);
        }
    }

    private handleGeminiResponse(audioChunk: Buffer) {
        this.isAgentSpeaking = true;
        this.agentSpeechBuffer.push(audioChunk);
        this.flushAgentSpeech();
    }

    private async flushAgentSpeech() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.isAgentSpeaking = false;
            return;
        }

        while (this.agentSpeechBuffer.length > 0) {
            const audioChunk = this.agentSpeechBuffer.shift();
            if (!audioChunk) continue;

            try {
                this.responseChunkCount++;
                this.lastResponseSent = Date.now();
                this.outgoingAudioChunks.push(audioChunk); // Still useful for debugging

                if (!this.streamSid) {
                    logger.error('[GeminiLiveBridge] No streamSid available. Cannot send media.');
                    continue;
                }

                if (audioChunk.length === 0) {
                    logger.warn(`[GeminiLiveBridge] Received empty audio chunk from Gemini.`);
                    continue;
                }

                // 1. Process the audio for Twilio (downsample to 8kHz and encode as μ-law)
                const twilioAudioChunk = await AudioProcessor.processAudioForTwilio(audioChunk);
                // logger.log(`[GeminiLiveBridge] Converted Gemini PCM (${audioChunk.length} bytes) to Twilio mulaw (${twilioAudioChunk.length} bytes).`);

                if (twilioAudioChunk.length === 0) {
                    logger.warn(`[GeminiLiveBridge] Empty twilioAudioChunk after downsampling.`);
                    continue;
                }

                // 2. Base64 encode the payload
                const base64Payload = twilioAudioChunk.toString('base64');
                // logger.log(`[GeminiLiveBridge] Outgoing Twilio payload base64 length: ${base64Payload.length} chars.`);

                // 3. Create the Twilio Media Streams message
                const twilioMessage = JSON.stringify({
                    event: 'media',
                    streamSid: this.streamSid,
                    media: {
                        track: 'outbound',
                        payload: base64Payload,
                    },
                });

                // 4. Send it back over the WebSocket
                this.ws.send(twilioMessage);

                // Optional: Save the outgoing chunk for debugging
                this.saveAudioChunk(twilioAudioChunk, 'outgoing', this.responseChunkCount);

            } catch (error) {
                logger.error('[GeminiLiveBridge] Error handling Gemini response:', error);
            }
        }
        this.isAgentSpeaking = false;
    }



    public updateSystemPrompt(newPrompt: string) {
        this.geminiService.updateSystemPrompt(this.session, newPrompt);
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

    // New: Start sending comfort noise
    private startComfortNoise() {
        if (this.comfortNoiseInterval) {
            clearInterval(this.comfortNoiseInterval);
        }
        this.comfortNoiseInterval = setInterval(() => {
            if (!this.isAgentSpeaking && this.ws && this.ws.readyState === WebSocket.OPEN && this.streamSid) {
                // Send a small silence chunk (e.g., 20ms of μ-law silence)
                const silenceChunk = Buffer.alloc(160, 128); // 160 bytes for 20ms of μ-law at 8kHz (8000 samples/sec * 0.02 sec = 160 samples)
                const base64Payload = silenceChunk.toString('base64');
                const twilioMessage = JSON.stringify({
                    event: 'media',
                    streamSid: this.streamSid,
                    media: {
                        track: 'outbound',
                        payload: base64Payload,
                    },
                });
                this.ws.send(twilioMessage);
                logger.log('[GeminiLiveBridge] Sent comfort noise (20ms silence).'); // Log sparingly to avoid spam
            }
        }, 200); // Send every 200ms (Twilio expects audio every 20ms, so this is 10 chunks)
    }

    async endCall() {
        try {
            logger.log('[GeminiLiveBridge] Ending call...');

            // Clear any pending timeout
            if (this.responseTimeout) {
                clearTimeout(this.responseTimeout);
                this.responseTimeout = null;
            }
            // New: Clear comfort noise interval
            if (this.comfortNoiseInterval) {
                clearInterval(this.comfortNoiseInterval);
                this.comfortNoiseInterval = null;
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
            // const audioBuffer = AudioProcessor.generateTestTone(1000, 2.0, 8000); // Method does not exist
            // Use a fallback: send a short buffer of true μ-law silence (0xFF)
            const audioBuffer = Buffer.alloc(160, 0xFF); // 160 bytes for 20ms of μ-law at 8kHz

            // Convert to μ-law for Twilio
            const mulawBuffer = await AudioProcessor.processAudioForTwilio(audioBuffer);

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
                    logger.log('[GeminiLiveBridge] You should hear a short beep tone now');
                }
            });

        } catch (error) {
            logger.error('[GeminiLiveBridge] Error generating test tone:', error);
        }
    }
}
