import WebSocket from 'ws';
import http from 'http';

// Test WebSocket server directly
async function testWebSocketServer() {
  console.log('🔌 WebSocket Server Test');
  console.log('========================\n');

  const wsUrl = 'wss://9c3f0c696c6a.ngrok-free.app/ws/twilio-audio';
  console.log(`Connecting to: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let connected = false;
    let messagesReceived = 0;

    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      connected = true;

      // Send a test message
      const testMessage = {
        event: 'test',
        message: 'Hello from test client',
        timestamp: Date.now(),
      };

      ws.send(JSON.stringify(testMessage));
      console.log('📤 Sent test message');
    });

    ws.on('message', (data) => {
      messagesReceived++;
      console.log(`📨 Received message #${messagesReceived}:`);
      console.log(`   Data: ${data.toString().substring(0, 200)}...`);

      try {
        const parsed = JSON.parse(data.toString());
        console.log(`   Event: ${parsed.event || 'unknown'}`);
        console.log(`   Type: ${typeof parsed}`);
      } catch (e) {
        console.log(`   Raw data (not JSON)`);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);

      console.log('\n📊 Test Summary:');
      console.log(`   • Connected: ${connected}`);
      console.log(`   • Messages received: ${messagesReceived}`);

      if (connected && messagesReceived > 0) {
        console.log('✅ WebSocket server is working correctly');
      } else if (connected) {
        console.log('⚠️  Connected but no messages received');
      } else {
        console.log('❌ Failed to connect to WebSocket server');
      }

      resolve();
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!connected) {
        console.error('❌ Connection timeout');
        ws.close();
        reject(new Error('Connection timeout'));
      } else {
        console.log('\n⏰ Test timeout - closing connection');
        ws.close();
      }
    }, 5000);
  });
}

// Test with Twilio-like messages
async function testTwilioMessages() {
  console.log('\n📞 Twilio Message Test');
  console.log('=====================\n');

  const wsUrl = 'wss://9c3f0c696c6a.ngrok-free.app/ws/twilio-audio';
  console.log(`Connecting to: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let connected = false;
    let messagesReceived = 0;

    ws.on('open', async () => {
      console.log('✅ WebSocket connected');
      connected = true;

      try {
        // Send start message (like Twilio)
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

        // Send a simple test audio chunk
        const testAudio = Buffer.alloc(160).fill(0x7f); // Simple test data
        const mediaMessage = {
          event: 'media',
          streamSid: 'test-stream-sid',
          media: {
            payload: testAudio.toString('base64'),
          },
          track: 'outbound',
          chunk: 1,
          timestamp: Date.now(),
        };

        ws.send(JSON.stringify(mediaMessage));
        console.log('📤 Sent test audio chunk');

        // Wait for response
        await new Promise((resolve) => setTimeout(resolve, 1000));

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
      } catch (error) {
        console.error('❌ Error sending messages:', error.message);
        ws.close();
        reject(error);
      }
    });

    ws.on('message', (data) => {
      messagesReceived++;
      console.log(`📨 Received message #${messagesReceived}:`);
      console.log(`   Data: ${data.toString().substring(0, 200)}...`);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} - ${reason}`);

      console.log('\n📊 Twilio Test Summary:');
      console.log(`   • Connected: ${connected}`);
      console.log(`   • Messages received: ${messagesReceived}`);

      if (connected && messagesReceived > 0) {
        console.log('✅ Server handles Twilio messages correctly');
      } else if (connected) {
        console.log('⚠️  Connected but no responses received');
      } else {
        console.log('❌ Failed to connect');
      }

      resolve();
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!connected) {
        console.error('❌ Connection timeout');
        ws.close();
        reject(new Error('Connection timeout'));
      } else {
        console.log('\n⏰ Test timeout - closing connection');
        ws.close();
      }
    }, 10000);
  });
}

// Check if server is running
async function checkServerStatus() {
  console.log('🔍 Server Status Check');
  console.log('=====================\n');

  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '9c3f0c696c6a.ngrok-free.app',
        port: 443,
        path: '/',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        console.log(`✅ HTTP server responding: ${res.statusCode}`);
        console.log(`   Headers: ${JSON.stringify(res.headers)}`);
        resolve(true);
      },
    );

    req.on('error', (error) => {
      console.log(`❌ HTTP server not responding: ${error.message}`);
      console.log('💡 Make sure your ngrok tunnel is running');
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ HTTP server timeout');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Run all tests
async function runAllTests() {
  console.log('🧪 WebSocket Server Diagnostic Tool');
  console.log('===================================\n');

  try {
    // Check if server is running
    const serverRunning = await checkServerStatus();

    if (!serverRunning) {
      console.log('\n💡 Please start your server first:');
      console.log('   npm start');
      console.log('   or');
      console.log('   node server.js');
      return;
    }

    // Test basic WebSocket connection
    await testWebSocketServer();

    // Test with Twilio-like messages
    await testTwilioMessages();

    console.log('\n✅ All tests completed!');
    console.log('\n💡 If all tests pass, your WebSocket server is working correctly.');
    console.log('💡 If tests fail, check your server logs for errors.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testWebSocketServer, testTwilioMessages, checkServerStatus, runAllTests };
