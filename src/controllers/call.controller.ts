import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { Server } from 'socket.io';
import { CallStatusEnum, SessionStatusEnum } from '../constant';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { SpeechClient } from '@google-cloud/speech';

// Initialize Prisma and Twilio clients
const prisma = new PrismaClient();
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN, {
  lazyLoading: true,
});
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;

// Initialize Google Cloud clients
const ttsClient = new TextToSpeechClient();
const sttClient = new SpeechClient();

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

// Default workflows (fallback)
const defaultWorkflows = {
  group1: [
    {
      step_id: 1,
      question: 'Hello! Are you ? Please say yes or no.',
      malayalam: 'നിനക്ക് ഡാറ്റാ സയൻസ് താല്പര്യമുണ്ടോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
      yes_next: 2,
      no_next: null,
    },
    {
      step_id: 2,
      question: 'Great! When would you like to start? This week or next week?',
      malayalam: 'നല്ലത്! എപ്പോൾ തുടങ്ങണം? ഈ ആഴ്ച അതോ അടുത്ത ആഴ്ച?',
      yes_next: null,
      no_next: null,
    },
  ],
};

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

async function generateNextStep(
  currentStep: WorkflowStep,
  userResponse: string,
  workflow: WorkflowStep[],
): Promise<NextStepResponse> {
  try {
    const response = userResponse.toLowerCase().trim();
    let nextStepId: number | string | undefined;

    if (
      response.includes('yes') ||
      response.includes('അതെ') ||
      response.includes('okay') ||
      response.includes('sure')
    ) {
      nextStepId = currentStep.yes_next;
    } else if (
      response.includes('no') ||
      response.includes('ഇല്ല') ||
      response.includes('not interested')
    ) {
      nextStepId = currentStep.no_next;
    }

    if (nextStepId !== undefined) {
      const nextStep = workflow.find((s) => s.step_id === nextStepId);
      return { nextStep: nextStep || null, shouldEnd: !nextStep };
    }
    // Repeat current step on unclear response
    return { nextStep: currentStep, shouldEnd: false };
  } catch (error) {
    console.error('Error in generateNextStep:', error);
    return { nextStep: null, shouldEnd: true };
  }
}

// Generate audio using Google TTS
async function generateSpeech(text: string): Promise<string> {
  try {
    console.log('Generating speech for:', text);
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'ml-IN', ssmlGender: 'FEMALE' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9, pitch: 0.0 },
    });

    if (!response.audioContent) {
      throw new Error('No audio content received from TTS');
    }

    const audioPath = path.join(tempDir, `output_${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, response.audioContent, 'binary');
    console.log('Audio file created:', audioPath);

    return audioPath;
  } catch (error) {
    console.error('TTS Error:', error);
    const fallbackPath = path.join(tempDir, `fallback_${Date.now()}.txt`);
    fs.writeFileSync(fallbackPath, text);
    console.log('Created fallback text file:', fallbackPath);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

// Transcribe audio using Google STT
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    console.log('Transcribing audio, buffer size:', audioBuffer.length);
    const [response] = await sttClient.recognize({
      audio: { content: audioBuffer.toString('base64') },
      config: {
        encoding: 'MP3',
        languageCode: 'ml-IN',
        alternativeLanguageCodes: ['en-IN'],
        sampleRateHertz: 16000,
        enableAutomaticPunctuation: true,
      },
    });

    const transcript = response.results?.[0]?.alternatives?.[0]?.transcript || '';
    console.log('Transcription result:', transcript);
    return transcript;
  } catch (error) {
    console.error('STT Error:', error);
    return '';
  }
}

// Update fetchAudioBuffer to use Twilio Basic Auth
async function fetchAudioBuffer(url: string): Promise<Buffer> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
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

// Start a call session
const startCalls = asyncHandler(async (req: Request, res: Response) => {
  const { userId, groupId, groupType, contacts } = req.body;

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
    !twilioNumber
  ) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'Twilio configuration missing'));
  }

  if (!NGROK_BASE_URL || NGROK_BASE_URL.includes('your-ngrok-url')) {
    return res
      .status(500)
      .json(new ApiResponse(500, null, 'NGROK_BASE_URL not configured'));
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
            create: contacts.map(({ name, phoneNumber }) => ({
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
      contactsToCall = group.contacts.map((c) => ({
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
  } catch (error) {
    console.error('Error starting call session:', error);
    return res
      .status(500)
      .json(new ApiResponse(500, null, `Failed to start call session: ${error.message}`));
  }
});

// Initiate next call with 1s delay
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
    const io = req.app.get('io') as Server;
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
    await new Promise((res) => setTimeout(res, 1000));
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

    const io = req.app.get('io') as Server;
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
  console.log('voice handler triggered');

  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = req.query;

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    console.log(
      `Processing voice request for session: ${sessionId}, contact: ${contactId}`,
    );

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

    try {
      const questionText = currentStep.malayalam || currentStep.question;
      console.log(`Generating speech for: ${questionText}`);
      const audioPath = await generateSpeech(questionText);
      if (!fs.existsSync(audioPath))
        throw new Error(`Audio file not found at: ${audioPath}`);
      const audioUrl = `${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`;
      console.log(`Serving audio from: ${audioUrl}`);
      twiml.play(audioUrl);
    } catch (ttsError) {
      console.error('TTS failed, falling back to Twilio say:', ttsError);
      twiml.say(
        { voice: 'alice', language: 'en-IN' },
        currentStep.question || 'Hello, please respond to continue.',
      );
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

    console.log('TwiML response generated successfully');
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
    const { sessionId, contactId } = req.query;

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice response handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      return res.type('text/xml').send(twiml.toString());
    }

    console.log(
      `Processing voice response for session: ${sessionId}, contact: ${contactId}`,
    );
    console.log('Request body:', req.body);

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
      twiml.say('Sorry, no response was recorded. Please try speaking again.');
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

      if (currentStep) {
        try {
          const audioPath = await generateSpeech(
            currentStep.malayalam || currentStep.question,
          );
          twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
        } catch {
          twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
        }
        twiml.record({
          action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
          method: 'POST',
          maxLength: 30,
          playBeep: true,
          timeout: 10,
        });
      } else {
        twiml.hangup();
      }
      return res.type('text/xml').send(twiml.toString());
    }

    try {
      const audioBuffer = await fetchAudioBuffer(recordingUrl);
      const userResponse = await transcribeAudio(audioBuffer);

      if (!userResponse || userResponse.trim().length === 0) {
        twiml.say('Sorry, I could not understand your response. Please try again.');
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

        if (currentStep) {
          try {
            const audioPath = await generateSpeech(
              currentStep.malayalam || currentStep.question,
            );
            twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
          } catch {
            twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
          }
          twiml.record({
            action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
            method: 'POST',
            maxLength: 30,
            playBeep: true,
            timeout: 10,
          });
        } else {
          twiml.hangup();
        }
        return res.type('text/xml').send(twiml.toString());
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

      const { nextStep, shouldEnd } = await generateNextStep(
        currentStep,
        userResponse,
        workflow,
      );

      if (shouldEnd) {
        try {
          const audioPath = await generateSpeech(
            nextStep?.question || 'Thank you for your time. Goodbye.',
          );
          twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
        } catch {
          twiml.say(
            { voice: 'alice', language: 'en-IN' },
            nextStep?.question || 'Thank you for your time. Goodbye.',
          );
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
      } else if (nextStep) {
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
        try {
          const audioPath = await generateSpeech(nextStep.malayalam || nextStep.question);
          twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
        } catch {
          twiml.say({ voice: 'alice', language: 'en-IN' }, nextStep.question);
        }
        twiml.record({
          action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
          method: 'POST',
          maxLength: 30,
          playBeep: true,
          timeout: 10,
        });
      } else {
        twiml.say('Sorry, an unexpected error occurred. Goodbye.');
        twiml.hangup();
      }
      res.type('text/xml').send(twiml.toString());
    } catch (transcriptionError) {
      console.error('Error in transcription/processing:', transcriptionError);
      twiml.say('Sorry, I had trouble processing your response. Please try again.');
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

      if (currentStep) {
        try {
          const audioPath = await generateSpeech(
            currentStep.malayalam || currentStep.question,
          );
          twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
        } catch {
          twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
        }
        twiml.record({
          action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
          method: 'POST',
          maxLength: 30,
          playBeep: true,
          timeout: 10,
        });
      } else {
        twiml.hangup();
      }
      res.type('text/xml').send(twiml.toString());
    }
  } catch (error) {
    console.error('Error in voice response handler:', error);
    twiml.say('Sorry, there was a technical error. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// Optional: Add a recording status callback handler
const recordingStatusHandler = asyncHandler(async (req: Request, res: Response) => {
  console.log('Recording status callback:', req.body);
  res.status(200).send('OK');
});

// Stop a call session
const stopSession = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.body;
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

  const io = req.app.get('io') as Server;
  io.emit('callStatusUpdate', {
    sessionId: numericSessionId,
    status: SessionStatusEnum.STOPPED,
    currentIndex: session.current_index,
    totalCalls: session.total_calls,
    currentContact: null,
    attempt: 0,
  });

  return res.status(200).json(new ApiResponse(200, null, 'Session stopped'));
});

// Get call history
const getCallHistory = asyncHandler(async (req: Request, res: Response) => {
  const { sessionId } = req.query;
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
  const { CallSid, CallStatus, CallDuration, AnsweredBy } = req.body;
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

  let mappedStatus,
    isSuccessful = false;
  switch (CallStatus) {
    case 'completed':
      mappedStatus = CallStatusEnum.ACCEPTED;
      isSuccessful = true;
      break;
    case 'no-answer':
      mappedStatus = CallStatusEnum.MISSED;
      break;
    case 'busy':
      mappedStatus = CallStatusEnum.DECLINED;
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
      answered_at: AnsweredBy ? new Date() : null,
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

  const io = req.app.get('io') as Server;
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

  res.sendStatus(200);
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
