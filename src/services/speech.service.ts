import path from 'path';
import { createClient } from '@deepgram/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const elevenLabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY || 'your-elevenlabs-api-key',
});
import fs from 'fs';
import { hash } from '../utils/call.helper';
// Initialize Deepgram for STT
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
// Ensure temp directory exists
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log('Created temp directory:', tempDir);
}

// Clean up temp files older than 1 hour every 10 minutes
setInterval(() => {
  const now = Date.now();
  fs.readdirSync(tempDir).forEach((file) => {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > 3600000) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old temp file: ${filePath}`);
    }
  });
}, 600000);

// Generate audio using ElevenLabs with caching
async function generateSpeech(text: string): Promise<string> {
  try {
    const audioPath = path.join(tempDir, `tts_${hash(text)}.mp3`);
    if (fs.existsSync(audioPath)) {
      return audioPath;
    }
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel voice

    const stream = await elevenLabs.textToSpeech.convert(
      voiceId, // Use real voice ID
      {
        text: text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        optimizeStreamingLatency: 1,
      },
    );
    const chunks: Buffer[] = [];
    // Handle web ReadableStream
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } finally {
      reader.releaseLock();
    }
    // Fix Buffer type error for Buffer.concat
    const audioBuffer = Buffer.concat(chunks);
    // Fix Buffer type error for fs.writeFileSync
    fs.writeFileSync(audioPath, audioBuffer);
    return audioPath;
  } catch (error: unknown) {
    console.error('ElevenLabs TTS Error:', error);
    const fallbackPath = path.join(tempDir, `fallback_${Date.now()}.txt`);
    fs.writeFileSync(fallbackPath, text);
    throw new Error(`Failed to generate speech: ${(error as Error).message}`);
  }
}
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    console.log('Transcribing audio, buffer size:', audioBuffer.length);

    const response = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
      model: 'general', // Available on free plan
      tier: 'base', // Default tier for free plan
      language: 'en', // English, widely supported
      punctuate: true,
      smart_format: true,
      diarize: false,
    });

    // Updated to match the full response structure: response.results.channels[0].alternatives[0].transcript
    const transcript =
      response.result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    console.log('Transcription result:', transcript);
    return transcript;
  } catch (error) {
    console.error('Deepgram STT Error:', JSON.stringify(error, null, 2));
    if (error.status === 403) {
      console.error(
        'Insufficient permissions: Check your Deepgram plan for access to the requested model/tier/language.',
      );
    }
    return '';
  }
}

export { transcribeAudio, generateSpeech };
