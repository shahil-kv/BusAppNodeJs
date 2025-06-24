import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { Server as SocketIOServer } from 'socket.io';
import { CallStatusEnum, SessionStatusEnum } from '../constant';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { createClient } from '@deepgram/sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import crypto from 'crypto';
import { Readable } from 'stream';

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
  lazyLoading: true,
});
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;

// Initialize Deepgram for STT
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Initialize ElevenLabs for TTS
// See: https://www.npmjs.com/package/@elevenlabs/elevenlabs-js
const elevenLabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY || 'your-elevenlabs-api-key',
});

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

// Default workflow
const defaultWorkflows = {
  group1: [
    {
      step_id: 1,
      question: 'Hello! Are you interested in data science? Please say yes or no.',
      malayalam: 'നിനക്ക് ഡാറ്റാ സയൻസ് താല്പര്യമുണ്ടോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
      yes_next: 2,
      no_next: 3,
    },
    {
      step_id: 2,
      question: 'Great! When would you like to start? This week or next week?',
      malayalam: 'നല്ലത്! എപ്പോൾ തുടങ്ങണം? ഈ ആഴ്ച അതോ അടുത്ത ആഴ്ച?',
      yes_next: 4,
      no_next: 5,
    },
    {
      step_id: 3,
      question: 'Thank you for your time. Have a great day!',
      malayalam: 'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നല്ല ദിവസം!',
      yes_next: null,
      no_next: null,
    },
    {
      step_id: 4,
      question: 'Perfect! We will contact you this week. Thank you!',
      malayalam: 'മികച്ചത്! ഞങ്ങൾ ഈ ആഴ്ച നിങ്ങളെ ബന്ധപ്പെടും. നന്ദി!',
      yes_next: null,
      no_next: null,
    },
    {
      step_id: 5,
      question: 'No problem! We will contact you next week. Thank you!',
      malayalam: 'കുഴപ്പമില്ല! ഞങ്ങൾ അടുത്ത ആഴ്ച നിങ്ങളെ ബന്ധപ്പെടും. നന്ദി!',
      yes_next: null,
      no_next: null,
    },
  ],
};

// System prompt for Gemini
const malayalamPhrases = {
  yes: ['അതെ', 'ഉണ്ട്', 'വേണം'],
  no: ['ഇല്ല', 'ellaa', 'വേണ്ട', 'താല്പര്യമില്ല'],
  thisWeek: ['ഈ ആഴ്ച'],
  nextWeek: ['അടുത്ത ആഴ്ച'],
};

const systemPrompt = `
You are a conversational AI agent for a call system. Your role is to guide users through a predefined workflow while understanding natural language responses in English and Malayalam. The workflow is as follows:

Workflow Steps:
${JSON.stringify(defaultWorkflows.group1, null, 2)}

Common Malayalam phrases:
Yes: ${malayalamPhrases.yes.join(', ')}
No: ${malayalamPhrases.no.join(', ')}
This week: ${malayalamPhrases.thisWeek.join(', ')}
Next week: ${malayalamPhrases.nextWeek.join(', ')}

Instructions:
- Ask questions based on the workflow steps, starting from step_id 1.
- Understand user responses in English (e.g., "yes", "no", "this week") and Malayalam (e.g., "അതെ" for yes, "ഇല്ല" or "ellaa" for no).
- If the response is unclear, politely ask for clarification in the user's language (e.g., "Could you please say yes or no clearly?" or "ദയവായി വ്യക്തമായി അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।").
- Respond naturally, like a human, in Malayalam or English based on user input.
- Keep responses concise and conversational.
- Move to the next step based on the user's response (yes_next or no_next).
- If no next step exists, end the conversation politely with "Thank you for your time. Have a great day!" or its Malayalam equivalent.
- Return responses in JSON format: { nextStep: WorkflowStep | null, shouldEnd: boolean }.
`;

// Interface for workflow steps
interface WorkflowStep {
  step_id: number | string;
  question: string;
  malayalam?: string;
  yes_next?: number | string | null;
  no_next?: number | string | null;
}

interface NextStepResponse {
  nextStep: WorkflowStep | null;
  shouldEnd: boolean;
}

// Helper to parse current_step as JSON object
function parseCurrentStep(current_step): { workflow_id; step_id } | null {
  if (!current_step) return null;
  if (typeof current_step === 'string') {
    try {
      return JSON.parse(current_step);
    } catch {
      return null;
    }
  }
  if (typeof current_step === 'object' && current_step.step_id !== undefined) {
    return current_step;
  }
  return null;
}

// Helper to fetch workflow steps from DB or fallback
async function getWorkflowSteps(group): Promise<WorkflowStep[]> {
  if (group?.workflows?.steps) {
    try {
      const steps = Array.isArray(group.workflows.steps)
        ? group.workflows.steps
        : JSON.parse(group.workflows.steps);
      return steps.map((step) => ({
        step_id: step.step_id || step.id,
        question: step.question,
        malayalam: step.malayalam,
        yes_next: step.yes_next || step.branch?.yes,
        no_next: step.no_next || step.branch?.no,
      }));
    } catch (e) {
      console.error('Failed to parse workflow steps from DB:', e);
    }
  }
  return defaultWorkflows['group1'];
}

// Generate next step using Gemini API
async function generateNextStep(
  currentStep: WorkflowStep,
  userResponse: string,
  workflow: WorkflowStep[],
): Promise<NextStepResponse> {
  try {
    const prompt = `
${systemPrompt}

Current Step: ${JSON.stringify(currentStep)}
User Response: ${userResponse}
Workflow: ${JSON.stringify(workflow)}
Determine the next step based on the user's response. Return a JSON object with { nextStep, shouldEnd }.
`;

    // Dynamic import for Google GenAI (ES Module)
    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || 'your-gemini-api-key',
    });

    const response = await genAI.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const result = JSON.parse(text);
    return result;
  } catch (error) {
    console.error('Error with Gemini API:', error);
    // Fallback to original logic
    const response = userResponse.toLowerCase().trim();
    let nextStepId: number | string | undefined;
    const yesKeywords = [
      'yes',
      'yeah',
      'yep',
      'sure',
      'okay',
      'ok',
      ...malayalamPhrases.yes,
    ];
    const noKeywords = ['no', 'nope', 'not', ...malayalamPhrases.no];

    const isYesResponse = yesKeywords.some((keyword) => response.includes(keyword));
    const isNoResponse = noKeywords.some((keyword) => response.includes(keyword));

    if (currentStep.step_id === 2) {
      if (
        malayalamPhrases.thisWeek.some((kw) => response.includes(kw)) ||
        response.includes('this week')
      ) {
        nextStepId = currentStep.yes_next;
      } else if (
        malayalamPhrases.nextWeek.some((kw) => response.includes(kw)) ||
        response.includes('next week')
      ) {
        nextStepId = currentStep.no_next;
      }
    } else {
      nextStepId = isYesResponse
        ? currentStep.yes_next
        : isNoResponse
        ? currentStep.no_next
        : undefined;
    }

    if (!nextStepId) {
      const clarificationStep: WorkflowStep = {
        step_id: `${currentStep.step_id}_clarify`,
        question: "I didn't understand your response. Please say yes or no clearly.",
        malayalam:
          'നിങ്ങളുടെ ഉത്തരം മനസ്സിലായില്ല. ദയവായി വ്യക്തമായി അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
        yes_next: currentStep.yes_next,
        no_next: currentStep.no_next,
      };
      return { nextStep: clarificationStep, shouldEnd: false };
    }

    const nextStep = workflow.find((s) => s.step_id === nextStepId);
    return { nextStep: nextStep || null, shouldEnd: !nextStep };
  }
}

// Hash function for caching TTS
function hash(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

// Generate audio using ElevenLabs with caching
async function generateSpeech(text: string): Promise<string> {
  try {
    const audioPath = path.join(tempDir, `tts_${hash(text)}.mp3`);
    if (fs.existsSync(audioPath)) {
      return audioPath;
    }

    // Use a real ElevenLabs voice ID - you can get this from your ElevenLabs dashboard
    // For now, using a placeholder - replace with your actual voice ID
    // To get voice IDs: https://elevenlabs.io/voice-library or API: GET /v1/voices
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
    const audioBuffer = Buffer.concat(chunks as any);
    // Fix Buffer type error for fs.writeFileSync
    fs.writeFileSync(audioPath, audioBuffer as any);
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

// Helper to get io from req.app
function getIO(req: Request): SocketIOServer | undefined {
  return req.app?.get('io');
}

// Helper to get body/query with fallback for any type
function getBody<T = unknown>(req: Request): T {
  return req.body ? (req.body as T) : ({} as T);
}
function getQuery<T = unknown>(req: Request): T {
  return req.query ? (req.query as T) : ({} as T);
}

// Start a call session
const startCalls = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId, groupType, contacts } = getBody<any>(req);

  if (!userId) {
    return res.status(400).json(new ApiResponse(400, null, 'User ID is required'));
  }

  const numericUserId = parseInt(userId, 10);
  const numericGroupId = groupId != null ? parseInt(groupId, 10) : null;

  if (isNaN(numericUserId) || (groupId != null && isNaN(numericGroupId))) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid ID format'));
  }

  if (!contacts && !groupId) {
    return res.status(400).json(new ApiResponse(400, null, 'Contacts or group required'));
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !twilioNumber ||
    !NGROK_BASE_URL
  ) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Required environment variables missing'));
  }

  let contactsToCall: { id?: string; name: string; phoneNumber: string }[] = [];
  let targetGroupId: number | null = numericGroupId;
  let group = null;

  try {
    if (numericGroupId === 0 && groupType === 'MANUAL') {
      group = await prisma.groups.create({
        data: {
          user_id: numericUserId,
          group_name: `Manual Call - ${new Date().toISOString()}`,
          group_type: 'MANUAL',
          description: 'Manual call group',
          contacts: {
            create: contacts.map(({ name, phoneNumber }: any) => ({
              name,
              phone_number: phoneNumber,
            })),
          },
        },
        include: { contacts: true, workflows: true },
      });
    } else if (numericGroupId && numericGroupId > 0) {
      group = await prisma.groups.findUnique({
        where: { id: numericGroupId },
        include: { contacts: true, workflows: true },
      });
      if (!group) {
        return res.status(404).json(new ApiResponse(404, null, 'Group not found'));
      }
    }

    if (group) {
      targetGroupId = group.id;
      contactsToCall = group.contacts.map((c: any) => ({
        id: c.id.toString(),
        name: c.name,
        phoneNumber: c.phone_number,
      }));
    } else {
      contactsToCall = contacts;
    }

    const user = await prisma.users.findUnique({ where: { id: numericUserId } });
    if (!user) {
      return res.status(404).json(new ApiResponse(404, null, 'User not found'));
    }

    const isPremium = user.is_premium ?? false;
    const contactLimit = isPremium ? 500 : 50;
    if (contactsToCall.length > contactLimit) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, `Contact limit exceeded: ${contactLimit}`));
    }

    const session = await prisma.call_session.create({
      data: {
        user_id: numericUserId,
        group_id: targetGroupId,
        contacts: contactsToCall,
        status: SessionStatusEnum.IN_PROGRESS,
        total_calls: contactsToCall.length,
        successful_calls: 0,
        failed_calls: 0,
        current_index: 0,
        updated_at: new Date(),
      },
    });

    const workflow = await getWorkflowSteps(group);
    await prisma.call_history.createMany({
      data: contactsToCall.map((contact) => ({
        session_id: session.id,
        user_id: numericUserId,
        group_id: targetGroupId,
        contact_id: contact.id ? parseInt(contact.id) : null,
        contact_phone: contact.phoneNumber,
        status: CallStatusEnum.PENDING,
        attempt: 1,
        max_attempts: 3,
        current_step:
          workflow.length > 0
            ? JSON.stringify({
                workflow_id: group?.workflows?.id || null,
                step_id: workflow[0].step_id,
              })
            : null,
        called_at: new Date(),
        updated_at: new Date(),
      })),
    });

    await initiateNextCall(session.id, req, workflow);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { sessionId: session.id },
          'Call session started successfully',
        ),
      );
  } catch (error: any) {
    console.error('Error starting call session:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, `Failed to start call session: ${error.message}`));
  }
});

// Initiate next call
const initiateNextCall = async (
  sessionId: number,
  req: Request,
  workflow: WorkflowStep[],
) => {
  const session = await prisma.call_session.findUnique({
    where: { id: sessionId },
    include: { call_history: true },
  });
  if (!session || session.status !== SessionStatusEnum.IN_PROGRESS) return;

  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentIndex = session.current_index || 0;
  if (currentIndex >= contacts.length) {
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { status: SessionStatusEnum.COMPLETED, updated_at: new Date() },
    });
    const io = getIO(req);
    io.emit('callStatusUpdate', {
      sessionId,
      status: SessionStatusEnum.COMPLETED,
      currentIndex,
      totalCalls: session.total_calls,
      currentContact: null,
      attempt: 0,
    });
    return;
  }

  const contact = contacts[currentIndex];
  const callHistory = session.call_history.find(
    (ch) =>
      ch.contact_phone === contact.phoneNumber && ch.status === CallStatusEnum.PENDING,
  );
  if (!callHistory) {
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { current_index: { increment: 1 }, updated_at: new Date() },
    });
    await new Promise((res) => setTimeout(res, 500)); // Reduced delay for speed
    await initiateNextCall(sessionId, req, workflow);
    return;
  }

  try {
    const call = await client.calls.create({
      url: `${NGROK_BASE_URL}/voice-update?sessionId=${sessionId}&contactId=${callHistory.contact_id}`,
      to: contact.phoneNumber,
      from: twilioNumber,
      statusCallback: `${NGROK_BASE_URL}/call-status`,
      statusCallbackMethod: 'POST',
    });

    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        call_sid: call.sid,
        status: CallStatusEnum.IN_PROGRESS,
        called_at: new Date(),
        updated_at: new Date(),
      },
    });

    const io = getIO(req);
    io.emit('callStatusUpdate', {
      sessionId,
      status: session.status,
      currentIndex: session.current_index,
      totalCalls: session.total_calls,
      currentContact: { name: contact.name, phoneNumber: contact.phoneNumber },
      attempt: callHistory.attempt,
    });
  } catch (error) {
    console.error(`Error initiating call to ${contact.phoneNumber}:`, error);
    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        status: CallStatusEnum.FAILED,
        error_message: error.message,
        updated_at: new Date(),
      },
    });
    await prisma.call_session.update({
      where: { id: sessionId },
      data: { failed_calls: { increment: 1 }, updated_at: new Date() },
    });
    await initiateNextCall(sessionId, req, workflow);
  }
};

// Handle voice interaction
const voiceHandler = asyncHandler(async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = getQuery<any>(req);

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const session = await prisma.call_session.findUnique({
      where: { id: Number(sessionId) },
      include: { call_history: true },
    });

    if (!session) {
      console.error('Session not found:', sessionId);
      twiml.say('Sorry, session not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const callHistory = session.call_history.find(
      (ch) => ch.contact_id === Number(contactId),
    );
    if (!callHistory) {
      console.error('Call history not found for contact:', contactId);
      twiml.say('Sorry, call record not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const group = session.group_id
      ? await prisma.groups.findUnique({
          where: { id: session.group_id },
          include: { workflows: true },
        })
      : null;
    const workflow = await getWorkflowSteps(group);
    const currentStepObj = parseCurrentStep(callHistory.current_step);
    const currentStep = workflow.find(
      (s) => s.step_id === (currentStepObj?.step_id || 1),
    );

    if (!currentStep) {
      console.error('No step found for step_id:', currentStepObj?.step_id);
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const audioPath = await generateSpeech(questionText);
      if (!fs.existsSync(audioPath))
        throw new Error(`Audio file not found at: ${audioPath}`);
      const audioUrl = `${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`;
      twiml.play(audioUrl);
    } catch (error) {
      console.error('TTS failed, falling back to Twilio say:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }

    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 10,
      transcribe: false,
      recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
      recordingStatusCallbackMethod: 'POST',
    });

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in voice handler:', error);
    twiml.say('Sorry, there was a technical error. Please try again later. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// Handle voice response
const voiceResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = getQuery<any>(req);
    console.log(`=== Voice Response Handler Started ===`);
    console.log(`Session ID: ${sessionId}, Contact ID: ${contactId}`);

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice response handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const session = await prisma.call_session.findUnique({
      where: { id: Number(sessionId) },
      include: { call_history: true },
    });

    if (!session) {
      console.error('Session not found:', sessionId);
      twiml.say('Sorry, session not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const callHistory = session.call_history.find(
      (ch) => ch.contact_id === Number(contactId),
    );
    if (!callHistory) {
      console.error('Call history not found for contact:', contactId);
      twiml.say('Sorry, call record not found. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    const recordingUrl = req.body.RecordingUrl;
    if (!recordingUrl) {
      console.error('No recording URL provided');
      return await handleNoResponse(req, res, session, callHistory, twiml);
    }

    const audioBuffer = await fetchAudioBuffer(recordingUrl);
    const userResponse = await transcribeAudio(audioBuffer);
    if (!userResponse || userResponse.trim().length === 0) {
      console.error('Transcription returned empty result');
      return await handleNoResponse(req, res, session, callHistory, twiml);
    }

    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: { transcription: userResponse, updated_at: new Date() },
    });

    const group = session.group_id
      ? await prisma.groups.findUnique({
          where: { id: session.group_id },
          include: { workflows: true },
        })
      : null;
    const workflow = await getWorkflowSteps(group);
    const currentStepObj = parseCurrentStep(callHistory.current_step);
    const currentStep = workflow.find(
      (s) => s.step_id === (currentStepObj?.step_id || 1),
    );

    if (!currentStep) {
      console.error('Current step not found in workflow');
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const { nextStep, shouldEnd } = await generateNextStep(
      currentStep,
      userResponse,
      workflow,
    );

    if (shouldEnd || !nextStep) {
      const endMessage = 'Thank you for your time. Have a great day!';
      const endMessageMalayalam = 'നിങ്ങളുടെ സമയത്തിന് നന്ദി. നല്ല ദിവസം!';
      try {
        const audioPath = await generateSpeech(endMessageMalayalam);
        twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
      } catch (error) {
        console.error('TTS failed for end message:', error);
        twiml.say({ voice: 'alice', language: 'en-IN' }, endMessage);
      }
      twiml.hangup();

      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          status: CallStatusEnum.ACCEPTED,
          ended_at: new Date(),
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.call_history.update({
        where: { id: callHistory.id },
        data: {
          current_step: JSON.stringify({
            workflow_id: group?.workflows?.id || null,
            step_id: nextStep.step_id,
          }),
          updated_at: new Date(),
        },
      });

      const questionText = nextStep.malayalam || nextStep.question;
      try {
        const audioPath = await generateSpeech(questionText);
        twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
      } catch (error) {
        console.error('TTS failed:', error);
        twiml.say({ voice: 'alice', language: 'en-IN' }, nextStep.question);
      }

      twiml.record({
        action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
        method: 'POST',
        maxLength: 30,
        playBeep: true,
        timeout: 10,
        transcribe: false,
      });
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in voice response handler:', error);
    twiml.say('Sorry, there was a technical error. Please try again later. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// Handle no response
async function handleNoResponse(
  req: Request,
  res: Response,
  session: any,
  callHistory: any,
  twiml: any,
) {
  console.log('Handling no response case');

  const group = session.group_id
    ? await prisma.groups.findUnique({
        where: { id: session.group_id },
        include: { workflows: true },
      })
    : null;

  const workflow = await getWorkflowSteps(group);
  const currentStepObj = parseCurrentStep(callHistory.current_step);
  const currentStep = workflow.find((s) => s.step_id === (currentStepObj?.step_id || 1));

  if (currentStep) {
    twiml.say("I didn't hear your response. Let me repeat the question.");
    try {
      const responseText = currentStep.malayalam || currentStep.question;
      const audioPath = await generateSpeech(responseText);
      twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
    } catch (error) {
      console.error('TTS failed in handleNoResponse:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }

    const { sessionId, contactId } = getQuery<any>(req);
    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 10,
      transcribe: false,
    });
  } else {
    twiml.say('Sorry, there was an error. Goodbye.');
    twiml.hangup();
  }

  return res.type('text/xml').send(twiml.toString());
}

// Recording status callback
const recordingStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  console.log('Recording status callback:', req.body);
  res.status(200).send('OK');
});

// Stop a call session
const stopSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = getBody<any>(req);
  const numericSessionId = parseInt(sessionId, 10);
  if (isNaN(numericSessionId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid session ID'));
  }

  const session = await prisma.call_session.findUnique({
    where: { id: numericSessionId },
  });
  if (!session) {
    return res.status(404).json(new ApiResponse(404, null, 'Session not found'));
  }

  const activeCalls = await prisma.call_history.findMany({
    where: { session_id: numericSessionId, status: CallStatusEnum.IN_PROGRESS },
  });

  for (const call of activeCalls) {
    if (call.call_sid) {
      try {
        await client.calls(call.call_sid).update({ status: 'completed' });
        await prisma.call_history.update({
          where: { id: call.id },
          data: {
            status: CallStatusEnum.DECLINED,
            ended_at: new Date(),
            updated_at: new Date(),
          },
        });
      } catch (error) {
        console.error(`Failed to terminate call ${call.call_sid}:`, error);
      }
    }
  }

  await prisma.call_session.update({
    where: { id: numericSessionId },
    data: { status: SessionStatusEnum.STOPPED, updated_at: new Date() },
  });

  const io = getIO(req);
  io.emit('callStatusUpdate', {
    sessionId: numericSessionId,
    status: SessionStatusEnum.STOPPED,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: null,
    attempt: 0,
  });

  return res.status(200).json(new ApiResponse(200, null, 'Session stopped successfully'));
});

// Get call history
const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = getQuery<any>(req);
  const numericSessionId = parseInt(sessionId as string, 10);
  if (isNaN(numericSessionId)) {
    return res.status(400).json(new ApiResponse(400, null, 'Invalid session ID'));
  }

  const history = await prisma.call_history.findMany({
    where: { session_id: numericSessionId },
    include: { contacts: true },
  });

  return res.status(200).json(new ApiResponse(200, history, 'Call history retrieved'));
});

// Handle call status updates
const callStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  const { CallSid, CallStatus, CallDuration } = getBody<any>(req);
  if (!req.body || Object.keys(req.body).length === 0) {
    console.error('Empty body in callStatusHandler');
    return res.status(400).json({ message: 'Empty body received' });
  }

  const callHistory = await prisma.call_history.findFirst({
    where: { call_sid: CallSid },
    include: { call_session: true },
  });

  if (!callHistory || !callHistory.call_session) {
    console.warn(`No call_history for CallSid: ${CallSid}`);
    return res.sendStatus(200);
  }

  let mappedStatus = '';
  let isSuccessful = false;
  switch (CallStatus) {
    case 'completed':
      mappedStatus = CallStatusEnum.ACCEPTED;
      isSuccessful = true;
      break;
    case 'failed':
      mappedStatus = CallStatusEnum.FAILED;
      break;
    default:
      mappedStatus = CallStatusEnum.FAILED;
  }

  await prisma.call_history.update({
    where: { id: callHistory.id },
    data: {
      status: mappedStatus,
      ended_at: new Date(),
      duration: CallDuration ? parseInt(CallDuration) : null,
      updated_at: new Date(),
    },
  });

  await prisma.call_session.update({
    where: { id: callHistory.session_id },
    data: {
      successful_calls: { increment: isSuccessful ? 1 : 0 },
      failed_calls: { increment: !isSuccessful ? 1 : 0 },
      updated_at: new Date(),
    },
  });

  const session = callHistory.call_session;
  const contacts = session.contacts as {
    id?: string;
    name: string;
    phoneNumber: string;
  }[];
  const currentContact = contacts[session.current_index] || null;

  const io = getIO(req);
  io.emit('callStatusUpdate', {
    sessionId: callHistory.session_id,
    status: session.status,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: currentContact
      ? { name: currentContact.name, phoneNumber: currentContact.phoneNumber }
      : null,
    attempt: callHistory.attempt,
  });

  if (session.status === SessionStatusEnum.IN_PROGRESS) {
    await prisma.call_session.update({
      where: { id: callHistory.session_id },
      data: { current_index: { increment: 1 }, updated_at: new Date() },
    });
    const group = session.group_id
      ? await prisma.groups.findUnique({
          where: { id: session.group_id },
          include: { workflows: true },
        })
      : null;
    const workflow = await getWorkflowSteps(group);
    await initiateNextCall(callHistory.session_id, req, workflow);
  }

  if (session.current_index >= session.total_calls - 1) {
    await prisma.call_session.update({
      where: { id: callHistory.session_id },
      data: { status: SessionStatusEnum.COMPLETED, updated_at: new Date() },
    });
    io.emit('callStatusUpdate', {
      sessionId: callHistory.session_id,
      status: SessionStatusEnum.COMPLETED,
      currentIndex: session.current_index + 1,
      totalCalls: session.total_calls,
      currentContact: null,
      attempt: 0,
    });
  }

  // res.sendStatus(200);
});

export {
  startCalls,
  stopSession,
  getCallHistory,
  voiceHandler,
  voiceResponseHandler,
  callStatusHandler,
  recordingStatusHandler,
};
