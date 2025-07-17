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
    // Converts 16kHz 16-bit PCM to 8kHz 8-bit μ-law for Twilio
    static async processAudioForTwilio(inputBuffer: Buffer): Promise<Buffer> {
        if (!inputBuffer || inputBuffer.length === 0) {
            logger.warn('[AudioProcessor] Empty input buffer for Twilio conversion');
            return Buffer.alloc(0);
        }
        // Convert Buffer to Int16Array (16kHz)
        const inputInt16 = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
        const inputFloat32 = int16ToFloat32(inputInt16);

        // Resample from 16kHz to 8kHz using libsamplerate-js
        const srcDown = await create(1, 16000, 8000, { converterType: ConverterType.SRC_SINC_BEST_QUALITY });
        const downsampledFloat32 = srcDown.simple(inputFloat32);
        srcDown.destroy();
        const downsampledInt16 = float32ToInt16(downsampledFloat32);

        // μ-law encode
        const mulawBuffer = Buffer.from(alawmulaw.mulaw.encode(downsampledInt16));
        return mulawBuffer;
    }

    // Converts 8kHz 8-bit μ-law to 16kHz 16-bit PCM for Gemini
    static async processAudioForGemini(inputBuffer: Buffer): Promise<Buffer> {
        if (!inputBuffer || inputBuffer.length === 0) {
            logger.warn('[AudioProcessor] Empty input buffer for Gemini conversion');
            return Buffer.alloc(0);
        }
        // μ-law decode to Int16 (8kHz)
        const int16Input = alawmulaw.mulaw.decode(new Uint8Array(inputBuffer));
        const float32Input = int16ToFloat32(int16Input);

        // Resample from 8kHz to 16kHz using libsamplerate-js
        const srcUp = await create(1, 8000, 16000, { converterType: ConverterType.SRC_SINC_BEST_QUALITY });
        const upsampledFloat32 = srcUp.simple(float32Input);
        srcUp.destroy();
        const upsampledInt16 = float32ToInt16(upsampledFloat32);

        return Buffer.from(upsampledInt16.buffer);
    }
}
