import alawmulaw from 'alawmulaw';
import { logger } from '../../utils/logger';
import libsamplerate from '@alexanderolsen/libsamplerate-js';
const { create, ConverterType } = libsamplerate;

// Helper to convert Int16Array to Float32Array
function int16ToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = input[i] / 32768.0;
    }
    return output;
}

// Helper to convert Float32Array to Int16Array
function float32ToInt16(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = Math.min(1, Math.max(-1, input[i])) * 32767;
    }
    return output;
}

export class AudioProcessor {
    private static srcDown: any = null;
    private static srcUp: any = null;
    private static isInitialized = false;

    static async initialize() {
        if (this.isInitialized) {
            logger.warn('[AudioProcessor] Resamplers already initialized.');
            return;
        }
        try {
            // Initialize resamplers with a faster converter type
            this.srcDown = await create(1, 16000, 8000, { converterType: ConverterType.SRC_SINC_FASTEST });
            this.srcUp = await create(1, 8000, 16000, { converterType: ConverterType.SRC_SINC_FASTEST });
            this.isInitialized = true;
            logger.log('[AudioProcessor] Resamplers initialized successfully.');
        } catch (error) {
            logger.error('[AudioProcessor] Failed to initialize resamplers:', error);
            this.isInitialized = false;
        }
    }

    // Converts 16kHz 16-bit PCM to 8kHz 8-bit μ-law for Twilio
    static async processAudioForTwilio(inputBuffer: Buffer): Promise<Buffer> {
        if (!this.isInitialized || !this.srcDown) {
            logger.error('[AudioProcessor] Down-sampler not initialized. Call initialize() first.');
            return Buffer.alloc(0);
        }
        if (!inputBuffer || inputBuffer.length === 0) {
            // This warning is kept from the original code
            logger.warn('[AudioProcessor] Empty input buffer for Twilio conversion');
            return Buffer.alloc(0);
        }
        // Convert Buffer to Int16Array (16kHz)
        const inputInt16 = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
        const inputFloat32 = int16ToFloat32(inputInt16);

        // Resample using the cached resampler
        const downsampledFloat32 = this.srcDown.simple(inputFloat32);
        const downsampledInt16 = float32ToInt16(downsampledFloat32);

        // μ-law encode
        const mulawBuffer = Buffer.from(alawmulaw.mulaw.encode(downsampledInt16));
        return mulawBuffer;
    }

    // Converts 8kHz 8-bit μ-law to 16kHz 16-bit PCM for Gemini
    static async processAudioForGemini(inputBuffer: Buffer): Promise<Buffer> {
        if (!this.isInitialized || !this.srcUp) {
            logger.error('[AudioProcessor] Up-sampler not initialized. Call initialize() first.');
            return Buffer.alloc(0);
        }
        if (!inputBuffer || inputBuffer.length === 0) {
            // This warning is kept from the original code
            logger.warn('[AudioProcessor] Empty input buffer for Gemini conversion');
            return Buffer.alloc(0);
        }
        // μ-law decode to Int16 (8kHz)
        const int16Input = alawmulaw.mulaw.decode(new Uint8Array(inputBuffer));
        const float32Input = int16ToFloat32(int16Input);

        // Resample using the cached resampler
        const upsampledFloat32 = this.srcUp.simple(float32Input);
        const upsampledInt16 = float32ToInt16(upsampledFloat32);

        return Buffer.from(upsampledInt16.buffer);
    }

    static destroy() {
        if (!this.isInitialized) {
            return;
        }
        if (this.srcDown) {
            this.srcDown.destroy();
            this.srcDown = null;
        }
        if (this.srcUp) {
            this.srcUp.destroy();
            this.srcUp = null;
        }
        this.isInitialized = false;
        logger.log('[AudioProcessor] Resamplers destroyed.');
    }
}
