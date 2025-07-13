import WebSocket from 'ws';

// Minimal test configuration
const TEST_CONFIG = {
  wsUrl: 'wss://9c3f0c696c6a.ngrok-free.app/ws/twilio-audio',
  sampleRate: 8000,
  frequency: 1000, // 1kHz beep
  duration: 1, // 1 second
};

// Generate a simple 1kHz beep in μ-law format
function generateTestBeep() {
  const numSamples = TEST_CONFIG.sampleRate * TEST_CONFIG.duration;
  const samples = new Int16Array(numSamples);
  const samplesPerCycle = TEST_CONFIG.sampleRate / TEST_CONFIG.frequency;

  // Generate square wave beep
  for (let i = 0; i < numSamples; i++) {
    const cyclePosition = (i % samplesPerCycle) / samplesPerCycle;
    const value = cyclePosition < 0.5 ? 16384 : -16384; // Half amplitude
    samples[i] = Math.round(value);
  }

  // Convert to μ-law
  const mulawSamples = new Uint8Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const sample = samples[i];
    let sign = 0;
    let exponent = 0;
    let mantissa = 0;

    const absSample = Math.abs(sample);
    if (sample < 0) {
      sign = 0x80;
    }

    if (absSample < 256) {
      exponent = 0;
      mantissa = absSample >> 4;
    } else if (absSample < 512) {
      exponent = 1;
      mantissa = absSample >> 5;
    } else if (absSample < 1024) {
      exponent = 2;
      mantissa = absSample >> 6;
    } else if (absSample < 2048) {
      exponent = 3;
      mantissa = absSample >> 7;
    } else if (absSample < 4096) {
      exponent = 4;
      mantissa = absSample >> 8;
    } else if (absSample < 8192) {
      exponent = 5;
      mantissa = absSample >> 9;
    } else if (absSample < 16384) {
      exponent = 6;
      mantissa = absSample >> 10;
    } else {
      exponent = 7;
      mantissa = absSample >> 11;
    }

    mulawSamples[i] = sign | (exponent << 4) | mantissa;
  }

  return mulawSamples;
}

async function runMinimalTest() {
  console.log('🎵 Minimal Audio Test');
  console.log('====================\n');

  const ws = new WebSocket(TEST_CONFIG.wsUrl);

  return new Promise((resolve, reject) => {
    let connected = false;
    let messagesSent = 0;

    ws.on('open', async () => {
      console.log('✅ WebSocket connected');
      connected = true;

      try {
        // Send start message
        const startMessage = {
          event: 'start',
          streamSid: 'test-stream-sid',
          start: {
            accountSid: 'test-account-sid',
            callSid: 'test-call-sid',
            tracks: ['outbound'],
          },
        };

        ws.send(JSON.stringify(startMessage));
        console.log('📤 Sent start message');

        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Generate and send test beep
        const beepData = generateTestBeep();
        const audioBuffer = Buffer.from(beepData);

        const mediaMessage = {
          event: 'media',
          streamSid: 'test-stream-sid',
          media: {
            payload: audioBuffer.toString('base64'),
          },
          track: 'outbound',
          chunk: 1,
          timestamp: Date.now(),
        };

        ws.send(JSON.stringify(mediaMessage));
        messagesSent++;
        console.log(`📤 Sent audio chunk (${audioBuffer.length} bytes, μ-law)`);
        console.log(`📊 Audio data: ${audioBuffer.length} bytes, ${beepData.length} samples`);
        console.log(`🔊 Sample rate: ${TEST_CONFIG.sampleRate}Hz, Duration: ${TEST_CONFIG.duration}s`);

        // Wait for audio to be processed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Send stop message
        const stopMessage = {
          event: 'stop',
          streamSid: 'test-stream-sid',
          stop: {
            accountSid: 'test-account-sid',
            callSid: 'test-call-sid',
          },
        };

        ws.send(JSON.stringify(stopMessage));
        console.log('📤 Sent stop message');

        console.log('\n✅ Test completed!');
        console.log('📋 Summary:');
        console.log(`   • WebSocket connected: ${connected}`);
        console.log(`   • Messages sent: ${messagesSent}`);
        console.log(`   • Audio: ${audioBuffer.length} bytes μ-law`);
        console.log(`   • Expected: 1kHz beep for ${TEST_CONFIG.duration} second`);
        console.log('\n💡 If you hear the beep, the pipeline works!');
        console.log('💡 If no audio, check Twilio logs and configuration.');

        ws.close();
        resolve();
      } catch (error) {
        console.error('❌ Test failed:', error.message);
        ws.close();
        reject(error);
      }
    });

    ws.on('message', (data) => {
      console.log(`📨 Received: ${data.toString().substring(0, 100)}...`);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connected) {
        console.error('❌ Connection timeout');
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runMinimalTest().catch(console.error);
}

export { runMinimalTest, generateTestBeep };
