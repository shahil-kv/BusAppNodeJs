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

// Group-specific workflows
const defaultWorkflows = {
  group1: [
    {
      step: 1,
      question: 'Hello! Are you interested in Data Science? Please say yes or no.',
      malayalam: 'നിനക്ക് ഡാറ്റാ സയൻസ് താല്പര്യമുണ്ടോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
    },
    {
      step: 2,
      question: 'Great! When would you like to start? This week or next week?',
      malayalam: 'നല്ലത്! എപ്പോൾ തുടങ്ങണം? ഈ ആഴ്ച അതോ അടുത്ത ആഴ്ച?',
    },
  ],
  group2: [
    {
      step: 1,
      question: 'Hello! Are you interested in Web Development? Please say yes or no.',
      malayalam:
        'നിനക്ക് വെബ് ഡെവലപ്മെന്റ് താല്പര്യമുണ്ടോ? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।',
    },
    {
      step: 2,
      question: 'Excellent! Would you like more details about our course?',
      malayalam: 'നല്ലത്! കൂടുതൽ വിവരങ്ങൾ വേണോ?',
    },
  ],
};

// Interface for workflow steps
interface WorkflowStep {
  step: number;
  question: string;
  malayalam?: string;
}

// Interface for generateNextStep response
interface NextStepResponse {
  nextQuestion: string;
  shouldEnd: boolean;
  nextStepIndex: number;
}

// Improved Gemini integration (placeholder for actual API)
async function generateNextStep(
  currentStep: string,
  userResponse: string,
  workflow: WorkflowStep[],
): Promise<NextStepResponse> {
  try {
    const response = userResponse.toLowerCase();
    const currentStepIndex = workflow.findIndex(
      (step) => step.question === currentStep || step.malayalam === currentStep,
    );

    // Handle positive responses
    if (
      response.includes('yes') ||
      response.includes('അതെ') ||
      response.includes('okay') ||
      response.includes('sure')
    ) {
      if (currentStepIndex >= 0 && currentStepIndex < workflow.length - 1) {
        const nextStep = workflow[currentStepIndex + 1];
        return {
          nextQuestion: nextStep.malayalam || nextStep.question,
          shouldEnd: false,
          nextStepIndex: currentStepIndex + 1,
        };
      } else {
        return {
          nextQuestion: 'Thank you for your time! We will contact you soon. നന്ദി!',
          shouldEnd: true,
          nextStepIndex: -1,
        };
      }
    }
    // Handle negative responses
    else if (
      response.includes('no') ||
      response.includes('ഇല്ല') ||
      response.includes('not interested')
    ) {
      return {
        nextQuestion: 'Thank you for your time. Have a great day! നന്ദി, നല്ല ദിവസം!',
        shouldEnd: true,
        nextStepIndex: -1,
      };
    }
    // Handle unclear responses
    else {
      return {
        nextQuestion:
          "I didn't understand. Could you please say yes or no? അതെ അല്ലെങ്കിൽ ഇല്ല എന്ന് പറയൂ।",
        shouldEnd: false,
        nextStepIndex: currentStepIndex,
      };
    }
  } catch (error) {
    console.error('Error in generateNextStep:', error);
    return {
      nextQuestion: 'Sorry, there was an error. Goodbye. നന്ദി!',
      shouldEnd: true,
      nextStepIndex: -1,
    };
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

// Fetch audio buffer with timeout
async function fetchAudioBuffer(url: string): Promise<Buffer> {
  try {
    console.log('Fetching audio from:', url);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TwilioRecordingBot/1.0' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log('Audio buffer fetched, size:', buffer.length);
    return buffer;
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
        include: { contacts: true },
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
        current_step: 0,
        called_at: new Date(),
        updated_at: new Date(),
      })),
    });

    const workflow = group?.workflows?.[0] || defaultWorkflows['group1'];
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

// Initiate the next call
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
  console.log('adhil');

  const twiml = new twilio.twiml.VoiceResponse();
  try {
    console.log('asdfasdf');

    const { sessionId, contactId } = req.query;
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

    const groupKey = session.group_id ? `group${session.group_id}` : 'group1';
    const workflow = defaultWorkflows[groupKey] || defaultWorkflows['group1'];
    const currentStepIndex = callHistory.current_step || 0;
    const currentStep = workflow[currentStepIndex];

    if (!currentStep) {
      console.error('No step found for index:', currentStepIndex);
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    try {
      const questionText = currentStep.malayalam || currentStep.question;
      const audioPath = await generateSpeech(questionText);
      const audioUrl = `${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`;
      twiml.play(audioUrl);
    } catch (ttsError) {
      console.error('TTS failed, falling back to Twilio say:', ttsError);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }

    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 10,
      transcribe: false,
    });

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in voice handler:', error);
    twiml.say('Sorry, there was an error. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// Handle voice response
const voiceResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  console.log('voice response handler');

  // const twiml = new twilio.twiml.VoiceResponse();
  // try {
  //   const { sessionId, contactId } = req.query;
  //   if (!sessionId || !contactId) {
  //     console.error('Missing sessionId or contactId in voice response handler');
  //     twiml.say('Sorry, there was an error. Goodbye.');
  //     return res.type('text/xml').send(twiml.toString());
  //   }

  //   const session = await prisma.call_session.findUnique({
  //     where: { id: Number(sessionId) },
  //     include: { call_history: true },
  //   });

  //   if (!session) {
  //     console.error('Session not found:', sessionId);
  //     twiml.say('Sorry, session not found. Goodbye.');
  //     return res.type('text/xml').send(twiml.toString());
  //   }

  //   const callHistory = session.call_history.find(
  //     (ch) => ch.contact_id === Number(contactId),
  //   );

  //   if (!callHistory) {
  //     console.error('Call history not found for contact:', contactId);
  //     twiml.say('Sorry, call record not found. Goodbye.');
  //     return res.type('text/xml').send(twiml.toString());
  //   }

  //   const recordingUrl = req.body.RecordingUrl;
  //   if (!recordingUrl) {
  //     console.error('No recording URL provided');
  //     twiml.say('Sorry, no response recorded. Goodbye.');
  //     twiml.hangup();
  //     return res.type('text/xml').send(twiml.toString());
  //   }

  //   const audioBuffer = await fetchAudioBuffer(recordingUrl);
  //   const userResponse = await transcribeAudio(audioBuffer);

  //   await prisma.call_history.update({
  //     where: { id: callHistory.id },
  //     data: { transcription: userResponse, updated_at: new Date() },
  //   });

  //   const groupKey = session.group_id ? `group${session.group_id}` : 'group1';
  //   const workflow = defaultWorkflows[groupKey] || defaultWorkflows['group1'];
  //   const currentStepIndex = callHistory.current_step || 0;
  //   const currentStep = workflow[currentStepIndex] || workflow[0];

  //   const { nextQuestion, shouldEnd, nextStepIndex } = await generateNextStep(
  //     currentStep.malayalam || currentStep.question,
  //     userResponse,
  //     workflow,
  //   );

  //   if (shouldEnd) {
  //     twiml.say({ voice: 'alice', language: 'ml-IN' }, nextQuestion);
  //     twiml.hangup();
  //     await prisma.call_history.update({
  //       where: { id: callHistory.id },
  //       data: {
  //         status: CallStatusEnum.ACCEPTED,
  //         ended_at: new Date(),
  //         updated_at: new Date(),
  //       },
  //     });
  //   } else {
  //     const audioPath = await generateSpeech(nextQuestion);
  //     await prisma.call_history.update({
  //       where: { id: callHistory.id },
  //       data: {
  //         current_step: nextStepIndex,
  //         updated_at: new Date(),
  //       },
  //     });

  //     twiml.play(`${NGROK_BASE_URL}/audio/${path.basename(audioPath)}`);
  //     twiml.record({
  //       action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
  //       method: 'POST',
  //       maxLength: 30,
  //       playBeep: true,
  //       timeout: 5,
  //     });
  //   }

  //   res.type('text/xml').send(twiml.toString());
  // } catch (error) {
  //   console.error('Error in voice response handler:', error);
  //   twiml.say('Sorry, there was an error. Goodbye.');
  //   twiml.hangup();
  //   res.type('text/xml').send(twiml.toString());
  // }
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
    const workflow =
      defaultWorkflows[`group${session.group_id}`] || defaultWorkflows['group1'];
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
};
