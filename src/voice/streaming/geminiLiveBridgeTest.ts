import { GeminiLiveService } from '../../ai/geminiLive.service';
import { GeminiLiveBridge } from './geminiLiveBridge';
import { logger } from '../../utils/logger';
import { AudioProcessor } from './audioProcessor';
import WebSocket from 'ws';

// Mock WebSocket that just logs messages
class MockWebSocket {
    readyState = WebSocket.OPEN;
    sentMessages: any[] = [];
    send(data: any, cb?: (err?: Error) => void) {
        this.sentMessages.push(data);
        logger.log('[MockWebSocket] Sent:', typeof data === 'string' ? data.substring(0, 200) : data);
        if (cb) cb();
    }
    close() {
        logger.log('[MockWebSocket] Closed');
    }
}

async function main() {
    // Set up API key (replace with your actual Gemini API key or use env var)
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY_HERE';
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        logger.error('Please set GEMINI_API_KEY in your environment.');
        process.exit(1);
    }

    // Initialize AudioProcessor (required for bridge)
    await AudioProcessor.initialize();

    // Create Gemini service and bridge
    const geminiService = new GeminiLiveService(GEMINI_API_KEY);
    const ws = new MockWebSocket() as any;
    const bridge = new GeminiLiveBridge(geminiService, null, ws);

    // Minimal Malayalam prompt
    const minimalPrompt = 'നമസ്കാരം! ഞാൻ ഒരു ടെസ്റ്റ് ബോട്ട് ആണ്. നിങ്ങൾക്ക് എങ്ങനെ സഹായിക്കാം?';

    logger.log('--- Starting GeminiLiveBridge test session ---');
    await bridge.startCall(minimalPrompt, []);

    // Wait a bit to see if audio is received
    logger.log('Waiting 5 seconds for Gemini audio...');
    await new Promise(res => setTimeout(res, 5000));

    logger.log('--- Ending GeminiLiveBridge test session ---');
    await bridge.endCall();

    // Clean up
    AudioProcessor.destroy();
    logger.log('Test complete. Check logs for Gemini audio events and errors.');
}

if (require.main === module) {
    main().catch(err => {
        logger.error('Test failed:', err);
        process.exit(1);
    });
} 