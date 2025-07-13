import fs from 'fs';
import path from 'path';

// Check Twilio configuration
function checkTwilioConfig() {
  console.log('🔍 Twilio Configuration Check');
  console.log('============================\n');

  // Check for environment variables
  const requiredEnvVars = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];

  console.log('📋 Environment Variables:');
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`✅ ${envVar}: ${value.substring(0, 10)}...`);
    } else {
      console.log(`❌ ${envVar}: NOT SET`);
    }
  }

  // Check for WebSocket server configuration
  console.log('\n🔌 WebSocket Server Check:');

  // Look for server files
  const serverFiles = ['server.js', 'app.js', 'index.js', 'src/server.js', 'src/app.js'];

  let serverFile = null;
  for (const file of serverFiles) {
    if (fs.existsSync(file)) {
      serverFile = file;
      break;
    }
  }

  if (serverFile) {
    console.log(`✅ Found server file: ${serverFile}`);

    // Read server file to check WebSocket configuration
    try {
      const serverContent = fs.readFileSync(serverFile, 'utf8');

      // Check for WebSocket server setup
      if (serverContent.includes('WebSocket') || serverContent.includes('ws')) {
        console.log('✅ WebSocket server detected');
      } else {
        console.log('⚠️  WebSocket server not found in code');
      }

      // Check for stream endpoint
      if (serverContent.includes('/stream') || serverContent.includes('stream')) {
        console.log('✅ Stream endpoint detected');
      } else {
        console.log('⚠️  Stream endpoint not found');
      }

      // Check for Twilio Media Stream handling
      if (serverContent.includes('media') && serverContent.includes('track')) {
        console.log('✅ Media stream handling detected');
      } else {
        console.log('⚠️  Media stream handling not found');
      }
    } catch (error) {
      console.log(`❌ Error reading server file: ${error.message}`);
    }
  } else {
    console.log('❌ No server file found');
  }

  // Check for TwiML configuration
  console.log('\n📞 TwiML Configuration Check:');

  const twimlFiles = ['twiml.xml', 'voice.xml', 'call.xml', 'src/twiml.xml', 'src/voice.xml'];

  let twimlFile = null;
  for (const file of twimlFiles) {
    if (fs.existsSync(file)) {
      twimlFile = file;
      break;
    }
  }

  if (twimlFile) {
    console.log(`✅ Found TwiML file: ${twimlFile}`);

    try {
      const twimlContent = fs.readFileSync(twimlFile, 'utf8');

      // Check for <Stream> element
      if (twimlContent.includes('<Stream')) {
        console.log('✅ <Stream> element found');

        // Check for WebSocket URL
        const wsMatch = twimlContent.match(/url="([^"]+)"/);
        if (wsMatch) {
          const url = wsMatch[1];
          console.log(`✅ WebSocket URL: ${url}`);

          if (url.startsWith('wss://')) {
            console.log('✅ Using secure WebSocket (wss://)');
          } else if (url.startsWith('ws://')) {
            console.log('⚠️  Using insecure WebSocket (ws://) - not recommended for production');
          } else {
            console.log('❌ Invalid WebSocket URL format');
          }
        } else {
          console.log('❌ WebSocket URL not found in <Stream>');
        }

        // Check for track parameter
        if (twimlContent.includes('track="outbound"')) {
          console.log('✅ outbound track configured');
        } else {
          console.log('⚠️  outbound track not configured');
        }
      } else {
        console.log('❌ <Stream> element not found');
      }
    } catch (error) {
      console.log(`❌ Error reading TwiML file: ${error.message}`);
    }
  } else {
    console.log('⚠️  No TwiML file found - check your Twilio Studio or Function');
  }

  // Check for package.json dependencies
  console.log('\n📦 Dependencies Check:');

  if (fs.existsSync('package.json')) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      const requiredDeps = ['ws', 'twilio'];
      for (const dep of requiredDeps) {
        if (dependencies[dep]) {
          console.log(`✅ ${dep}: ${dependencies[dep]}`);
        } else {
          console.log(`❌ ${dep}: NOT INSTALLED`);
        }
      }
    } catch (error) {
      console.log(`❌ Error reading package.json: ${error.message}`);
    }
  } else {
    console.log('❌ package.json not found');
  }

  // Network connectivity check
  console.log('\n🌐 Network Connectivity Check:');
  console.log('💡 To test WebSocket connectivity:');
  console.log('   1. Start your server: npm start');
  console.log('   2. Run: node test-minimal.js');
  console.log('   3. Check server logs for WebSocket events');

  // Twilio console check
  console.log('\n📊 Twilio Console Check:');
  console.log('💡 Check these in your Twilio Console:');
  console.log('   1. Voice > Calls > [Your Call SID]');
  console.log('   2. Look for Media Stream events');
  console.log('   3. Check for any error messages');
  console.log('   4. Verify WebSocket connection status');

  // Firewall check
  console.log('\n🛡️  Firewall/Network Check:');
  console.log('💡 Ensure your server is accessible:');
  console.log('   1. If using ngrok: ngrok http 8080');
  console.log('   2. If using localhost: ensure Twilio can reach your server');
  console.log('   3. Check firewall rules for port 8080');
  console.log('   4. Verify SSL certificate if using wss://');
}

// Check for common issues
function checkCommonIssues() {
  console.log('\n🔧 Common Issues Checklist');
  console.log('==========================\n');

  const issues = [
    {
      issue: 'WebSocket URL not using wss://',
      check: 'Ensure your TwiML uses wss:// for production',
      fix: 'Use ngrok or deploy to HTTPS server',
    },
    {
      issue: 'Missing track: "outbound" in media messages',
      check: 'Every outbound media message must include track: "outbound"',
      fix: 'Add track: "outbound" to all outbound media messages',
    },
    {
      issue: 'Incorrect audio format',
      check: 'Twilio expects 8kHz, 8-bit μ-law encoded audio',
      fix: 'Ensure audio is properly downsampled and encoded',
    },
    {
      issue: 'Double base64 encoding',
      check: 'Audio should be encoded only once',
      fix: 'Buffer → base64 → JSON (not Buffer → base64 → base64 → JSON)',
    },
    {
      issue: 'WebSocket connection timeout',
      check: 'Server not responding to WebSocket connections',
      fix: 'Check server logs and ensure WebSocket server is running',
    },
    {
      issue: 'CORS or firewall blocking',
      check: 'Twilio cannot reach your WebSocket server',
      fix: 'Use ngrok or deploy to public server with proper firewall rules',
    },
  ];

  for (const issue of issues) {
    console.log(`⚠️  ${issue.issue}`);
    console.log(`   Check: ${issue.check}`);
    console.log(`   Fix: ${issue.fix}\n`);
  }
}

// Generate test TwiML
function generateTestTwiML() {
  console.log('\n📝 Sample TwiML Configuration');
  console.log('=============================\n');

  const sampleTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://your-server.com/stream" track="outbound">
            <Parameter name="test" value="true"/>
        </Stream>
    </Connect>
</Response>`;

  console.log(sampleTwiML);
  console.log('\n💡 Replace "wss://your-server.com/stream" with your actual WebSocket URL');
}

// Run all checks
function runAllChecks() {
  checkTwilioConfig();
  checkCommonIssues();
  generateTestTwiML();

  console.log('\n🎯 Next Steps:');
  console.log('==============');
  console.log('1. Fix any issues identified above');
  console.log('2. Run: node test-minimal.js');
  console.log('3. Check Twilio Console for call logs');
  console.log('4. If still no audio, contact Twilio support');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllChecks();
}

export { checkTwilioConfig, checkCommonIssues, generateTestTwiML, runAllChecks };
