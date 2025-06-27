import path from 'path';
import { createClient } from '@deepgram/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
const elevenLabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY || 'your-elevenlabs-api-key',
});
import fs from 'fs';
import { hash } from '../utils/call.helper';
import redisClient from '../lib/redisClient';
import { uploadAudioToSupabase } from './audioUpload.service';
import textToSpeech from '@google-cloud/text-to-speech';
import util from 'util';
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

const googleTTSClient = new textToSpeech.TextToSpeechClient();

// TODO: Set GOOGLE_APPLICATION_CREDENTIALS in your environment to the path of your Google Cloud service account JSON key
// TODO: Set ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID in your .env for ElevenLabs
// TODO: Set TTS_PROVIDER in your .env to either 'google' or 'elevenlabs'

// Alternative approach using fs.promises (more modern)
async function generateGoogleSpeechModern(text: string, lang = 'ml-IN'): Promise<string> {
  const audioPath = path.join(tempDir, `tts_google_${hash(text)}.mp3`);

  // Check if file already exists
  if (fs.existsSync(audioPath)) {
    return audioPath;
  }

  try {
    const request = {
      input: { text },
      voice: {
        languageCode: lang,
        ssmlGender: 'FEMALE' as const,
      },
      audioConfig: {
        audioEncoding: 'MP3' as const,
      },
    };

    const [response] = await googleTTSClient.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content received from Google TTS');
    }

    // Using fs.promises for cleaner async/await
    await fs.promises.writeFile(audioPath, response.audioContent, 'binary');

    return audioPath;
  } catch (error) {
    console.error('Error generating Google TTS audio:', error);
    throw error;
  }
}
// Generate audio using ElevenLabs or Google TTS with toggling
async function generateSpeech(text: string, lang = 'ml-IN'): Promise<string> {
  const provider = process.env.TTS_PROVIDER || 'elevenlabs';
  if (provider === 'google') {
    return generateGoogleSpeechModern(text, lang);
  }
  try {
    const audioPath = path.join(tempDir, `tts_${hash(text)}.mp3`);
    if (fs.existsSync(audioPath)) {
      return audioPath;
    }
    const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel voice
    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    const stream = await elevenLabs.textToSpeech.convert(
      voiceId, // Use real voice ID
      {
        text: text,
        modelId: modelId,
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

export async function getOrCreateAudioUrl(
  question: string,
  localAudioPath: string,
): Promise<string> {
  const questionHash = hash(question);
  const redisKey = `audio:question:${questionHash}`;

  // 1. Check Redis
  const cachedUrl = await redisClient.get(redisKey);
  if (typeof cachedUrl === 'string') return cachedUrl.toString();

  // 2. Upload to Supabase
  const publicUrl = await uploadAudioToSupabase(localAudioPath, questionHash);

  // 3. Cache in Redis
  await redisClient.set(redisKey, publicUrl, { EX: 3600 }); // 1 hour expiry

  return publicUrl;
}

export { transcribeAudio, generateSpeech };
