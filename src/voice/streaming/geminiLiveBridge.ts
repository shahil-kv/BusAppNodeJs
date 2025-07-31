import { GeminiLiveService, GeminiSessionCallbacks } from '../../ai/geminiLive.service';
import { logger } from '../../utils/logger';
import { WebSocket } from 'ws';
import { AudioProcessor } from './audioProcessor';
import { WorkflowStep } from '../../types/call.types';

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
  private workflow: WorkflowStep[] = [];
  private currentStepIndex = 0;

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
  private static readonly NO_INPUT_TIMEOUT_MS = 10000;
  private static readonly NO_RESPONSE_TIMEOUT_MS = 7000;
  private static readonly END_OF_SPEECH_TIMEOUT_MS = 1000;

  constructor(geminiService: GeminiLiveService, callSid: string | null = null, ws: WebSocket) {
    this.geminiService = geminiService;
    this.callSid = callSid;
    this.ws = ws;
    this.sessionStartTime = Date.now();
    this.transitionTo(CallState.CREATED);
  }

  private transitionTo(newState: CallState, reason = 'State Change') {
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

  public async startCall(systemPrompt: string, workflow: WorkflowStep[]) {
    this.workflow = workflow;
    this.currentStepIndex = 0;
    const initialPrompt = this.workflow.length > 0 ? this.workflow[0].malayalam || this.workflow[0].question : 'ഹലോ, നിങ്ങൾക്ക് എന്നെ കേൾക്കാമോ?';

    this.transitionTo(CallState.AI_GREETING, 'Starting call');
    const callbacks: GeminiSessionCallbacks = {
      onAudio: (audioChunk) => this.handleGeminiAudio(audioChunk),
      onTurnComplete: () => this.handleTurnComplete(),
      onError: (error) => this.endCall(error),
      onClose: () => this.endCall(),
    };
    this.session = await this.geminiService.startSession(systemPrompt, initialPrompt, callbacks);
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
    this.geminiService.sendText(this.session, 'നിങ്ങൾ ഇപ്പോഴും അവിടെയുണ്ടോ?');
  }

  private handleNoResponse() {
    if (this.state !== CallState.LISTENING) return;
    logger.error('[GeminiLiveBridge] No response from AI. Re-engaging.');
    this.geminiService.sendText(this.session, 'ക്ഷമിക്കണം, എനിക്ക് ചില സാങ്കേതിക തകരാറുകൾ ഉണ്ട്. നിങ്ങൾക്ക് ഒന്നുകൂടി പറയാമോ?');
  }

  private handleEndOfSpeech() {
    logger.log('[GeminiLiveBridge] User finished speaking. Processing next step.');
    this.currentStepIndex++;
    if (this.currentStepIndex < this.workflow.length) {
      const nextQuestion = this.workflow[this.currentStepIndex].malayalam || this.workflow[this.currentStepIndex].question;
      const instruction = `The user has responded. Now, ask the next question: "${nextQuestion}"`;
      logger.log(`[GeminiLiveBridge] Instructing AI for next step: ${instruction}`);
      this.geminiService.sendText(this.session, instruction);
    } else {
      const closingMessage = 'The workflow is complete. Thank the user for their time and say goodbye.';
      logger.log(`[GeminiLiveBridge] Instructing AI to end conversation: ${closingMessage}`);
      this.geminiService.sendText(this.session, closingMessage);
    }
    logger.log('[GeminiLiveBridge] Starting no-response timer for AI.');
    this.noResponseTimeout = setTimeout(() => this.handleNoResponse(), GeminiLiveBridge.NO_RESPONSE_TIMEOUT_MS);
  }

  private static readonly USER_SPEAKING_THRESHOLD = 100; // Energy level to consider as speech

    public async handleTwilioAudio(audioData: Buffer) {
        const pcmAudio = await AudioProcessor.processAudioForGemini(audioData);
        const energy = calculateRMS(pcmAudio);

        if (this.state === CallState.AI_SPEAKING) {
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
        } else if (this.state === CallState.LISTENING) {
            if (energy > GeminiLiveBridge.USER_SPEAKING_THRESHOLD) {
                this.clearTimersForUserSpeech();
                if (!this.session) return;
                await this.geminiService.sendAudioChunk(this.session, pcmAudio);
                this.endOfSpeechTimer = setTimeout(() => this.handleEndOfSpeech(), GeminiLiveBridge.END_OF_SPEECH_TIMEOUT_MS);
            }
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
    if (this.noInputTimeout) clearTimeout(this.noInputTimeout);
    if (this.endOfSpeechTimer) clearTimeout(this.endOfSpeechTimer);
    this.noInputTimeout = null;
    this.endOfSpeechTimer = null;
  }

  private clearAllTimers() {
    this.clearTimersForUserSpeech();
    if (this.noResponseTimeout) clearTimeout(this.noResponseTimeout);
    this.noResponseTimeout = null;
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
