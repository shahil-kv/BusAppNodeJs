# Audio Pipeline Diagnostic Tools

This directory contains comprehensive test tools to diagnose issues with the Gemini AI voice integration with Twilio Media Streams.

## 🎯 Problem Statement

You can hear Gemini AI audio in Audacity, but the AI voice is not heard on the phone during Twilio calls. The issue is isolated to the audio pipeline
from the backend to Twilio.

## 📁 Test Files

### 1. `test-audio-pipeline.js` - Comprehensive Audio Pipeline Test

- Generates test audio files (sine wave, beep, silence)
- Tests WebSocket connection
- Tests different audio formats (PCM, μ-law)
- Tests different chunk sizes
- Sends test audio through your WebSocket server

### 2. `test-minimal.js` - Minimal Audio Test

- Simple 1kHz beep test
- Minimal WebSocket communication
- Quick test to verify basic functionality

### 3. `test-websocket-server.js` - WebSocket Server Test

- Tests WebSocket server directly (without Twilio)
- Verifies server is responding correctly
- Tests with Twilio-like messages

### 4. `check-twilio-config.js` - Twilio Configuration Check

- Checks environment variables
- Verifies WebSocket server configuration
- Checks TwiML configuration
- Lists common issues and fixes

## 🚀 How to Use

### Step 1: Check Your Configuration

```bash
node check-twilio-config.js
```

This will check your Twilio setup and identify any configuration issues.

### Step 2: Test WebSocket Server

```bash
# Make sure your server is running first
npm start

# Then test the WebSocket server
node test-websocket-server.js
```

This verifies your WebSocket server is working correctly.

### Step 3: Test Audio Pipeline

```bash
# Test with minimal audio
node test-minimal.js

# Or run comprehensive tests
node test-audio-pipeline.js
```

### Step 4: Check Generated Audio Files

The tests will generate audio files in `./temp/audio/test/`. Open these in Audacity to verify:

- `test_beep_8khz_mulaw.raw` - Should be a clear 1kHz beep
- `test_sine_8khz_mulaw.raw` - Should be a smooth sine wave
- `test_silence_8khz_mulaw.raw` - Should be silent

## 🔍 Diagnostic Checklist

### 1. Check Twilio Console Call Logs

- Go to Twilio Console > Voice > Calls
- Click on your call SID
- Look for Media Stream events and errors

### 2. Verify WebSocket Events

Your server logs should show:

```
[WebSocket] Connection established
[WebSocket] Received start event
[WebSocket] Received media chunks
[WebSocket] Received stop event
```

### 3. Check Audio Format

Twilio expects:

- **Sample Rate**: 8kHz
- **Bit Depth**: 8-bit
- **Encoding**: μ-law (mu-law)
- **Chunk Size**: 160 bytes (20ms at 8kHz)

### 4. Verify JSON Message Format

Outbound media messages must include:

```json
{
  "event": "media",
  "streamSid": "your-stream-sid",
  "media": {
    "payload": "base64-encoded-audio"
  },
  "track": "outbound",
  "chunk": 1,
  "timestamp": 1234567890
}
```

### 5. Check TwiML Configuration

Your TwiML should look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="wss://your-server.com/stream" track="outbound">
            <Parameter name="test" value="true"/>
        </Stream>
    </Connect>
</Response>
```

## 🛠️ Common Issues and Fixes

### Issue: "WebSocket connection failed"

**Fix**:

- Ensure your server is running on port 3000
- Check firewall settings
- Use ngrok for public access: `ngrok http 3000`

### Issue: "No audio heard on phone"

**Possible Causes**:

1. **Missing `track: "outbound"`** - Add to all outbound media messages
2. **Wrong audio format** - Ensure 8kHz, 8-bit μ-law
3. **Double base64 encoding** - Encode only once: Buffer → base64 → JSON
4. **Wrong WebSocket URL** - Use `wss://` for production

### Issue: "Audio quality is poor"

**Fix**:

- Check audio normalization in your processing pipeline
- Ensure proper downsampling from 16kHz to 8kHz
- Verify μ-law encoding is correct

### Issue: "Server not responding"

**Fix**:

- Check server logs for errors
- Ensure WebSocket server is properly configured
- Verify all dependencies are installed

## 📊 Test Results Interpretation

### ✅ All Tests Pass

- Your audio pipeline is working correctly
- The issue might be with Twilio configuration
- Check Twilio Console for call-specific issues

### ❌ WebSocket Tests Fail

- Fix your WebSocket server configuration
- Check server logs for errors
- Ensure proper WebSocket library setup

### ❌ Audio Tests Fail

- Check audio processing pipeline
- Verify μ-law encoding
- Test with known-good audio files

### ❌ Twilio Tests Fail

- Check Twilio configuration
- Verify TwiML setup
- Contact Twilio support

## 🔧 Advanced Debugging

### 1. Enable Detailed Logging

Add to your server:

```javascript
// Enable WebSocket debug logging
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3000 });

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket connected');

  ws.on('message', (data) => {
    console.log('📨 Received:', data.toString().substring(0, 100));
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });
});
```

### 2. Test with Known-Good Audio

Use the generated test files to verify your pipeline:

```bash
# Play test beep in Audacity
# Import: test_beep_8khz_mulaw.raw
# Settings: 8kHz, 8-bit, μ-law
```

### 3. Monitor Network Traffic

Use tools like Wireshark or browser dev tools to monitor WebSocket traffic.

## 📞 Getting Help

If all tests pass but you still don't hear audio:

1. **Check Twilio Console** - Look for Media Stream errors
2. **Contact Twilio Support** - Provide call SID and logs
3. **Test with Twilio TTS** - Verify basic Twilio functionality
4. **Check Network/Firewall** - Ensure Twilio can reach your server

## 📝 Test File Descriptions

### `test-audio-pipeline.js`

- **Purpose**: Comprehensive testing of the entire audio pipeline
- **Use**: When you want to test all aspects systematically
- **Output**: Multiple test files and detailed logs

### `test-minimal.js`

- **Purpose**: Quick test with minimal audio
- **Use**: For rapid verification of basic functionality
- **Output**: Simple 1kHz beep test

### `test-websocket-server.js`

- **Purpose**: Test WebSocket server without Twilio
- **Use**: To isolate WebSocket issues from Twilio issues
- **Output**: Connection and message handling verification

### `check-twilio-config.js`

- **Purpose**: Configuration validation
- **Use**: Before running other tests to ensure setup is correct
- **Output**: Configuration status and recommendations

## 🎯 Success Criteria

You know the pipeline is working when:

1. ✅ WebSocket tests pass
2. ✅ Audio files play correctly in Audacity
3. ✅ You hear the test beep on the phone
4. ✅ Twilio Console shows Media Stream events
5. ✅ Server logs show proper WebSocket communication

Once these tests pass, your Gemini AI integration should work correctly!
