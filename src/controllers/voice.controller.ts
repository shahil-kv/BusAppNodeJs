import { asyncHandler } from '../utils/asyncHandler';
// import { ApiResponse } from '../utils/ApiResponse';
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import twilio from 'twilio';
import { CallStatusEnum } from '../constant';
import { getWorkflowSteps } from '../services/workflow.service';
import { parseCurrentStep } from '../utils/call.helper';
import {
  generateSpeech,
  transcribeAudio,
  getOrCreateAudioUrl,
} from '../services/speech.service';
import { fetchAudioBuffer } from '../services/audio.service';
import {
  analyzeUserResponse,
  handleDocumentQuery,
  getNextWorkflowStep,
  AIAgentResponse
} from '../services/ai-agent.service';

const prisma = new PrismaClient();
const NGROK_BASE_URL = process.env.NGROK_BASE_URL;

// Handle voice interaction
const voiceHandler = asyncHandler(async (req, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
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
    let audioUrl: string;
    try {
      const audioPath = await generateSpeech(questionText);
      audioUrl = await getOrCreateAudioUrl(questionText, audioPath);
      twiml.play(audioUrl);
    } catch (error) {
      console.error('TTS failed, falling back to Twilio say:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }

    // If useMediaStream is set, use Twilio Media Streams for real-time audio
    if (req.query.useMediaStream === 'true' || req.body.useMediaStream === true) {
      const streamUrl = `${process.env.MEDIA_STREAM_WSS_URL || 'wss://your-backend-domain/ws/twilio-audio'}`;
      const streamName = `session-${sessionId}-contact-${contactId}`;
      const connect = twiml.connect();
      connect.stream({
        url: streamUrl,
        name: streamName,
      });
      // Play the prompt before streaming (audioUrl is already calculated above)
      if (audioUrl) twiml.play(audioUrl);
      res.type('text/xml').send(twiml.toString());
      return;
    }

    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 2,
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

const voiceResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    const { sessionId, contactId } = req.query;
    console.log(`=== Voice Response Handler Started ===`, { sessionId, contactId });

    if (!sessionId || !contactId) {
      console.error('Missing sessionId or contactId in voice response handler');
      twiml.say('Sorry, there was an error. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const session = await prisma.call_session.findUnique({
      where: { id: Number(sessionId) },
      include: { call_history: true },
    });

    if (!session) {
      console.error('Session not found:', sessionId);
      twiml.say('Sorry, session not found. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const callHistory = session.call_history.find(
      (ch) => ch.contact_id === Number(contactId),
    );
    if (!callHistory) {
      console.error('Call history not found for contact:', contactId);
      twiml.say('Sorry, call record not found. Goodbye.');
      twiml.hangup();
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

    console.log('User response:', userResponse);
    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: { transcription: userResponse, updated_at: new Date() },
    });

    // === New: AI Agent Analysis ===
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
      console.error('Current step not found in workflow:', currentStepObj?.step_id);
      twiml.say('Thank you for your time. Goodbye.');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // Analyze user response with AI Agent
    let aiResponse: AIAgentResponse;
    try {
      console.log('=== Starting AI Agent Analysis ===');
      aiResponse = await analyzeUserResponse({
        currentStep,
        workflow,
        sessionId: String(sessionId),
        userResponse
      });
      console.log('AI Agent Response:', aiResponse);
    } catch (error) {
      console.error('Error in AI Agent analysis:', error);
      // Fallback to workflow logic
      const { nextStep, shouldEnd } = await getNextWorkflowStep(currentStep, userResponse, workflow);
      aiResponse = {
        action: 'workflow',
        confidence: 0.5,
        reasoning: 'Fallback due to AI Agent error',
        nextStep,
        shouldEnd
      };
    }

    // Handle different AI Agent actions
    switch (aiResponse.action) {
      case 'workflow':
        await handleWorkflowAction(aiResponse, session, callHistory, twiml, String(sessionId), String(contactId), userResponse);
        break;

      case 'document':
        await handleDocumentAction(userResponse, session, callHistory, twiml, String(sessionId), String(contactId));
        break;

      case 'clarification':
        await handleClarificationAction(aiResponse, session, callHistory, twiml, String(sessionId), String(contactId));
        break;

      case 'end':
        await handleEndAction(twiml, callHistory);
        break;

      case 'emotional':
        await handleEmotionalAction(aiResponse, session, callHistory, twiml, String(sessionId), String(contactId), userResponse);
        break;

      case 'interruption':
        await handleInterruptionAction(aiResponse, session, callHistory, twiml, String(sessionId), String(contactId), userResponse);
        break;

      default:
        console.error('Unknown AI Agent action:', aiResponse.action);
        twiml.say('Sorry, I did not understand. Goodbye.');
        twiml.hangup();
    }

    console.log('Final TwiML Response:', twiml.toString());
    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('Error in voice response handler:', error);
    twiml.say('Sorry, there was a technical error. Please try again later. Goodbye.');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// Enhanced workflow action to handle mixed intents
async function handleWorkflowAction(
  aiResponse: AIAgentResponse,
  session: any,
  callHistory: any,
  twiml: any,
  sessionId: string,
  contactId: string,
  userResponse: string
) {
  console.log('=== Handling Workflow Action ===');

  // Handle mixed intent if present
  if (aiResponse.mixedIntent && aiResponse.secondaryAction === 'document') {
    console.log('Handling mixed intent: workflow + document');

    // First handle the document part
    const documentAnswer = await handleDocumentQuery(userResponse);
    try {
      const answerAudioPath = await generateSpeech(documentAnswer);
      const answerAudioUrl = await getOrCreateAudioUrl(documentAnswer, answerAudioPath);
      twiml.play(answerAudioUrl);
    } catch (error) {
      console.error('TTS failed for mixed intent document answer:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, documentAnswer);
    }
  }

  if (aiResponse.shouldEnd) {
    const endMessage = 'നിങ്ങളുടെ സമയത്തിന് നന്ദി. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!';
    try {
      const audioPath = await generateSpeech(endMessage);
      const audioUrl = await getOrCreateAudioUrl(endMessage, audioPath);
      twiml.play(audioUrl);
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
  } else if (aiResponse.nextStep) {
    // Update call history with next step
    const group = session.group_id
      ? await prisma.groups.findUnique({
        where: { id: session.group_id },
        include: { workflows: true },
      })
      : null;

    await prisma.call_history.update({
      where: { id: callHistory.id },
      data: {
        current_step: JSON.stringify({
          workflow_id: group?.workflows?.id || null,
          step_id: aiResponse.nextStep.step_id,
        }),
        updated_at: new Date(),
      },
    });

    // Play next question
    const questionText = aiResponse.nextStep.malayalam || aiResponse.nextStep.question;
    try {
      const audioPath = await generateSpeech(questionText);
      const audioUrl = await getOrCreateAudioUrl(questionText, audioPath);
      twiml.play(audioUrl);
    } catch (error) {
      console.error('TTS failed:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, aiResponse.nextStep.question);
    }

    // Record next response
    twiml.record({
      action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
      method: 'POST',
      maxLength: 30,
      playBeep: true,
      timeout: 2,
      transcribe: false,
      recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
      recordingStatusCallbackMethod: 'POST',
    });
  }
}

// Helper function to handle document actions
async function handleDocumentAction(
  userResponse: string,
  session: any,
  callHistory: any,
  twiml: any,
  sessionId: string,
  contactId: string
) {
  console.log('=== Handling Document Action ===');

  // Get document answer
  const documentAnswer = await handleDocumentQuery(userResponse);

  // Generate TTS for document answer
  const audioPath = await generateSpeech(documentAnswer);
  const audioUrl = await getOrCreateAudioUrl(documentAnswer, audioPath);
  twiml.play(audioUrl);

  // Continue with current workflow step
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
    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const nextAudioPath = await generateSpeech(questionText);
      const nextAudioUrl = await getOrCreateAudioUrl(questionText, nextAudioPath);
      twiml.play(nextAudioUrl);
    } catch (error) {
      console.error('TTS failed for next question:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }
  }

  // Record next response
  twiml.record({
    action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
    method: 'POST',
    maxLength: 30,
    playBeep: true,
    timeout: 2,
    transcribe: false,
    recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
    recordingStatusCallbackMethod: 'POST',
  });
}

// Helper function to handle clarification actions
async function handleClarificationAction(
  aiResponse: AIAgentResponse,
  session: any,
  callHistory: any,
  twiml: any,
  sessionId: string,
  contactId: string
) {
  console.log('=== Handling Clarification Action ===');

  const clarificationMessage = aiResponse.clarificationMessage || 'Could you please clarify your response?';

  try {
    const audioPath = await generateSpeech(clarificationMessage);
    const audioUrl = await getOrCreateAudioUrl(clarificationMessage, audioPath);
    twiml.play(audioUrl);
  } catch (error) {
    console.error('TTS failed for clarification:', error);
    twiml.say({ voice: 'alice', language: 'en-IN' }, clarificationMessage);
  }

  // Repeat current question
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
    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const nextAudioPath = await generateSpeech(questionText);
      const nextAudioUrl = await getOrCreateAudioUrl(questionText, nextAudioPath);
      twiml.play(nextAudioUrl);
    } catch (error) {
      console.error('TTS failed for repeated question:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }
  }

  // Record next response
  twiml.record({
    action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
    method: 'POST',
    maxLength: 30,
    playBeep: true,
    timeout: 2,
    transcribe: false,
    recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
    recordingStatusCallbackMethod: 'POST',
  });
}

// Helper function to handle end actions
async function handleEndAction(twiml: any, callHistory: any) {
  console.log('=== Handling End Action ===');

  const endMessage = 'Thank you for your time. Have a great day!';
  try {
    const audioPath = await generateSpeech(endMessage);
    const audioUrl = await getOrCreateAudioUrl(endMessage, audioPath);
    twiml.play(audioUrl);
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
}

// Helper function to handle emotional actions
async function handleEmotionalAction(
  aiResponse: AIAgentResponse,
  session: any,
  callHistory: any,
  twiml: any,
  sessionId: string,
  contactId: string,
  userResponse: string
) {
  console.log('=== Handling Emotional Action ===');

  let emotionalResponse: string;

  switch (aiResponse.emotionalState) {
    case 'angry':
      emotionalResponse = 'ക്ഷമിക്കണം, നിങ്ങളെ ബുദ്ധിമുട്ടിച്ചതിന്. എനിക്ക് സഹായിക്കാൻ കഴിയുമോ?';
      break;
    case 'confused':
      emotionalResponse = 'എനിക്ക് മനസ്സിലാക്കാം. ഞാൻ വ്യക്തമായി വിശദീകരിക്കാം.';
      break;
    case 'happy':
      emotionalResponse = 'നിങ്ങൾ സന്തോഷമായിരിക്കുന്നത് കാണാൻ സന്തോഷമുണ്ട്!';
      break;
    default:
      emotionalResponse = 'എനിക്ക് നിങ്ങളെ സഹായിക്കാൻ കഴിയുമോ?';
  }

  try {
    const audioPath = await generateSpeech(emotionalResponse);
    const audioUrl = await getOrCreateAudioUrl(emotionalResponse, audioPath);
    twiml.play(audioUrl);
  } catch (error) {
    console.error('TTS failed for emotional response:', error);
    twiml.say({ voice: 'alice', language: 'en-IN' }, emotionalResponse);
  }

  // Continue with current workflow step
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
    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const nextAudioPath = await generateSpeech(questionText);
      const nextAudioUrl = await getOrCreateAudioUrl(questionText, nextAudioPath);
      twiml.play(nextAudioUrl);
    } catch (error) {
      console.error('TTS failed for next question:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }
  }

  // Record next response
  twiml.record({
    action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
    method: 'POST',
    maxLength: 30,
    playBeep: true,
    timeout: 2,
    transcribe: false,
    recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
    recordingStatusCallbackMethod: 'POST',
  });
}

// Helper function to handle interruption actions
async function handleInterruptionAction(
  aiResponse: AIAgentResponse,
  session: any,
  callHistory: any,
  twiml: any,
  sessionId: string,
  contactId: string,
  userResponse: string
) {
  console.log('=== Handling Interruption Action ===');

  let interruptionResponse: string;

  switch (aiResponse.interruptionType) {
    case 'question':
      interruptionResponse = 'ശരി, നിങ്ങളുടെ ചോദ്യത്തിന് ഉത്തരം നൽകാം.';
      break;
    case 'objection':
      interruptionResponse = 'എനിക്ക് മനസ്സിലാക്കാം. നിങ്ങളുടെ ആശങ്കകൾ കേൾക്കാം.';
      break;
    case 'request':
      interruptionResponse = 'ശരി, നിങ്ങൾ എന്താണ് വേണ്ടത്?';
      break;
    default:
      interruptionResponse = 'ശരി, എന്താണ് പ്രശ്നം?';
  }

  try {
    const audioPath = await generateSpeech(interruptionResponse);
    const audioUrl = await getOrCreateAudioUrl(interruptionResponse, audioPath);
    twiml.play(audioUrl);
  } catch (error) {
    console.error('TTS failed for interruption response:', error);
    twiml.say({ voice: 'alice', language: 'en-IN' }, interruptionResponse);
  }

  // If it's a question, handle it as document query
  if (aiResponse.interruptionType === 'question') {
    // Get the question from user response and handle it
    const documentAnswer = await handleDocumentQuery(userResponse);

    try {
      const answerAudioPath = await generateSpeech(documentAnswer);
      const answerAudioUrl = await getOrCreateAudioUrl(documentAnswer, answerAudioPath);
      twiml.play(answerAudioUrl);
    } catch (error) {
      console.error('TTS failed for document answer:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, documentAnswer);
    }
  }

  // Continue with current workflow step
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
    const questionText = currentStep.malayalam || currentStep.question;
    try {
      const nextAudioPath = await generateSpeech(questionText);
      const nextAudioUrl = await getOrCreateAudioUrl(questionText, nextAudioPath);
      twiml.play(nextAudioUrl);
    } catch (error) {
      console.error('TTS failed for next question:', error);
      twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
    }
  }

  // Record next response
  twiml.record({
    action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
    method: 'POST',
    maxLength: 30,
    playBeep: true,
    timeout: 2,
    transcribe: false,
    recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
    recordingStatusCallbackMethod: 'POST',
  });
}

async function handleNoResponse(
  req: Request,
  res: Response,
  session,
  callHistory,
  twiml,
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
    // Check if the current step is terminal
    if (currentStep.yes_next === null && currentStep.no_next === null) {
      twiml.say('Thank you for your time. Goodbye.');
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
      twiml.say("I didn't hear your response. Let me repeat the question.");
      try {
        const responseText = currentStep.malayalam || currentStep.question;
        const audioPath = await generateSpeech(responseText);
        const audioUrl = await getOrCreateAudioUrl(responseText, audioPath);
        twiml.play(audioUrl);
      } catch (error) {
        console.error('TTS failed in handleNoResponse:', error);
        twiml.say({ voice: 'alice', language: 'en-IN' }, currentStep.question);
      }

      const { sessionId, contactId } = req.query;
      twiml.record({
        action: `${NGROK_BASE_URL}/voice-update/response?sessionId=${sessionId}&contactId=${contactId}`,
        method: 'POST',
        maxLength: 30,
        playBeep: true,
        timeout: 2,
        transcribe: false,
        recordingStatusCallback: `${NGROK_BASE_URL}/recording-status?sessionId=${sessionId}&contactId=${contactId}`,
        recordingStatusCallbackMethod: 'POST',
      });
    }
  } else {
    twiml.say('Sorry, there was an error. Goodbye.');
    twiml.hangup();
  }

  return res.type('text/xml').send(twiml.toString());
}

export { voiceHandler, voiceResponseHandler };

// TODO: Ensure Gemini API key is set in environment variables (.env)
// TODO: Ensure Pinecone is populated with document vectors
// TODO: Test the AI agent with various user responses
