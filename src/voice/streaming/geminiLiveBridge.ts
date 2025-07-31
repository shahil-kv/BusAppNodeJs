import { GeminiLiveService, GeminiSessionCallbacks } from '../../ai/geminiLive.service';
import { logger } from '../../utils/logger';
import { WebSocket } from 'ws';
import { AudioProcessor } from './audioProcessor';

enum CallState {
    CREATED,
    AI_GREETING,
    LISTENING,
    AI_SPEAKING,
    ENDED,
}

function calculateRMS(audioBuffer: Buffer): number {
    if (audioBuffer.length === 0) return 0;
    const int16Array = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / 2);
    let sumOfSquares = 0;
    for (let i = 0; i < int16Array.length; i++) {
        sumOfSquares += int16Array[i] * int16Array[i];
    }
    return Math.sqrt(sumOfSquares / int16Array.length);
}

export class GeminiLiveBridge {
    private state: CallState = CallState.CREATED;
    private geminiService: GeminiLiveService;
    private session: any = null;
    private ws: WebSocket | null = null;
    private callSid: string | null = null;
    private streamSid: string | null = null;

    private sessionStartTime = 0;
    private outgoingAudioTimer: NodeJS.Timeout | null = null;
    private noInputTimeout: NodeJS.Timeout | null = null;
    private noResponseTimeout: NodeJS.Timeout | null = null;
    private endOfSpeechTimer: NodeJS.Timeout | null = null;
    private outgoingAudioBuffer: Buffer[] = [];

    private consecutiveLoudChunks = 0;
    private static readonly BARGE_IN_ENERGY_THRESHOLD = 100;
    private static readonly CONSECUTIVE_LOUD_CHUNKS_FOR_BARGE_IN = 3;
    private static readonly OUTGOING_BUFFER_MS = 20;
    private static readonly NO_INPUT_TIMEOUT_MS = 10000; // 10 seconds
    private static readonly NO_RESPONSE_TIMEOUT_MS = 7000; // 7 seconds
    private static readonly END_OF_SPEECH_TIMEOUT_MS = 500; // 500ms of silence indicates user stopped talking

    constructor(geminiService: GeminiLiveService, callSid: string | null = null, ws: WebSocket) {
        this.geminiService = geminiService;
        this.callSid = callSid;
        this.ws = ws;
        this.sessionStartTime = Date.now();
        this.transitionTo(CallState.CREATED);
    }

    private transitionTo(newState: CallState, reason: string = 'State Change') {
        if (this.state === newState) return;
        logger.log(`[GeminiLiveBridge] State transition: ${CallState[this.state]} -> ${CallState[newState]}. Reason: ${reason}`);
        this.state = newState;

        this.clearAllTimers();

        if (newState === CallState.LISTENING) {
            logger.log('[GeminiLiveBridge] Starting no-input timer.');
            this.noInputTimeout = setTimeout(() => this.handleNoInput(), GeminiLiveBridge.NO_INPUT_TIMEOUT_MS);
        }
    }

    public setStreamSid(streamSid: string) {
        this.streamSid = streamSid;
    }

    public async startCall(systemPrompt: string) {
        this.transitionTo(CallState.AI_GREETING, 'Starting call');
        const callbacks: GeminiSessionCallbacks = {
            onAudio: (audioChunk) => this.handleGeminiAudio(audioChunk),
            onTurnComplete: () => this.handleTurnComplete(),
            onError: (error) => this.endCall(error),
            onClose: () => this.endCall(),
        };
        this.session = await this.geminiService.startSession(systemPrompt, callbacks);
        if (this.session) {
            logger.log('[GeminiLiveBridge] Gemini session started successfully.');
            this.outgoingAudioTimer = setInterval(() => this.processOutgoingAudio(), GeminiLiveBridge.OUTGOING_BUFFER_MS);
        } else {
            logger.error('[GeminiLiveBridge] Failed to start Gemini session.');
            this.endCall(new Error('Session startup failed'));
        }
    }

    private handleGeminiAudio(audioChunk: Buffer) {
        if (this.noResponseTimeout) {
            logger.log('[GeminiLiveBridge] AI has responded, cancelling no-response timer.');
            clearTimeout(this.noResponseTimeout);
            this.noResponseTimeout = null;
        }
        if (this.state === CallState.AI_GREETING || this.state === CallState.LISTENING) {
            this.transitionTo(CallState.AI_SPEAKING, 'AI is sending audio');
        }
        this.outgoingAudioBuffer.push(audioChunk);
    }

    private handleTurnComplete() {
        const checkBufferAndTransition = () => {
            if (this.outgoingAudioBuffer.length === 0) {
                this.transitionTo(CallState.LISTENING, 'AI turn complete');
            } else {
                setTimeout(checkBufferAndTransition, 50);
            }
        };
        checkBufferAndTransition();
    }

    private handleNoInput() {
        if (this.state !== CallState.LISTENING) return;
        logger.warn('[GeminiLiveBridge] No input from user. Re-engaging.');
        this.geminiService.sendText(this.session, "നിങ്ങൾ ഇപ്പോഴും അവിടെയുണ്ടോ?"); // "Are you still there?"
    }

    private handleNoResponse() {
        if (this.state !== CallState.LISTENING) return;
        logger.error('[GeminiLiveBridge] No response from AI. Re-engaging.');
        this.geminiService.sendText(this.session, "ക്ഷമിക്കണം, എനിക്ക് ചില സാങ്കേതിക തകരാറുകൾ ഉണ്ട്. നിങ്ങൾക്ക് ഒന്നുകൂടി പറയാമോ?"); // "Sorry, I am having some technical difficulties. Could you please repeat?"
    }

    public async handleTwilioAudio(audioData: Buffer) {
        this.clearTimersForUserSpeech();

        const pcmAudio = await AudioProcessor.processAudioForGemini(audioData);

        if (this.state === CallState.AI_SPEAKING) {
            const energy = calculateRMS(pcmAudio);
            if (energy > GeminiLiveBridge.BARGE_IN_ENERGY_THRESHOLD) {
                this.consecutiveLoudChunks++;
            } else {
                this.consecutiveLoudChunks = 0;
            }
            if (this.consecutiveLoudChunks >= GeminiLiveBridge.CONSECUTIVE_LOUD_CHUNKS_FOR_BARGE_IN) {
                logger.log('[GeminiLiveBridge] Barge-in detected.');
                this.outgoingAudioBuffer = [];
                this.transitionTo(CallState.LISTENING, 'Barge-in detected');
                this.consecutiveLoudChunks = 0;
            }
        }

        if (this.state === CallState.LISTENING) {
            if (!this.session) return;
            logger.log('[GeminiLiveBridge] Sending user audio to AI.');
            await this.geminiService.sendAudioChunk(this.session, pcmAudio);

            this.endOfSpeechTimer = setTimeout(() => {
                logger.log('[GeminiLiveBridge] User finished speaking. Starting no-response timer.');
                this.noResponseTimeout = setTimeout(() => this.handleNoResponse(), GeminiLiveBridge.NO_RESPONSE_TIMEOUT_MS);
            }, GeminiLiveBridge.END_OF_SPEECH_TIMEOUT_MS);
        }
    }

    private async processOutgoingAudio() {
        if (this.outgoingAudioBuffer.length === 0) return;
        const audioToSend = Buffer.concat(this.outgoingAudioBuffer);
        this.outgoingAudioBuffer = [];
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const twilioAudioChunk = await AudioProcessor.processAudioForTwilio(audioToSend);
                if (twilioAudioChunk.length === 0) return;
                const base64Payload = twilioAudioChunk.toString('base64');
                const twilioMessage = JSON.stringify({
                    event: 'media',
                    streamSid: this.streamSid,
                    media: { track: 'outbound', payload: base64Payload },
                });
                this.ws.send(twilioMessage);
            } catch (error) {
                logger.error('[GeminiLiveBridge] Error sending audio to Twilio:', error);
            }
        }
    }

    private clearTimersForUserSpeech() {
        if (this.noInputTimeout) {
            clearTimeout(this.noInputTimeout);
            this.noInputTimeout = null;
        }
        if (this.endOfSpeechTimer) {
            clearTimeout(this.endOfSpeechTimer);
            this.endOfSpeechTimer = null;
        }
    }

    private clearAllTimers() {
        this.clearTimersForUserSpeech();
        if (this.noResponseTimeout) {
            clearTimeout(this.noResponseTimeout);
            this.noResponseTimeout = null;
        }
    }

    public async endCall(error?: Error) {
        if (this.state === CallState.ENDED) return;
        if (error) {
            logger.error(`[GeminiLiveBridge] Ending call due to error: ${error.message}`);
        }
        this.transitionTo(CallState.ENDED, 'Call ended');
        if (this.outgoingAudioTimer) clearInterval(this.outgoingAudioTimer);
        this.clearAllTimers();
        if (this.session) {
            await this.geminiService.endSession(this.session);
            this.session = null;
        }
        logger.log(`[GeminiLiveBridge] Call ended. Session duration: ${Date.now() - this.sessionStartTime}ms`);
    }

    public getStatus() {
        return {
            state: CallState[this.state],
            sessionActive: !!this.session,
            sessionDuration: this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0,
            outgoingBufferSize: this.outgoingAudioBuffer.length,
        };
    }
}
