import alawmulaw from 'alawmulaw';
import { logger } from '../../utils/logger';

function downsample16kTo8k(input: Int16Array): Int16Array {
    // Decimate: take every other sample
    const output = new Int16Array(input.length / 2);
    for (let i = 0, j = 0; i < output.length; i++, j += 2) {
        output[i] = input[j];
    }
    return output;
}

function upsample8kTo16k(input: Int16Array): Int16Array {
    // Linear interpolation between samples
    const output = new Int16Array(input.length * 2);
    for (let i = 0; i < input.length - 1; i++) {
        output[2 * i] = input[i];
        output[2 * i + 1] = (input[i] + input[i + 1]) >> 1;
    }
    // Last sample
    output[output.length - 2] = input[input.length - 1];
    output[output.length - 1] = input[input.length - 1];
    return output;
}

export class AudioProcessor {
    // Converts 16kHz 16-bit PCM to 8kHz 8-bit μ-law for Twilio
    static async processAudioForTwilio(inputBuffer: Buffer): Promise<Buffer> {
        if (!inputBuffer || inputBuffer.length === 0) {
            logger.warn('[AudioProcessor] Empty input buffer for Twilio conversion');
            return Buffer.alloc(0);
        }
        // Convert Buffer to Int16Array
        const input = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
        // Downsample from 16kHz to 8kHz
        const downsampled = downsample16kTo8k(input);
        // μ-law encode
        const mulawBuffer = Buffer.from(alawmulaw.mulaw.encode(downsampled));
        return mulawBuffer;
    }

    // Converts 8kHz 8-bit μ-law to 16kHz 16-bit PCM for Gemini
    static async processAudioForGemini(inputBuffer: Buffer): Promise<Buffer> {
        if (!inputBuffer || inputBuffer.length === 0) {
            logger.warn('[AudioProcessor] Empty input buffer for Gemini conversion');
            return Buffer.alloc(0);
        }
        // μ-law decode to Int16
        const int16Input = alawmulaw.mulaw.decode(new Uint8Array(inputBuffer));
        // Upsample from 8kHz to 16kHz
        const upsampled = upsample8kTo16k(int16Input);
        return Buffer.from(upsampled.buffer);
    }
}
