// Fetch audio buffer with Twilio Basic Auth
async function fetchAudioBuffer(url: string): Promise<Buffer> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced timeout for speed
    const auth = Buffer.from(
      `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
    ).toString('base64');
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TwilioRecordingBot/1.0',
        Authorization: `Basic ${auth}`,
      },
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error('Error fetching audio buffer:', error);
    throw new Error(`Failed to fetch audio: ${error.message}`);
  }
}
export { fetchAudioBuffer };
