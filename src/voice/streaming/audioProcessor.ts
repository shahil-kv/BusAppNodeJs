import convert from 'pcm-convert';
import { logger } from '../../utils/logger';

export class AudioProcessor {
    static processAudioForTwilio(inputBuffer: Buffer): Buffer {
        if (!inputBuffer || inputBuffer.length === 0) {
            logger.warn('[AudioProcessor] Empty input buffer');
            return Buffer.alloc(0);
        }

        try {
            // Gemini sends 16-bit PCM at 16kHz.
            // Twilio needs 8-bit μ-law at 8kHz.
            const convertedBuffer = convert(inputBuffer, {
                inputSampleRate: 16000,
                inputEncoding: 'pcm_s16le', // Signed 16-bit Little-Endian
                outputSampleRate: 8000,
                outputEncoding: 'mulaw',
            });

            logger.log(`[AudioProcessor] Converted ${inputBuffer.length} bytes of PCM to ${convertedBuffer.length} bytes of μ-law.`);
            return convertedBuffer;

        } catch (error) {
            logger.error('[AudioProcessor] Error during audio conversion:', error);
            return Buffer.alloc(0); // Return empty buffer on error
        }
    }
}
