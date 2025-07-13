const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Test configuration
const TEST_CONFIG = {
  // Audio generation
  sampleRate: 8000,
  duration: 2, // seconds
  frequency: 1000, // Hz - 1kHz beep
  amplitude: 0.5,

  // WebSocket
  wsUrl: 'wss://9c3f0c696c6a.ngrok-free.app/ws/twilio-audio',

  // File paths
  outputDir: './temp/audio/test',

  // Test modes
  testModes: ['mulaw', 'pcm', 'raw'],
  chunkSizes: [160, 320, 480, 960],
};

// Ensure output directory exists
if (!fs.existsSync(TEST_CONFIG.outputDir)) {
  fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
}

class AudioTestGenerator {
  constructor() {
    this.sampleRate = TEST_CONFIG.sampleRate;
    this.duration = TEST_CONFIG.duration;
    this.frequency = TEST_CONFIG.frequency;
    this.amplitude = TEST_CONFIG.amplitude;
  }

  // Generate a simple sine wave test tone
  generateSineWave() {
    const numSamples = this.sampleRate * this.duration;
    const samples = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const t = i / this.sampleRate;
      const value = Math.sin(2 * Math.PI * this.frequency * t) * this.amplitude * 32767;
      samples[i] = Math.round(value);
    }

    return samples;
  }

  // Generate a simple beep (square wave)
  generateBeep() {
    const numSamples = this.sampleRate * this.duration;
    const samples = new Int16Array(numSamples);
    const samplesPerCycle = this.sampleRate / this.frequency;

    for (let i = 0; i < numSamples; i++) {
      const cyclePosition = (i % samplesPerCycle) / samplesPerCycle;
      const value = cyclePosition < 0.5 ? this.amplitude * 32767 : -this.amplitude * 32767;
      samples[i] = Math.round(value);
    }

    return samples;
  }

  // Generate silence
  generateSilence() {
    const numSamples = this.sampleRate * this.duration;
    return new Int16Array(numSamples);
  }

  // Convert PCM to μ-law
  pcmToMulaw(pcmSamples) {
    const mulawTable = new Uint8Array(65536);

    // Generate μ-law lookup table
    for (let i = 0; i < 65536; i++) {
      const sample = i - 32768; // Convert to signed
      let sign = 0;
      let exponent = 0;
      let mantissa = 0;

      if (sample < 0) {
        sign = 0x80;
        sample = -sample;
      }

      if (sample < 256) {
        exponent = 0;
        mantissa = sample >> 4;
      } else if (sample < 512) {
        exponent = 1;
        mantissa = sample >> 5;
      } else if (sample < 1024) {
        exponent = 2;
        mantissa = sample >> 6;
      } else if (sample < 2048) {
        exponent = 3;
        mantissa = sample >> 7;
      } else if (sample < 4096) {
        exponent = 4;
        mantissa = sample >> 8;
      } else if (sample < 8192) {
        exponent = 5;
        mantissa = sample >> 9;
      } else if (sample < 16384) {
        exponent = 6;
        mantissa = sample >> 10;
      } else {
        exponent = 7;
        mantissa = sample >> 11;
      }

      mulawTable[i] = sign | (exponent << 4) | mantissa;
    }

    const mulawSamples = new Uint8Array(pcmSamples.length);
    for (let i = 0; i < pcmSamples.length; i++) {
      mulawSamples[i] = mulawTable[pcmSamples[i] + 32768];
    }

    return mulawSamples;
  }

  // Save audio to file for verification
  saveAudioFile(samples, filename, format = 'pcm') {
    const filepath = path.join(TEST_CONFIG.outputDir, filename);

    if (format === 'mulaw') {
      fs.writeFileSync(filepath, Buffer.from(samples));
    } else {
      // PCM - write as raw 16-bit little-endian
      const buffer = Buffer.alloc(samples.length * 2);
      for (let i = 0; i < samples.length; i++) {
        buffer.writeInt16LE(samples[i], i * 2);
      }
      fs.writeFileSync(filepath, buffer);
    }

    console.log(`✅ Saved ${format.toUpperCase()} audio: ${filepath} (${samples.length} samples)`);
    return filepath;
  }
}

class WebSocketTester {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.messagesSent = 0;
    this.messagesReceived = 0;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to WebSocket: ${TEST_CONFIG.wsUrl}`);

      this.ws = new WebSocket(TEST_CONFIG.wsUrl);

      this.ws.on('open', () => {
        console.log('✅ WebSocket connected');
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        this.messagesReceived++;
        console.log(`📨 Received message #${this.messagesReceived}: ${data.toString().substring(0, 100)}...`);
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        this.connected = false;
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  async sendAudioChunk(audioData, encoding = 'mulaw', chunkIndex = 0) {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      event: 'media',
      streamSid: 'test-stream-sid',
      media: {
        payload: audioData.toString('base64'),
      },
      track: 'outbound',
      chunk: chunkIndex,
      timestamp: Date.now(),
    };

    const jsonMessage = JSON.stringify(message);
    this.ws.send(jsonMessage);
    this.messagesSent++;

    console.log(`📤 Sent audio chunk #${chunkIndex} (${audioData.length} bytes, ${encoding})`);

    // Small delay to prevent overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  async sendStartMessage() {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      event: 'start',
      streamSid: 'test-stream-sid',
      start: {
        accountSid: 'test-account-sid',
        callSid: 'test-call-sid',
        tracks: ['outbound'],
      },
    };

    this.ws.send(JSON.stringify(message));
    console.log('📤 Sent start message');
  }

  async sendStopMessage() {
    if (!this.connected) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      event: 'stop',
      streamSid: 'test-stream-sid',
      stop: {
        accountSid: 'test-account-sid',
        callSid: 'test-call-sid',
      },
    };

    this.ws.send(JSON.stringify(message));
    console.log('📤 Sent stop message');
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

class AudioPipelineTester {
  constructor() {
    this.generator = new AudioTestGenerator();
    this.wsTester = new WebSocketTester();
  }

  async runAllTests() {
    console.log('🎵 Starting Audio Pipeline Tests\n');

    try {
      // Test 1: Generate and save test audio files
      await this.testAudioGeneration();

      // Test 2: WebSocket connection
      await this.testWebSocketConnection();

      // Test 3: Send different audio formats
      await this.testAudioFormats();

      // Test 4: Send different chunk sizes
      await this.testChunkSizes();

      // Test 5: Send single chunk test
      await this.testSingleChunk();

      console.log('\n✅ All tests completed!');
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
    } finally {
      this.wsTester.disconnect();
    }
  }

  async testAudioGeneration() {
    console.log('🔊 Test 1: Audio Generation');
    console.log('==========================');

    // Generate different types of audio
    const sineWave = this.generator.generateSineWave();
    const beep = this.generator.generateBeep();
    const silence = this.generator.generateSilence();

    // Save PCM versions
    this.generator.saveAudioFile(sineWave, 'test_sine_16khz_pcm.raw', 'pcm');
    this.generator.saveAudioFile(beep, 'test_beep_16khz_pcm.raw', 'pcm');
    this.generator.saveAudioFile(silence, 'test_silence_16khz_pcm.raw', 'pcm');

    // Convert to μ-law and save
    const sineMulaw = this.generator.pcmToMulaw(sineWave);
    const beepMulaw = this.generator.pcmToMulaw(beep);
    const silenceMulaw = this.generator.pcmToMulaw(silence);

    this.generator.saveAudioFile(sineMulaw, 'test_sine_8khz_mulaw.raw', 'mulaw');
    this.generator.saveAudioFile(beepMulaw, 'test_beep_8khz_mulaw.raw', 'mulaw');
    this.generator.saveAudioFile(silenceMulaw, 'test_silence_8khz_mulaw.raw', 'mulaw');

    console.log('✅ Audio generation test completed\n');
  }

  async testWebSocketConnection() {
    console.log('🔌 Test 2: WebSocket Connection');
    console.log('===============================');

    try {
      await this.wsTester.connect();
      console.log('✅ WebSocket connection test passed\n');
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error.message);
      console.log('💡 Make sure your server is running on ws://localhost:3000/stream\n');
      throw error;
    }
  }

  async testAudioFormats() {
    console.log('🎵 Test 3: Audio Formats');
    console.log('=======================');

    const sineWave = this.generator.generateSineWave();
    const sineMulaw = this.generator.pcmToMulaw(sineWave);

    try {
      await this.wsTester.sendStartMessage();

      // Test PCM format
      console.log('\n📤 Testing PCM format...');
      const pcmBuffer = Buffer.alloc(sineWave.length * 2);
      for (let i = 0; i < sineWave.length; i++) {
        pcmBuffer.writeInt16LE(sineWave[i], i * 2);
      }
      await this.wsTester.sendAudioChunk(pcmBuffer, 'pcm', 1);

      // Test μ-law format
      console.log('\n📤 Testing μ-law format...');
      const mulawBuffer = Buffer.from(sineMulaw);
      await this.wsTester.sendAudioChunk(mulawBuffer, 'mulaw', 2);

      await this.wsTester.sendStopMessage();
      console.log('✅ Audio formats test completed\n');
    } catch (error) {
      console.error('❌ Audio formats test failed:', error.message);
      throw error;
    }
  }

  async testChunkSizes() {
    console.log('📦 Test 4: Chunk Sizes');
    console.log('=====================');

    const sineWave = this.generator.generateSineWave();
    const sineMulaw = this.generator.pcmToMulaw(sineWave);

    try {
      await this.wsTester.sendStartMessage();

      for (const chunkSize of TEST_CONFIG.chunkSizes) {
        console.log(`\n📤 Testing chunk size: ${chunkSize} bytes`);

        // Take a portion of the audio data
        const chunkData = sineMulaw.slice(0, chunkSize);
        const buffer = Buffer.from(chunkData);

        await this.wsTester.sendAudioChunk(buffer, 'mulaw', chunkSize);
      }

      await this.wsTester.sendStopMessage();
      console.log('✅ Chunk sizes test completed\n');
    } catch (error) {
      console.error('❌ Chunk sizes test failed:', error.message);
      throw error;
    }
  }

  async testSingleChunk() {
    console.log('🎯 Test 5: Single Chunk Test');
    console.log('===========================');

    // Generate a simple 1-second beep
    const beep = this.generator.generateBeep();
    const beepMulaw = this.generator.pcmToMulaw(beep);

    try {
      await this.wsTester.sendStartMessage();

      console.log('\n📤 Sending single beep chunk...');
      const buffer = Buffer.from(beepMulaw);
      await this.wsTester.sendAudioChunk(buffer, 'mulaw', 'single');

      // Wait a bit to ensure it's processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await this.wsTester.sendStopMessage();
      console.log('✅ Single chunk test completed\n');
    } catch (error) {
      console.error('❌ Single chunk test failed:', error.message);
      throw error;
    }
  }
}

// Run the tests
async function main() {
  console.log('🎵 Audio Pipeline Diagnostic Tool');
  console.log('================================\n');

  const tester = new AudioPipelineTester();
  await tester.runAllTests();

  console.log('\n📋 Test Summary:');
  console.log('================');
  console.log('• Audio files saved to:', TEST_CONFIG.outputDir);
  console.log('• Check Audacity to verify audio quality');
  console.log('• Check server logs for WebSocket events');
  console.log('• If you hear the beep, the pipeline works');
  console.log('• If no audio, check Twilio configuration');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  AudioTestGenerator,
  WebSocketTester,
  AudioPipelineTester,
  TEST_CONFIG,
};
