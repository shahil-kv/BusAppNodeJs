import { GeminiLiveService } from '../../ai/geminiLive.service';
import { logger } from '../../utils/logger';
import { WebSocket } from 'ws';

import { AudioProcessor } from './audioProcessor';
import { getWorkflowStepsByGroupId, WorkflowStep } from '../../services/workflow.service';
import prisma from '../../lib/prisma';

export class GeminiLiveBridge {
    private static readonly MAX_AUDIO_BUFFER = 10;
    private geminiService: GeminiLiveService;
    private session = null;
    private ws: WebSocket | null = null;

    private sessionStartTime = 0;
    private lastAudioReceived = 0;
    private lastResponseSent = 0;
    private lastResponseTime = 0;
    private responseTimeout: NodeJS.Timeout | null = null;

    // Audio storage for testing

    private sessionId = '';
    private callSid: string | null = null;

    private streamSid: string | null = null; // Added to manage the stream SID

    private isAgentSpeaking = false;


    private endOfTurnTimer: NodeJS.Timeout | null = null;
    private backchannelTimer: NodeJS.Timeout | null = null;


    // New: Buffer for incoming audio before Gemini session is ready
    private audioBufferQueue: Buffer[] = [];

    private _droppedAudioWarned = false;

    private incomingAudioBuffer: Buffer[] = []; // Jitter buffer for incoming audio
    private incomingAudioTimer: NodeJS.Timeout | null = null; // Timer for jitter buffer
    private static readonly JITTER_BUFFER_MS = 10; // Jitter buffer delay (10ms for low latency)

    private outgoingAudioBuffer: Buffer[] = []; // Buffer for outgoing audio to Twilio
    private outgoingAudioTimer: NodeJS.Timeout | null = null; // Timer for outgoing audio buffer
    private static readonly OUTGOING_BUFFER_MS = 10; // Outgoing buffer delay (10ms for low latency)

    // (Optional) Static warm session holder
    private static warmSession: any = null;
    public static async keepWarmSession(geminiService: GeminiLiveService, systemPrompt: string) {
        // This is a stub for keeping a warm Gemini session alive
        // You can implement logic to keep a session open and ready for new calls
        if (!GeminiLiveBridge.warmSession) {
            GeminiLiveBridge.warmSession = await geminiService.startSession(systemPrompt, () => { console.log('shahi') });
        }
    }

    private firstAudioTimeout: NodeJS.Timeout | null = null;

    private workflowSteps: WorkflowStep[] = [];
    private currentStepIndex = 0;
    private groupId: number | null = null;

    public async initializeWorkflow(groupId: number | null) {
        this.groupId = groupId;
        if (!groupId) {
            return;
        }
        try {
            this.workflowSteps = await getWorkflowStepsByGroupId(groupId);
            this.currentStepIndex = 0;
        } catch (err) {
            // Only log error
            logger.error('[GeminiLiveBridge] Error initializing workflow:', err);
        }
    }

    public async updateStepIndexInDb(callSessionId: number, callHistoryId: number | null = null) {
        if (this.groupId == null) return;
        try {
            await prisma.call_session.update({
                where: { id: callSessionId },
                data: { current_index: this.currentStepIndex, updated_at: new Date() },
            });
            if (callHistoryId) {
                await prisma.call_history.update({
                    where: { id: callHistoryId },
                    data: {
                        current_step: JSON.stringify({
                            workflow_id: this.groupId,
                            step_id: this.workflowSteps[this.currentStepIndex]?.id || null,
                        }), updated_at: new Date()
                    },
                });
            }
        } catch (err) {
            logger.error('[GeminiLiveBridge] Error updating step index in DB:', err);
        }
    }


    constructor(geminiService: GeminiLiveService, callSid: string | null = null, ws: WebSocket) {
        this.geminiService = geminiService;
        this.sessionId = Date.now().toString();
        this.callSid = callSid;
        this.ws = ws;
        logger.log('[GeminiLiveBridge] Bridge initialized with session ID:', this.sessionId);
    }

    // Method to set the stream SID once it's available
    public setStreamSid(streamSid: string) {
        this.streamSid = streamSid;
        logger.log(`[GeminiLiveBridge] Stream SID set: ${streamSid}`);
    }



    // New: Process buffered audio chunks
    private async processBufferedAudio() {
        if (this.audioBufferQueue.length > 0) {
            logger.log(`[GeminiLiveBridge] Flushing ${this.audioBufferQueue.length} buffered audio chunks.`);
        }
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
            logger.error(`[GeminiLiveBridge] Dropped empty audio chunk.`);
            return;
        }
        try {
            const t0 = Date.now();
            const pcmAudio = await AudioProcessor.processAudioForGemini(audioData);
            await this.geminiService.sendAudioChunk(this.session, pcmAudio);
            const t1 = Date.now();
            if (t1 - t0 > 20) {
                logger.warn(`[GeminiLiveBridge] Audio processing took ${t1 - t0}ms`);
            }
        } catch (err) {
            logger.error('[GeminiLiveBridge] Error sending audio to Gemini:', err);
        }
    }

    // New: Process buffered incoming audio
    private async _processIncomingAudioBuffer() {
        if (this.incomingAudioBuffer.length === 0) {
            return;
        }
        if (!this.session) {
            this.incomingAudioBuffer = [];
            return;
        }
        const combinedAudio = Buffer.concat(this.incomingAudioBuffer as any);
        this.incomingAudioBuffer = [];
        await this.sendAudioToGemini(combinedAudio);
    }

    // New: Process buffered outgoing audio
    private async _processOutgoingAudioBuffer() {
        if (this.outgoingAudioBuffer.length === 0) {
            this.isAgentSpeaking = false;
            return;
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.isAgentSpeaking = false;
            this.outgoingAudioBuffer = [];
            return;
        }
        const combinedAudio = Buffer.concat(this.outgoingAudioBuffer as any);
        this.outgoingAudioBuffer = [];
        try {
            this.lastResponseSent = Date.now();
            if (!this.streamSid) {
                logger.error('[GeminiLiveBridge] No streamSid available. Cannot send media.');
                return;
            }
            if (combinedAudio.length === 0) {
                logger.error(`[GeminiLiveBridge] Dropped empty combined audio chunk from Gemini.`);
                return;
            }
            const twilioAudioChunk = await AudioProcessor.processAudioForTwilio(combinedAudio);
            if (twilioAudioChunk.length === 0) {
                logger.error(`[GeminiLiveBridge] Dropped empty twilioAudioChunk after downsampling.`);
                return;
            }
            const base64Payload = twilioAudioChunk.toString('base64');
            const twilioMessage = JSON.stringify({
                event: 'media',
                streamSid: this.streamSid,
                media: {
                    track: 'outbound',
                    payload: base64Payload,
                },
            });
            this.ws.send(twilioMessage);
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error handling Gemini response:', error);
        } finally {
            this.isAgentSpeaking = false;
        }
    }

    // This method will be called by the WebSocket handler with extracted audio data



    public async startCall(systemPrompt: string) {
        try {
            logger.log('[GeminiLiveBridge] Starting call with system prompt.');
            this.sessionStartTime = Date.now();
            let retryCount = 0;
            const maxRetries = 3;
            this._waitingForFirstGeminiAudio = true;
            let gotFirstAudio = false;
            this.firstAudioTimeout = null;
            while (retryCount < maxRetries) {
                try {
                    this.session = await this.geminiService.startSession(systemPrompt, (audioChunk: Buffer) => {
                        gotFirstAudio = true;
                        this.handleGeminiResponse(audioChunk);
                    });
                    if (this.session) {
                        logger.log('[GeminiLiveBridge] Gemini Live session created successfully');
                        // Set a timeout to check if first audio is received
                        this.firstAudioTimeout = setTimeout(() => {
                            if (!gotFirstAudio) {
                                logger.error('[GeminiLiveBridge] No audio received from Gemini after initial prompt! Session will be closed.');
                                this.endCall();
                            }
                        }, 2000); // 2 seconds
                        await this.processBufferedAudio();
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
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                }
            }
            logger.log('[GeminiLiveBridge] Call setup completed successfully');
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error starting call:', error);
            this.session = null;
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    event: 'error',
                    message: 'Failed to initialize AI session'
                }));
            }
        }
    }

    public async handleTwilioAudio(audioData: Buffer) {
        try {
            // Only process user audio after the AI has spoken the first question
            if (this._waitingForFirstGeminiAudio) return;
            this.lastAudioReceived = Date.now();
            if (!this.session) {
                this.incomingAudioBuffer = [];
                return;
            }
            this.incomingAudioBuffer.push(audioData);
            if (this.incomingAudioTimer) {
                clearTimeout(this.incomingAudioTimer);
            }
            this.incomingAudioTimer = setTimeout(() => {
                this._processIncomingAudioBuffer();
            }, GeminiLiveBridge.JITTER_BUFFER_MS);
        } catch (error) {
            logger.error('[GeminiLiveBridge] Error handling Twilio audio:', error);
        }
    }

    private _waitingForFirstGeminiAudio = true;
    private handleGeminiResponse(audioChunk: Buffer) {
        try {
            if (this._waitingForFirstGeminiAudio) {
                this._waitingForFirstGeminiAudio = false;
            }
            this.isAgentSpeaking = true;
            this.outgoingAudioBuffer.push(audioChunk);
            if (this.outgoingAudioTimer) {
                clearTimeout(this.outgoingAudioTimer);
            }
            this.outgoingAudioTimer = setTimeout(() => {
                this._processOutgoingAudioBuffer();
            }, GeminiLiveBridge.OUTGOING_BUFFER_MS);
        } catch (err) {
            logger.error('[GeminiLiveBridge] Error in handleGeminiResponse:', err);
        }
    }





    public updateSystemPrompt(newPrompt: string) {
        try {
            this.geminiService.updateSystemPrompt(this.session, newPrompt);
        } catch (err) {
            logger.error('[GeminiLiveBridge] Error updating system prompt:', err);
        }
    }

    private async checkForResponseTimeout() {
        const timeSinceLastResponse = Date.now() - this.lastResponseTime;
        if (timeSinceLastResponse > 5000 && this.session) {
            try {
                await this.session.sendRealtimeInput({
                    text: "ഉപയോക്താവ് സംസാരിക്കുന്നുണ്ട്. ദയവായി ശ്രദ്ധാപൂർവം കേൾക്കുക."
                });
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
            // Clear any first audio timeout if set
            if (this.firstAudioTimeout) {
                clearTimeout(this.firstAudioTimeout);
                this.firstAudioTimeout = null;
            }
            // New: Clear comfort noise interval
            // if (this.comfortNoiseInterval) {
            //     clearInterval(this.comfortNoiseInterval);
            //     this.comfortNoiseInterval = null;
            // }

            if (this.session) {
                await this.geminiService.endSession(this.session);
                this.session = null;
            }

            const sessionDuration = Date.now() - this.sessionStartTime;
            logger.log(`[GeminiLiveBridge] Call ended. Session duration: ${sessionDuration}ms`);

            if (this.lastAudioReceived > 0) {
                const timeSinceLastAudio = Date.now() - this.lastAudioReceived;
                logger.log(`[GeminiLiveBridge] Time since last audio received: ${timeSinceLastAudio}ms`);
            }

            if (this.lastResponseSent > 0) {
                const timeSinceLastResponse = Date.now() - this.lastResponseSent;
                logger.log(`[GeminiLiveBridge] Time since last response sent: ${timeSinceLastResponse}ms`);
            }



        } catch (error) {
            logger.error('[GeminiLiveBridge] Error ending call:', error);
        }
    }

    // Health check method
    getStatus() {
        return {
            sessionActive: !!this.session,
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